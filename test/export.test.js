'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { convert, listFormats } = require('../src/services/exportService');

const text = (format, input) => convert(input, format, '123456').then((r) => r.buffer.toString('utf8'));

test('txt and md keep the text byte for byte', async () => {
  const input = 'line one\n  indented\n\nবাংলা';
  assert.equal(await text('txt', input), input);
  assert.equal(await text('md', input), input);
});

test('html escapes markup', async () => {
  const html = await text('html', '<script>alert(1)</script>');
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
});

test('csv neutralises spreadsheet formulas', async () => {
  const csv = await text('csv', '=HYPERLINK("http://x")\n+1\n-2\n@SUM(A1)\nplain');
  assert.ok(csv.includes(`"'=HYPERLINK`));
  assert.ok(csv.includes(`"'+1"`));
  assert.ok(csv.includes(`"'-2"`));
  assert.ok(csv.includes(`"'@SUM(A1)"`));
  assert.ok(csv.includes('"plain"'));
});

test('csv splits tab-separated text into columns', async () => {
  assert.equal(await text('csv', 'a\tb\nc\td'), '"a","b"\r\n"c","d"');
});

test('json contains the code, lines and text', async () => {
  const data = JSON.parse(await text('json', 'a\nb'));
  assert.deepEqual(data, { code: '123456', lines: ['a', 'b'], text: 'a\nb' });
});

test('pdf handles mixed Bengali and Latin text', async () => {
  const { buffer, mimeType, filename } = await convert('আমি বাংলায় গান গাই, hello, world।', 'pdf', '123456');
  assert.equal(buffer.subarray(0, 5).toString(), '%PDF-');
  assert.equal(mimeType, 'application/pdf');
  assert.equal(filename, 'sendto-123456.pdf');
});

test('docx is a zip file', async () => {
  const { buffer } = await convert('hello', 'docx', '123456');
  assert.equal(buffer.subarray(0, 2).toString(), 'PK');
});

test('unknown formats are refused', async () => {
  await assert.rejects(convert('x', 'exe', '123456'), { code: 'UNSUPPORTED_FORMAT' });
  assert.equal(listFormats().length, 7);
});
