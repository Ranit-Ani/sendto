'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { randomCode, createAccessToken, verifyAccessToken } = require('../src/utils/ids');

const SECRET = 'test-secret';

test('randomCode is always 6 digits', () => {
  for (let i = 0; i < 500; i += 1) assert.match(randomCode(), /^\d{6}$/);
});

test('a fresh access token verifies for its own code', () => {
  const token = createAccessToken('123456', SECRET, 20);
  assert.equal(verifyAccessToken(token, '123456', SECRET), true);
});

test('a token is rejected for a different code', () => {
  const token = createAccessToken('123456', SECRET, 20);
  assert.equal(verifyAccessToken(token, '654321', SECRET), false);
});

test('a token signed with another secret is rejected', () => {
  const token = createAccessToken('123456', 'other-secret', 20);
  assert.equal(verifyAccessToken(token, '123456', SECRET), false);
});

test('an expired token is rejected', () => {
  const token = createAccessToken('123456', SECRET, -1);
  assert.equal(verifyAccessToken(token, '123456', SECRET), false);
});

test('missing or garbage tokens are rejected', () => {
  assert.equal(verifyAccessToken('', '123456', SECRET), false);
  assert.equal(verifyAccessToken(undefined, '123456', SECRET), false);
  assert.equal(verifyAccessToken('not-a-token', '123456', SECRET), false);
});
