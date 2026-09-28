'use strict';

const crypto = require('crypto');
const config = require('../config');
const AppError = require('./AppError');

const PREFIX = 'enc:v1:';

function getKey() {
  if (!config.textEncryptionKey) return null;
  return crypto.createHash('sha256').update(config.textEncryptionKey).digest();
}

/** Encrypts text for storage. Returns the text unchanged when no key is set. */
function encryptText(plain) {
  const key = getKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
}

/** Reverses encryptText. Plain (unencrypted) values pass straight through. */
function decryptText(stored) {
  if (typeof stored !== 'string' || !stored.startsWith(PREFIX)) return stored;
  const key = getKey();
  if (!key) {
    throw new AppError(500, 'ENCRYPTION_KEY_MISSING', 'This text cannot be read right now.');
  }
  try {
    const [iv, tag, data] = stored.slice(PREFIX.length).split(':').map((part) => Buffer.from(part, 'base64'));
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    throw new AppError(500, 'DECRYPT_FAILED', 'This text cannot be read right now.');
  }
}

module.exports = { encryptText, decryptText };
