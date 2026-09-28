'use strict';

require('dotenv').config({ quiet: true });

const path = require('path');
const crypto = require('crypto');

const rootDir = path.resolve(__dirname, '..');

const config = {
  rootDir,
  port: Number(process.env.PORT) || 3000,

  // MongoDB Atlas connection. Share codes, file metadata, limits and counters
  // live here. Put the database name in the URI, or set MONGODB_DB_NAME.
  mongo: {
    uri: process.env.MONGODB_URI || '',
    dbName: process.env.MONGODB_DB_NAME || undefined
  },

  // Google Drive holds the uploaded file bytes (private, never shared publicly).
  // OAuth credentials come from environment variables; run `npm run google:auth`
  // once to get GOOGLE_REFRESH_TOKEN (and a folder id).
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID || '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || '',
    refreshToken: process.env.GOOGLE_REFRESH_TOKEN || '',
    // Optional. When empty, a private folder called `folderName` is found or
    // created automatically the first time a file is uploaded.
    folderId: process.env.GOOGLE_DRIVE_FOLDER_ID || '',
    folderName: process.env.GOOGLE_DRIVE_FOLDER_NAME || 'SendTo Uploads'
  },

  // Secret used to sign short-lived access tokens.
  // Set SESSION_SECRET in production so tokens survive restarts.
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),

  limits: {
    maxFileSize: Number(process.env.MAX_FILE_SIZE) || 100 * 1024 * 1024, // 100 MB per file
    maxFiles: Number(process.env.MAX_FILES) || 10,
    maxTextLength: Number(process.env.MAX_TEXT_LENGTH) || 500_000, // characters
    maxExpiryMinutes: Number(process.env.MAX_EXPIRY_MINUTES) || 60 * 24 * 30, // 30 days
    defaultExpiryMinutes: Number(process.env.DEFAULT_EXPIRY_MINUTES) || 60 * 24, // 24 hours
    accessTokenMinutes: 20
  },

  // How often expired shares are deleted from Google Drive and the database.
  cleanupIntervalMs: 5 * 60 * 1000
};

/** Fails fast, with a readable message, when required settings are missing. */
config.assertConfigured = function assertConfigured() {
  const required = {
    MONGODB_URI: config.mongo.uri,
    GOOGLE_CLIENT_ID: config.google.clientId,
    GOOGLE_CLIENT_SECRET: config.google.clientSecret,
    GOOGLE_REFRESH_TOKEN: config.google.refreshToken
  };
  const missing = Object.keys(required).filter((key) => !required[key]);
  if (missing.length) {
    throw new Error(
      `Missing required environment variable(s): ${missing.join(', ')}. See .env.example.`
    );
  }
};

module.exports = config;
