'use strict';

// Smoke tests for the parts of the server that do not need MongoDB or Drive.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const app = require('../server');

// Some checks serve the built React app, so they need `npm run build` to have run.
// Without a build they are skipped instead of failing (CI builds first, then tests).
const built = fs.existsSync(path.join(__dirname, '..', 'public', 'index.html'));

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(() => server.close());

test('GET /api/config exposes the limits the browser needs', async () => {
  const data = await (await fetch(`${base}/api/config`)).json();
  assert.equal(typeof data.maxFiles, 'number');
  assert.equal(typeof data.maxFileSize, 'number');
  assert.equal(typeof data.maxTextLength, 'number');
});

test('GET /api/formats lists the export formats', async () => {
  const { formats } = await (await fetch(`${base}/api/formats`)).json();
  assert.ok(formats.some((f) => f.id === 'pdf'));
});

test('health reports 503 while the database is not connected', async () => {
  const res = await fetch(`${base}/api/health`);
  assert.equal(res.status, 503);
  assert.equal((await res.json()).db, false);
});

test('security headers are set', async () => {
  const res = await fetch(`${base}/api/config`);
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.ok(res.headers.get('content-security-policy'));
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('unknown API paths return a JSON 404', async () => {
  const res = await fetch(`${base}/api/nope`);
  assert.equal(res.status, 404);
  assert.equal((await res.json()).error.code, 'NOT_FOUND');
});

test('app pages return 200 and unknown pages return a real 404', { skip: !built && 'frontend not built' }, async () => {
  assert.equal((await fetch(`${base}/send-files`)).status, 200);
  assert.equal((await fetch(`${base}/privacy/`)).status, 200);
  assert.equal((await fetch(`${base}/definitely-not-a-page`)).status, 404);
});

test('a bad code is rejected before touching the database', async () => {
  const res = await fetch(`${base}/api/shares/12`);
  assert.equal(res.status, 400);
  assert.equal((await res.json()).error.code, 'INVALID_CODE');
});

/* Upload guards: Mongo and Drive are stubbed, so these run offline. */

const Share = require('../src/models/Share');
const drive = require('../src/services/driveService');
const config = require('../src/config');

function multipart(fields, fileFirst = false) {
  const form = new FormData();
  const addFile = () => form.append('files', new Blob(['hello']), 'a.txt');
  if (fileFirst) addFile();
  for (const [key, value] of Object.entries(fields)) form.append(key, value);
  if (!fileFirst) addFile();
  return form;
}

test('a bad expiry is rejected before any byte reaches Drive', async () => {
  const originalAggregate = Share.aggregate;
  const originalUpload = drive.uploadStream;
  let driveCalls = 0;
  Share.aggregate = async () => [];
  drive.uploadStream = async () => {
    driveCalls += 1;
    return 'drive-id';
  };

  try {
    const res = await fetch(`${base}/api/shares/files`, {
      method: 'POST',
      body: multipart({ expiryHours: '9999' })
    });
    assert.equal(res.status, 400);
    assert.equal((await res.json()).error.code, 'INVALID_EXPIRY');
    assert.equal(driveCalls, 0);
  } finally {
    Share.aggregate = originalAggregate;
    drive.uploadStream = originalUpload;
  }
});

test('uploads are refused when total storage would pass the cap', async () => {
  const originalAggregate = Share.aggregate;
  const originalCap = config.limits.maxTotalStorage;
  Share.aggregate = async () => [{ total: 1000 }];
  config.limits.maxTotalStorage = 1000;

  try {
    const res = await fetch(`${base}/api/shares/files`, { method: 'POST', body: multipart({}) });
    assert.equal(res.status, 503);
    assert.equal((await res.json()).error.code, 'STORAGE_FULL');
  } finally {
    Share.aggregate = originalAggregate;
    config.limits.maxTotalStorage = originalCap;
  }
});

test('hashed assets are cached for good, index.html is always revalidated', { skip: !built && 'frontend not built' }, async () => {
  const html = fs.readFileSync(path.join(__dirname, '..', 'public', 'index.html'), 'utf8');
  const css = html.match(/href="(\/assets\/[^"]+\.css)"/);
  assert.ok(css, 'the built page should link a hashed, bundled stylesheet');

  const asset = await fetch(`${base}${css[1]}`);
  assert.equal(asset.status, 200);
  assert.match(asset.headers.get('cache-control'), /immutable/);

  const page = await fetch(`${base}/`);
  assert.equal(page.headers.get('cache-control'), 'no-cache');
});