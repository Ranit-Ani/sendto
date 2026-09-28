'use strict';

const bcrypt = require('bcryptjs');

const Share = require('../models/Share');
const config = require('../config');
const drive = require('./driveService');
const AppError = require('../utils/AppError');
const { randomCode, randomId } = require('../utils/ids');
const { encryptText, decryptText } = require('../utils/textCrypto');

/** Exhausted shares stay readable for this long so an open download can finish. */
const GRACE_MS = 60 * 60 * 1000;

/* ------------------------------------------------------------------ *
 * Options
 * ------------------------------------------------------------------ */

/**
 * Checks raw form values and returns them cleaned up, without doing any slow
 * work. Cheap enough to run before a large upload starts, so bad options are
 * rejected before any bytes are sent to Google Drive.
 */
function validateOptions(body = {}) {
  // Password ------------------------------------------------------
  const password = typeof body.password === 'string' ? body.password.trim() : '';
  if (password.length > 200) {
    throw new AppError(400, 'INVALID_PASSWORD', 'Password must be 200 characters or fewer.');
  }

  // Maximum views -------------------------------------------------
  let maxViews = null;
  if (body.maxViews !== undefined && body.maxViews !== null && String(body.maxViews).trim() !== '') {
    maxViews = Number(body.maxViews);
    if (!Number.isInteger(maxViews) || maxViews < 1 || maxViews > 10000) {
      throw new AppError(400, 'INVALID_MAX_VIEWS', 'View limit must be a whole number between 1 and 10000.');
    }
  }

  // Expiry --------------------------------------------------------
  const hours = toNumber(body.expiryHours);
  const minutes = toNumber(body.expiryMinutes);

  if (hours < 0 || minutes < 0) {
    throw new AppError(400, 'INVALID_EXPIRY', 'Expiry cannot be negative.');
  }

  let totalMinutes = hours * 60 + minutes;
  if (totalMinutes === 0) totalMinutes = config.limits.defaultExpiryMinutes;

  if (totalMinutes > config.limits.maxExpiryMinutes) {
    throw new AppError(
      400,
      'INVALID_EXPIRY',
      `Expiry cannot be longer than ${Math.floor(config.limits.maxExpiryMinutes / 1440)} days.`
    );
  }

  return { password, maxViews, totalMinutes };
}

/**
 * Turns raw form values into stored settings.
 * Every option is optional: an empty form produces a plain share
 * that expires after the default window.
 */
async function parseOptions(body = {}) {
  const { password, maxViews, totalMinutes } = validateOptions(body);
  // Async bcrypt keeps the event loop free while hashing.
  const passwordHash = password ? await bcrypt.hash(password, 10) : null;

  return {
    passwordHash,
    maxViews,
    expiresAt: Date.now() + totalMinutes * 60 * 1000
  };
}

function toNumber(value) {
  if (value === undefined || value === null || String(value).trim() === '') return 0;
  const n = Number(value);
  if (!Number.isFinite(n)) {
    throw new AppError(400, 'INVALID_EXPIRY', 'Expiry must be a number.');
  }
  return Math.floor(n);
}

/* ------------------------------------------------------------------ *
 * Creating shares
 * ------------------------------------------------------------------ */

function isDuplicateCode(error) {
  return Boolean(error) && error.code === 11000 && Boolean(error.keyPattern && error.keyPattern.code);
}

/**
 * Inserts a share under a fresh 6-digit code. The unique index on `code` is
 * the source of truth, so two simultaneous requests can never end up with the
 * same code: the loser gets a duplicate-key error and simply tries another.
 */
async function insertWithFreshCode(fields) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const doc = await Share.create({ ...fields, code: randomCode() });
      return doc.toObject();
    } catch (error) {
      if (!isDuplicateCode(error)) throw error;
    }
  }
  throw new AppError(503, 'CODE_UNAVAILABLE', 'Could not generate a free code. Please try again.');
}

async function createTextShare(text, options) {
  if (typeof text !== 'string' || text.trim() === '') {
    throw new AppError(400, 'EMPTY_TEXT', 'Add some text before sending.');
  }
  if (text.length > config.limits.maxTextLength) {
    throw new AppError(413, 'TEXT_TOO_LONG', 'That text is too long to share.');
  }

  return insertWithFreshCode({
    type: 'text',
    content: encryptText(text),
    passwordHash: options.passwordHash,
    maxViews: options.maxViews,
    createdAt: Date.now(),
    expiresAt: options.expiresAt
  });
}

/**
 * @param {{originalName:string, driveFileId:string, mimeType?:string, size:number}[]} files
 *        files already uploaded to Google Drive
 */
async function createFileShare(files, options) {
  if (!Array.isArray(files) || files.length === 0) {
    throw new AppError(400, 'NO_FILES', 'Choose at least one file before sending.');
  }

  return insertWithFreshCode({
    type: 'file',
    content: null,
    passwordHash: options.passwordHash,
    maxViews: options.maxViews,
    createdAt: Date.now(),
    expiresAt: options.expiresAt,
    files: files.map((file, index) => ({
      id: randomId(),
      originalName: file.originalName,
      mimeType: file.mimeType || 'application/octet-stream',
      size: file.size,
      driveFileId: file.driveFileId,
      position: index
    }))
  });
}

/* ------------------------------------------------------------------ *
 * Reading shares
 * ------------------------------------------------------------------ */

function normaliseCode(code) {
  const value = String(code || '').replace(/\D/g, '');
  if (value.length !== 6) {
    throw new AppError(400, 'INVALID_CODE', 'Enter the full 6-digit code.');
  }
  return value;
}

function assertNotExpired(share) {
  if (share.expiresAt && share.expiresAt < Date.now()) {
    throw new AppError(410, 'EXPIRED', 'This share has expired.');
  }
}

function assertViewsLeft(share) {
  if (share.maxViews !== null && share.views >= share.maxViews) {
    throw new AppError(410, 'VIEW_LIMIT_REACHED', 'This share reached its view limit.');
  }
}

async function findByCode(code) {
  const share = await Share.findOne({ code }).lean();
  if (!share) throw new AppError(404, 'NOT_FOUND', 'No share found for that code.');
  return share;
}

/**
 * Looks a share up and rejects it if it has expired or run out of views.
 * Does not count as a view.
 */
async function loadShare(code) {
  const share = await findByCode(normaliseCode(code));
  assertNotExpired(share);
  assertViewsLeft(share);
  return share;
}

/** Public summary shown before the receiver unlocks anything. */
async function getShareInfo(code) {
  const share = await loadShare(code);
  return {
    code: share.code,
    type: share.type,
    passwordProtected: Boolean(share.passwordHash),
    expiresAt: share.expiresAt,
    viewsLeft: share.maxViews === null ? null : share.maxViews - share.views
  };
}

/**
 * Counts one view without ever exceeding the limit, even when several
 * receivers open the same code at the same moment: the update only applies if
 * `views` is still the value we read, otherwise we re-read and re-check.
 */
async function countView(share) {
  let current = share;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const updated = await Share.findOneAndUpdate(
      { _id: current._id, views: current.views },
      { $inc: { views: 1 }, $set: { lastViewedAt: Date.now() } },
      { returnDocument: 'after' }
    ).lean();
    if (updated) return updated;

    current = await Share.findById(current._id).lean();
    if (!current) throw new AppError(404, 'NOT_FOUND', 'No share found for that code.');
    assertNotExpired(current);
    assertViewsLeft(current);
  }
  throw new AppError(503, 'BUSY', 'That share is busy right now. Please try again.');
}

function sortedFiles(share) {
  return [...(share.files || [])].sort((a, b) => a.position - b.position);
}

/* Per-code password lockout ------------------------------------------ *
 * Stops many different IPs from hammering one password-protected code.
 * In-memory, like the rate limiter: use a shared store if you run several
 * server processes.
 */
const MAX_PASSWORD_FAILURES = 10;
const PASSWORD_LOCK_MS = 10 * 60 * 1000;
const passwordFailures = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [code, entry] of passwordFailures) {
    if (entry.resetAt < now) passwordFailures.delete(code);
  }
}, PASSWORD_LOCK_MS).unref();

function assertNotLocked(code) {
  const entry = passwordFailures.get(code);
  if (entry && entry.resetAt >= Date.now() && entry.count >= MAX_PASSWORD_FAILURES) {
    throw new AppError(
      429,
      'TOO_MANY_ATTEMPTS',
      'Too many wrong passwords for this code. Try again in a few minutes.'
    );
  }
}

function recordPasswordFailure(code) {
  const entry = passwordFailures.get(code);
  if (entry && entry.resetAt >= Date.now()) entry.count += 1;
  else passwordFailures.set(code, { count: 1, resetAt: Date.now() + PASSWORD_LOCK_MS });
}

/**
 * Verifies the password, counts one view and returns the shared content.
 * @param {string} code
 * @param {string} password
 * @param {'text'|'file'|undefined} expectedType page the receiver came from
 */
async function openShare(code, password, expectedType) {
  const found = await loadShare(code);

  if (expectedType && found.type !== expectedType) {
    throw new AppError(
      409,
      'WRONG_TYPE',
      found.type === 'text'
        ? 'That code holds shared text. Open it on the Receive text page.'
        : 'That code holds shared files. Open it on the Receive files page.'
    );
  }

  if (found.passwordHash) {
    assertNotLocked(found.code);
    const supplied = typeof password === 'string' ? password : '';
    if (!supplied) {
      throw new AppError(401, 'PASSWORD_REQUIRED', 'This share is password protected.');
    }
    if (!(await bcrypt.compare(supplied, found.passwordHash))) {
      recordPasswordFailure(found.code);
      throw new AppError(403, 'WRONG_PASSWORD', 'That password does not match.');
    }
    passwordFailures.delete(found.code);
  }

  const share = await countView(found);
  if (share.type === 'text') share.content = decryptText(share.content);

  return {
    share,
    views: share.views,
    viewsLeft: share.maxViews === null ? null : Math.max(share.maxViews - share.views, 0),
    files: share.type === 'file' ? sortedFiles(share) : []
  };
}

/**
 * Re-reads a share for a receiver who already unlocked it (download / export).
 * Ignores the view limit, because the view was counted when they opened it.
 */
async function loadUnlockedShare(code) {
  const share = await findByCode(normaliseCode(code));
  assertNotExpired(share);
  if (share.type === 'text') share.content = decryptText(share.content);
  return share;
}

/** Finds one file's metadata inside an already loaded share. */
function getFile(share, fileId) {
  const file = (share.files || []).find((entry) => entry.id === fileId);
  if (!file) throw new AppError(404, 'FILE_NOT_FOUND', 'That file is no longer available.');
  return file;
}

function getFiles(share) {
  return sortedFiles(share);
}

/** Counts one download on the share and on the file. Never blocks the download. */
async function recordDownload(share, fileId) {
  try {
    // Files are never reordered, so the index we just read is stable.
    const index = (share.files || []).findIndex((entry) => entry.id === fileId);
    if (index === -1) return;
    await Share.updateOne(
      { _id: share._id, [`files.${index}.id`]: fileId },
      { $inc: { downloads: 1, [`files.${index}.downloads`]: 1 } }
    );
  } catch (error) {
    console.error('Could not record download:', (error && error.message) || error);
  }
}

/** Total bytes of files currently kept in Drive (from the share records). */
async function storedBytes() {
  const [row] = await Share.aggregate([
    { $match: { type: 'file' } },
    { $unwind: '$files' },
    { $group: { _id: null, total: { $sum: '$files.size' } } }
  ]);
  return row ? row.total : 0;
}

/* ------------------------------------------------------------------ *
 * Cleanup
 * ------------------------------------------------------------------ */

let cleaning = false;

/**
 * Deletes expired and used-up shares, plus their files in Google Drive.
 * A share row is only removed once its Drive files are gone, so a Drive
 * outage never leaves orphaned files behind: the next run simply retries.
 */
async function cleanupExpired() {
  if (cleaning) return 0;
  cleaning = true;

  try {
    const now = Date.now();
    const graceCutoff = now - GRACE_MS;

    const candidates = await Share.find({
      $or: [
        { expiresAt: { $ne: null, $lt: now } },
        { maxViews: { $ne: null } }
      ]
    })
      .select('expiresAt maxViews views lastViewedAt createdAt files.driveFileId')
      .lean();

    const stale = candidates.filter((share) => {
      if (share.expiresAt && share.expiresAt < now) return true;
      return (
        share.maxViews !== null &&
        share.views >= share.maxViews &&
        (share.lastViewedAt || share.createdAt) < graceCutoff
      );
    });

    let removed = 0;
    for (const share of stale) {
      const results = await Promise.allSettled(
        (share.files || []).map((file) => drive.deleteFile(file.driveFileId))
      );
      const failed = results.find((result) => result.status === 'rejected');
      if (failed) {
        console.error('Cleanup: could not delete a Drive file, will retry:', failed.reason && failed.reason.message);
        continue;
      }
      await Share.deleteOne({ _id: share._id });
      removed += 1;
    }

    return removed;
  } finally {
    cleaning = false;
  }
}

module.exports = {
  validateOptions,
  parseOptions,
  storedBytes,
  createTextShare,
  createFileShare,
  getShareInfo,
  openShare,
  loadUnlockedShare,
  getFile,
  getFiles,
  recordDownload,
  cleanupExpired,
  normaliseCode
};
