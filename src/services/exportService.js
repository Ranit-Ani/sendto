'use strict';

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun } = require('docx');
const AppError = require('../utils/AppError');

/** Formats offered to the receiver, in menu order. */
const FORMATS = {
  txt: { label: 'Plain text', extension: 'txt', mimeType: 'text/plain; charset=utf-8' },
  md: { label: 'Markdown', extension: 'md', mimeType: 'text/markdown; charset=utf-8' },
  html: { label: 'Web page', extension: 'html', mimeType: 'text/html; charset=utf-8' },
  csv: { label: 'Spreadsheet (CSV)', extension: 'csv', mimeType: 'text/csv; charset=utf-8' },
  json: { label: 'JSON', extension: 'json', mimeType: 'application/json; charset=utf-8' },
  pdf: { label: 'PDF', extension: 'pdf', mimeType: 'application/pdf' },
  docx: {
    label: 'Word (DOCX)',
    extension: 'docx',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  }
};

function listFormats() {
  return Object.entries(FORMATS).map(([id, meta]) => ({
    id,
    label: meta.label,
    extension: meta.extension
  }));
}

/** Splits on any newline style without losing empty lines. */
function toLines(text) {
  return text.replace(/\r\n?/g, '\n').split('\n');
}

function escapeHtml(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function toHtml(text, code) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Shared text ${code}</title>
<style>
  body { margin: 0; padding: 2.5rem 1.25rem; background: #f8fafc; color: #0f172a;
         font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; }
  main { max-width: 52rem; margin: 0 auto; background: #fff; padding: 2rem;
         border-radius: 16px; box-shadow: 0 10px 30px rgba(15, 23, 42, .08); }
  pre  { margin: 0; white-space: pre-wrap; word-wrap: break-word; font-size: 1rem; line-height: 1.7;
         font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
</style>
</head>
<body>
<main><pre>${escapeHtml(text)}</pre></main>
</body>
</html>
`;
}

/**
 * Tab-separated text becomes real columns; anything else becomes
 * one row per line, quoted so commas and quotes survive the trip.
 */
function toCsv(text) {
  const lines = toLines(text);
  const hasTabs = lines.some((line) => line.includes('\t'));
  // A cell starting with = + - @ (or a tab/CR) can run as a formula when the
  // CSV is opened in Excel or Sheets. A leading apostrophe keeps it plain text.
  const quote = (cell) => {
    const safe = /^[=+\-@\t\r]/.test(cell) ? `'${cell}` : cell;
    return `"${safe.replace(/"/g, '""')}"`;
  };

  if (hasTabs) {
    return lines.map((line) => line.split('\t').map(quote).join(',')).join('\r\n');
  }
  return ['"line","text"', ...lines.map((line, i) => `${i + 1},${quote(line)}`)].join('\r\n');
}

function toJson(text, code) {
  return JSON.stringify({ code, lines: toLines(text), text }, null, 2);
}

/**
 * Bundled font so accented and non-Latin characters survive the export.
 * PDFKit's built-in Courier only covers WinAnsi.
 */
const PDF_FONT = path.join(__dirname, '..', '..', 'assets', 'fonts', 'DejaVuSansMono.ttf');
const PDF_FONT_BENGALI = path.join(__dirname, '..', '..', 'assets', 'fonts', 'NotoSansBengali-Regular.woff');
const hasBundledFont = fs.existsSync(PDF_FONT);
const hasBengaliFont = fs.existsSync(PDF_FONT_BENGALI);

// Bengali block, the danda marks, and the joiners used inside conjuncts.
const BENGALI_CHAR = /[\u0980-\u09FF\u0964\u0965\u200C\u200D]/;

/**
 * Splits a line into runs that each use one font. The Bengali font has no
 * Latin punctuation and DejaVu has no Bengali, so each run gets the right one.
 */
function splitRuns(line) {
  const runs = [];
  for (const char of line) {
    const bengali = hasBengaliFont && BENGALI_CHAR.test(char);
    const last = runs[runs.length - 1];
    if (last && last.bengali === bengali) last.text += char;
    else runs.push({ bengali, text: char });
  }
  return runs;
}

function toPdf(text) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 56 });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const latinFont = hasBundledFont ? PDF_FONT : 'Courier';
    doc.fontSize(10);

    // Line by line so blank lines and indentation survive.
    for (const line of toLines(text)) {
      const runs = splitRuns(line === '' ? ' ' : line);
      runs.forEach((run, index) => {
        doc.font(run.bengali ? PDF_FONT_BENGALI : latinFont);
        doc.text(run.text, { lineGap: 1.5, continued: index < runs.length - 1 });
      });
    }
    doc.end();
  });
}

function toDocx(text) {
  const doc = new Document({
    sections: [
      {
        children: toLines(text).map(
          (line) =>
            new Paragraph({
              children: [new TextRun({ text: line, font: 'Consolas', size: 22 })],
              spacing: { after: 60 }
            })
        )
      }
    ]
  });
  return Packer.toBuffer(doc);
}

/**
 * Converts shared text into the requested format.
 * @returns {Promise<{buffer: Buffer, mimeType: string, filename: string}>}
 */
async function convert(text, format, code) {
  const meta = FORMATS[format];
  if (!meta) {
    throw new AppError(400, 'UNSUPPORTED_FORMAT', 'That download format is not supported.');
  }

  let body;
  switch (format) {
    case 'txt':
    case 'md':
      body = text;
      break;
    case 'html':
      body = toHtml(text, code);
      break;
    case 'csv':
      body = toCsv(text);
      break;
    case 'json':
      body = toJson(text, code);
      break;
    case 'pdf':
      body = await toPdf(text);
      break;
    case 'docx':
      body = await toDocx(text);
      break;
    default:
      body = text;
  }

  return {
    buffer: Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8'),
    mimeType: meta.mimeType,
    filename: `sendto-${code}.${meta.extension}`
  };
}

module.exports = { convert, listFormats, FORMATS };
