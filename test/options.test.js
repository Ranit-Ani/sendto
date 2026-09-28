'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const bcrypt = require('bcryptjs');
const config = require('../src/config');
const { validateOptions, parseOptions, normaliseCode } = require('../src/services/shareService');

test('empty options use the default expiry and no limits', async () => {
  const before = Date.now();
  const options = await parseOptions({});
  assert.equal(options.passwordHash, null);
  assert.equal(options.maxViews, null);
  const expected = before + config.limits.defaultExpiryMinutes * 60 * 1000;
  assert.ok(Math.abs(options.expiresAt - expected) < 5000);
});

test('hours and minutes add up', async () => {
  const before = Date.now();
  const options = await parseOptions({ expiryHours: '1', expiryMinutes: '30' });
  assert.ok(Math.abs(options.expiresAt - (before + 90 * 60 * 1000)) < 5000);
});

test('a password is hashed with bcrypt and never stored as plain text', async () => {
  const options = await parseOptions({ password: '  secret  ' });
  assert.notEqual(options.passwordHash, 'secret');
  assert.equal(await bcrypt.compare('secret', options.passwordHash), true);
  assert.equal(await bcrypt.compare('wrong', options.passwordHash), false);
});

test('bad options are rejected with a clear code', () => {
  const code = (body) => {
    try {
      validateOptions(body);
    } catch (error) {
      return error.code;
    }
    return null;
  };
  assert.equal(code({ maxViews: '0' }), 'INVALID_MAX_VIEWS');
  assert.equal(code({ maxViews: '1.5' }), 'INVALID_MAX_VIEWS');
  assert.equal(code({ maxViews: '10001' }), 'INVALID_MAX_VIEWS');
  assert.equal(code({ expiryHours: '-1' }), 'INVALID_EXPIRY');
  assert.equal(code({ expiryHours: 'abc' }), 'INVALID_EXPIRY');
  assert.equal(code({ expiryHours: String(24 * 31) }), 'INVALID_EXPIRY');
  assert.equal(code({ password: 'x'.repeat(201) }), 'INVALID_PASSWORD');
  assert.equal(code({ maxViews: '5', expiryHours: '2' }), null);
});

test('normaliseCode strips non-digits and insists on 6 digits', () => {
  assert.equal(normaliseCode('123 456'), '123456');
  assert.throws(() => normaliseCode('12345'), { code: 'INVALID_CODE' });
});
