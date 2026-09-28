'use strict';

const { Transform } = require('stream');
const multer = require('multer');
const config = require('../config');
const drive = require('../services/driveService');
const shareService = require('../services/shareService');
const { randomId } = require('../utils/ids');

/** Passes bytes through untouched while counting them. */
class ByteCounter extends Transform {
  constructor() {
    super();
    this.bytes = 0;
  }

  _transform(chunk, encoding, callback) {
    this.bytes += chunk.length;
    callback(null, chunk);
  }
}

/**
 * Multer storage engine that streams each upload straight into Google Drive.
 * Nothing is written to the local disk and nothing is buffered in full, so a
 * 100 MB upload costs the server only a few kilobytes of memory.
 *
 * Files are stored under a random name so nothing in Drive is guessable and
 * the original name can contain anything (it is kept in MongoDB).
 */
class DriveStorage {
  _handleFile(req, file, cb) {
    // Reject bad options (password, view limit, expiry) before a single byte
    // goes to Drive. This works because the browser sends the option fields
    // ahead of the files; if they arrive later, the route checks them again.
    try {
      shareService.validateOptions(req.body);
    } catch (error) {
      file.stream.resume();
      return cb(error);
    }

    const counter = new ByteCounter();
    let settled = false;

    function finish(error, info) {
      if (settled) return;
      settled = true;
      cb(error, info);
    }

    // Stop feeding Drive if the upload is cut short or over the size limit,
    // but keep draining the incoming stream so the request can finish.
    let aborted = false;
    const abort = (error) => {
      aborted = true;
      counter.destroy(error);
      file.stream.resume();
    };
    file.stream.on('limit', () => abort(new Error('File too large')));
    file.stream.on('error', abort);
    file.stream.on('close', () => {
      if (!file.stream.readableEnded) abort(new Error('Upload interrupted'));
    });

    file.stream.pipe(counter);

    drive
      .uploadStream(counter, { name: randomId(16) })
      .then((driveFileId) => finish(null, { driveFileId, size: counter.bytes }))
      // A deliberate abort (too large / cut off) is already reported by multer.
      .catch((error) => finish(aborted ? error : drive.storageError(error)));
  }

  _removeFile(req, file, cb) {
    discard([file]).then(() => cb(null));
  }
}

/** Best-effort removal of uploaded files from Drive (used after a failed request). */
async function discard(files = []) {
  await Promise.all(
    files
      .filter((file) => file && file.driveFileId)
      .map((file) =>
        drive.deleteFile(file.driveFileId).catch((error) => {
          console.error('Could not delete Drive file:', (error && error.message) || error);
        })
      )
  );
}

const upload = multer({
  storage: new DriveStorage(),
  limits: {
    fileSize: config.limits.maxFileSize,
    files: config.limits.maxFiles
  }
});

module.exports = upload;
module.exports.discard = discard;
