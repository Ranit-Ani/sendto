'use strict';

const AppError = require('../utils/AppError');

/**
 * Small fixed-window limiter, enough to make guessing 6-digit codes
 * impractical on a single server. Swap for Redis if you run several.
 */
function rateLimit({ windowMs, max, message }) {
  const hits = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of hits) {
      if (entry.resetAt < now) hits.delete(key);
    }
  }, windowMs).unref();

  return function limiter(req, res, next) {
    const key = req.ip;
    const now = Date.now();
    const entry = hits.get(key);

    if (!entry || entry.resetAt < now) {
      hits.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    entry.count += 1;
    if (entry.count > max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return next(new AppError(429, 'TOO_MANY_REQUESTS', message));
    }
    return next();
  };
}

/**
 * Counts only *failed* attempts (unknown code, wrong password) per IP.
 * `guard` blocks an IP that failed too often; call `fail(req)` on each failure.
 * This is what makes walking through the 6-digit code space impractical
 * even though normal traffic is allowed through generously.
 */
function failureLimiter({ windowMs, max, message }) {
  const failures = new Map();

  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of failures) {
      if (entry.resetAt < now) failures.delete(key);
    }
  }, windowMs).unref();

  function current(req) {
    const entry = failures.get(req.ip);
    return entry && entry.resetAt >= Date.now() ? entry : null;
  }

  function guard(req, res, next) {
    const entry = current(req);
    if (entry && entry.count >= max) {
      res.set('Retry-After', String(Math.ceil((entry.resetAt - Date.now()) / 1000)));
      return next(new AppError(429, 'TOO_MANY_ATTEMPTS', message));
    }
    return next();
  }

  function fail(req) {
    const entry = current(req);
    if (entry) entry.count += 1;
    else failures.set(req.ip, { count: 1, resetAt: Date.now() + windowMs });
  }

  return { guard, fail };
}

module.exports = rateLimit;
module.exports.failureLimiter = failureLimiter;
