'use strict';

const express = require('express');

const config = require('../config');
const AppError = require('../utils/AppError');
const upload = require('../middleware/upload');
const rateLimit = require('../middleware/rateLimit');
const shareService = require('../services/shareService');
const driveService = require('../services/driveService');
const exportService = require('../services/exportService');
const { createAccessToken, verifyAccessToken } = require('../utils/ids');

const router = express.Router();

/* Guards ------------------------------------------------------------ */

const createLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  message: 'You are sending a lot of shares. Wait a minute and try again.'
});

const lookupLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 40,
  message: 'Too many code attempts. Wait a minute and try again.'
});

// Failed attempts only (unknown code, wrong password), counted over a longer
// window. This is what makes guessing through the code space impractical.
const failedLookups = rateLimit.failureLimiter({
  windowMs: 10 * 60 * 1000,
  max: 30,
  message: 'Too many wrong codes or passwords. Wait a few minutes and try again.'
});
const COUNTED_FAILURES = new Set(['NOT_FOUND', 'WRONG_PASSWORD']);

function noteFailure(req, err) {
  if (err && COUNTED_FAILURES.has(err.code)) failedLookups.fail(req);
}

/** Refuses a new upload when the total stored size would pass the cap. */
async function checkStorage(req, res, next) {
  try {
    const incoming = Number(req.get('content-length')) || 0;
    const used = await shareService.storedBytes();
    if (used + incoming > config.limits.maxTotalStorage) {
      throw new AppError(503, 'STORAGE_FULL', 'Storage is full right now. Please try again later.');
    }
    next();
  } catch (err) {
    next(err);
  }
}

/* Helpers ----------------------------------------------------------- */

function shareResponse(req, share) {
  return {
    code: share.code,
    type: share.type,
    expiresAt: share.expiresAt,
    maxViews: share.maxViews,
    passwordProtected: Boolean(share.passwordHash),
    link: `${req.protocol}://${req.get('host')}/${
      share.type === 'text' ? 'receive-text' : 'receive-files'
    }?code=${share.code}`
  };
}

function requireToken(req, code) {
  const token = req.query.token || req.get('x-access-token');
  if (!verifyAccessToken(token, code, config.secret)) {
    throw new AppError(401, 'TOKEN_REQUIRED', 'Open the share again to refresh your access.');
  }
}

/** RFC 5987 filename so non-ASCII names download correctly. */
function attachment(res, filename, mimeType) {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '_');
  res.set('Content-Type', mimeType);
  res.set(
    'Content-Disposition',
    `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`
  );
}

/** Removes files already uploaded to Google Drive when the request then fails. */
function cleanupUploadedFiles(files = []) {
  return upload.discard(files);
}

/* Routes ------------------------------------------------------------ */

/** Limits the browser needs to validate input before uploading. */
router.get('/config', (req, res) => {
  res.json({
    maxFiles: config.limits.maxFiles,
    maxFileSize: config.limits.maxFileSize,
    maxTextLength: config.limits.maxTextLength,
    defaultExpiryMinutes: config.limits.defaultExpiryMinutes,
    maxExpiryMinutes: config.limits.maxExpiryMinutes
  });
});

/** Formats the receiver can convert shared text into. */
router.get('/formats', (req, res) => {
  res.json({ formats: exportService.listFormats() });
});

/** Share text. */
router.post('/shares/text', createLimit, async (req, res, next) => {
  try {
    const options = await shareService.parseOptions(req.body);
    const share = await shareService.createTextShare(req.body.text, options);
    res.status(201).json(shareResponse(req, share));
  } catch (err) {
    next(err);
  }
});

/** Share one or more files. */
router.post('/shares/files', createLimit, checkStorage, upload.array('files', config.limits.maxFiles), async (req, res, next) => {
  try {
    const options = await shareService.parseOptions(req.body);
    const files = (req.files || []).map((file) => ({
      // Browsers send latin1-decoded names; re-read them as UTF-8.
      originalName: Buffer.from(file.originalname, 'latin1').toString('utf8'),
      driveFileId: file.driveFileId,
      mimeType: file.mimetype,
      size: file.size
    }));

    const share = await shareService.createFileShare(files, options);
    res.status(201).json(shareResponse(req, share));
  } catch (err) {
    await cleanupUploadedFiles(req.files);
    next(err);
  }
});

/** What kind of share is this, and does it need a password? */
router.get('/shares/:code', lookupLimit, failedLookups.guard, async (req, res, next) => {
  try {
    res.json(await shareService.getShareInfo(req.params.code));
  } catch (err) {
    noteFailure(req, err);
    next(err);
  }
});

/** Unlock a share: counts one view and returns the content. */
router.post('/shares/:code/open', lookupLimit, failedLookups.guard, async (req, res, next) => {
  try {
    const { share, viewsLeft, files } = await shareService.openShare(
      req.params.code,
      req.body.password,
      req.body.type
    );

    const token = createAccessToken(share.code, config.secret, config.limits.accessTokenMinutes);

    res.json({
      code: share.code,
      type: share.type,
      token,
      expiresAt: share.expiresAt,
      viewsLeft,
      text: share.type === 'text' ? share.content : undefined,
      files: files.map((file) => ({
        id: file.id,
        name: file.originalName,
        size: file.size,
        mimeType: file.mimeType
      }))
    });
  } catch (err) {
    noteFailure(req, err);
    next(err);
  }
});

/** Download one shared file, streamed from Google Drive through this server. */
router.get('/shares/:code/files/:fileId', async (req, res, next) => {
  let source;
  try {
    const code = shareService.normaliseCode(req.params.code);
    requireToken(req, code);

    const share = await shareService.loadUnlockedShare(code);
    if (share.type !== 'file') throw new AppError(404, 'NOT_FOUND', 'This share has no files.');

    const file = shareService.getFile(share, req.params.fileId);

    // Throws FILE_GONE if the file has disappeared from Drive.
    source = await driveService.downloadStream(file.driveFileId);

    attachment(res, file.originalName, file.mimeType);
    res.set('Content-Length', String(file.size));

    source.on('error', (streamError) => {
      console.error('Drive download failed:', (streamError && streamError.message) || streamError);
      if (res.headersSent) return res.destroy(streamError);
      res.removeHeader('Content-Length');
      res.removeHeader('Content-Disposition');
      return next(driveService.storageError(streamError));
    });
    // Stop pulling from Drive if the receiver cancels the download.
    res.on('close', () => source.destroy());

    shareService.recordDownload(share, file.id);
    source.pipe(res);
  } catch (err) {
    if (source) source.destroy();
    next(err);
  }
});

/** Download shared text in a chosen format. */
router.get('/shares/:code/export', async (req, res, next) => {
  try {
    const code = shareService.normaliseCode(req.params.code);
    requireToken(req, code);

    const share = await shareService.loadUnlockedShare(code);
    if (share.type !== 'text') throw new AppError(404, 'NOT_FOUND', 'This share has no text.');

    const format = String(req.query.format || 'txt').toLowerCase();
    const { buffer, mimeType, filename } = await exportService.convert(share.content, format, code);

    attachment(res, filename, mimeType);
    res.set('Content-Length', String(buffer.length));
    res.send(buffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
