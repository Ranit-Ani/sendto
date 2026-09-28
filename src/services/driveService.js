'use strict';

/**
 * Google Drive storage.
 *
 * Talks to the Drive API as the account that owns GOOGLE_REFRESH_TOKEN.
 * Files are created private inside one folder and are never given a
 * permission, so the only way to read them is through this server.
 */

const { drive, auth } = require('@googleapis/drive');
const config = require('../config');
const AppError = require('../utils/AppError');

const FOLDER_MIME = 'application/vnd.google-apps.folder';

let client = null;
let folderPromise = null;

function getDrive() {
  if (!client) {
    const oauth = new auth.OAuth2(config.google.clientId, config.google.clientSecret);
    oauth.setCredentials({ refresh_token: config.google.refreshToken });
    client = drive({ version: 'v3', auth: oauth });
  }
  return client;
}

function isNotFound(error) {
  return Number(error && (error.code || (error.response && error.response.status))) === 404;
}

function storageError(error) {
  console.error('Google Drive error:', (error && error.message) || error);
  return new AppError(502, 'STORAGE_ERROR', 'Could not reach file storage. Please try again.');
}

/** The private folder every upload goes into. Resolved once, then cached. */
function getFolderId() {
  if (config.google.folderId) return Promise.resolve(config.google.folderId);

  if (!folderPromise) {
    folderPromise = (async () => {
      const name = config.google.folderName;
      const escaped = name.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      const found = await getDrive().files.list({
        q: `mimeType='${FOLDER_MIME}' and name='${escaped}' and trashed=false`,
        fields: 'files(id)',
        pageSize: 1,
        spaces: 'drive'
      });
      if (found.data.files && found.data.files.length) return found.data.files[0].id;

      const created = await getDrive().files.create({
        requestBody: { name, mimeType: FOLDER_MIME },
        fields: 'id'
      });
      return created.data.id;
    })().catch((error) => {
      folderPromise = null;
      throw error;
    });
  }
  return folderPromise;
}

/** Streams `body` into a new private Drive file and returns its Drive id. */
async function uploadStream(body, { name, mimeType = 'application/octet-stream' }) {
  const parent = await getFolderId();
  const response = await getDrive().files.create({
    requestBody: { name, parents: [parent] },
    media: { mimeType, body },
    fields: 'id'
  });
  return response.data.id;
}

/**
 * Opens a readable stream of the file's bytes.
 * Rejects with FILE_GONE when the file no longer exists in Drive.
 */
async function downloadStream(fileId) {
  try {
    const response = await getDrive().files.get(
      { fileId, alt: 'media' },
      { responseType: 'stream' }
    );
    return response.data;
  } catch (error) {
    if (isNotFound(error)) {
      throw new AppError(410, 'FILE_GONE', 'This file is no longer stored on the server.');
    }
    throw storageError(error);
  }
}

/** Permanently deletes a Drive file (skips the trash). Missing files are fine. */
async function deleteFile(fileId) {
  try {
    await getDrive().files.delete({ fileId });
  } catch (error) {
    if (!isNotFound(error)) throw error;
  }
}

module.exports = { uploadStream, downloadStream, deleteFile, getFolderId, storageError };
