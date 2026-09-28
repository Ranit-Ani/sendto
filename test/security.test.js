'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const config = require('../src/config');
const rateLimit = require('../src/middleware/rateLimit');
const { encryptText, decryptText } = require('../src/utils/textCrypto');

test('failure limiter blocks an IP only after too many failures', () => {
  const { guard, fail } = rateLimit.failureLimiter({ windowMs: 60_000, max: 3, message: 'slow down' });
  const req = { ip: '203.0.113.9' };
  const run = () => {
    let result = 'ok';
    guard(req, { set() {} }, (error) => {
      if (error) result = error.code;
    });
    return result;
  };

  assert.equal(run(), 'ok');
  fail(req);
  fail(req);
  assert.equal(run(), 'ok');
  fail(req);
  assert.equal(run(), 'TOO_MANY_ATTEMPTS');
  assert.equal(guard({ ip: '198.51.100.1' }, { set() {} }, (e) => e), undefined);
});

test('text encryption round-trips and hides the plain text', () => {
  config.textEncryptionKey = 'a-long-random-test-key';
  const stored = encryptText('my secret বাংলা text');
  assert.ok(stored.startsWith('enc:v1:'));
  assert.ok(!stored.includes('secret'));
  assert.equal(decryptText(stored), 'my secret বাংলা text');
  config.textEncryptionKey = '';
});

test('without a key, text is stored as is and plain values still read', () => {
  config.textEncryptionKey = '';
  assert.equal(encryptText('hello'), 'hello');
  assert.equal(decryptText('hello'), 'hello');
});

test('encrypted text cannot be read without the key or if tampered with', () => {
  config.textEncryptionKey = 'key-one';
  const stored = encryptText('hello');
  config.textEncryptionKey = '';
  assert.throws(() => decryptText(stored), { code: 'ENCRYPTION_KEY_MISSING' });

  config.textEncryptionKey = 'key-two';
  assert.throws(() => decryptText(stored), { code: 'DECRYPT_FAILED' });
  config.textEncryptionKey = '';
});
