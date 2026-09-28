'use strict';

const multer = require('multer');
const config = require('../config');
const AppError = require('../utils/AppError');

function notFound(req, res, next) {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Unknown endpoint.' } });
  }
  return next();
}

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: { code: err.code, message: err.message } });
  }

  if (err instanceof multer.MulterError) {
    const mb = Math.round(config.limits.maxFileSize / (1024 * 1024));
    const messages = {
      LIMIT_FILE_SIZE: `Each file must be ${mb} MB or smaller.`,
      LIMIT_FILE_COUNT: `You can send up to ${config.limits.maxFiles} files at once.`,
      LIMIT_UNEXPECTED_FILE: 'Unexpected upload field.'
    };
    return res.status(413).json({
      error: { code: err.code, message: messages[err.code] || 'Upload rejected.' }
    });
  }

  console.error(err);
  return res.status(500).json({
    error: { code: 'SERVER_ERROR', message: 'Something went wrong on our side. Please try again.' }
  });
}

module.exports = { notFound, errorHandler };
