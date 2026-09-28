'use strict';

const crypto = require('crypto');

/** Cryptographically random 6-digit code, e.g. "482731". */
function randomCode() {
  return String(crypto.randomInt(0, 1_000_000)).padStart(6, '0');
}

/** Random identifier used for share ids, file ids and stored file names. */
function randomId(bytes = 12) {
  return crypto.randomBytes(bytes).toString('hex');
}

/** Signed, short-lived token that proves a receiver unlocked a share. */
function createAccessToken(code, secret, minutes) {
  const expires = Date.now() + minutes * 60 * 1000;
  const payload = `${code}.${expires}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return Buffer.from(`${payload}.${signature}`).toString('base64url');
}

function verifyAccessToken(token, code, secret) {
  if (!token) return false;
  let decoded;
  try {
    decoded = Buffer.from(String(token), 'base64url').toString('utf8');
  } catch {
    return false;
  }

  const [tokenCode, expires, signature] = decoded.split('.');
  if (!tokenCode || !expires || !signature) return false;
  if (tokenCode !== code) return false;
  if (Number(expires) < Date.now()) return false;

  const expected = crypto
    .createHmac('sha256', secret)
    .update(`${tokenCode}.${expires}`)
    .digest('hex');

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = { randomCode, randomId, createAccessToken, verifyAccessToken };
