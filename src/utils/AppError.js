'use strict';

/**
 * Error with an HTTP status and a stable machine-readable code,
 * so the browser can react differently to "wrong password" vs "expired".
 */
class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

module.exports = AppError;
