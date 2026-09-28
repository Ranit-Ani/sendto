'use strict';

const os = require('os');
const path = require('path');
const express = require('express');
const helmet = require('helmet');

const config = require('./src/config');
const apiRoutes = require('./src/routes/shares');
const db = require('./src/db');
const shareService = require('./src/services/shareService');
const { notFound, errorHandler } = require('./src/middleware/errorHandler');

const app = express();

function getLanAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

app.set('trust proxy', 1);
app.disable('x-powered-by');

// Security headers (CSP, nosniff, frame protection, ...). `upgrade-insecure-requests`
// is left off so the app still works over plain http on localhost / a LAN.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'upgrade-insecure-requests': null,
        // The QR scanner shows the camera stream in a <video> element.
        'media-src': ["'self'", 'blob:'],
        // QR codes are rendered as data: images.
        'img-src': ["'self'", 'data:']
      }
    }
  })
);

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: false, limit: '2mb' }));

// Static site
app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    maxAge: process.env.NODE_ENV === 'production' ? '1h' : 0
  })
);

// API
app.get('/api/health', (req, res) => {
  const dbReady = db.mongoose.connection.readyState === 1;
  res.status(dbReady ? 200 : 503).json({ ok: dbReady, db: dbReady, time: Date.now() });
});
app.use('/api', apiRoutes);

// Errors
app.use(notFound);

// Client-side routing: any other GET request falls through to the React
// app's index.html so React Router can render the right page (including
// its own not-found screen for unknown paths).
const APP_ROUTES = new Set([
  '/',
  '/send-files',
  '/receive-files',
  '/send-text',
  '/receive-text',
  '/about',
  '/help',
  '/privacy',
  '/terms',
  '/contact'
]);

app.get('*', (req, res) => {
  const route = req.path.length > 1 ? req.path.replace(/\/+$/, '') : req.path;
  // Unknown paths still get the app shell (it renders its own not-found page)
  // but with a real 404 status, so search engines don't index them.
  res.status(APP_ROUTES.has(route) ? 200 : 404).sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.use(errorHandler);

/**
 * Connects to MongoDB, then removes expired shares on boot and on a timer.
 * The server only starts listening once the database is reachable.
 */
async function init() {
  config.assertConfigured();
  await db.connect();

  const runCleanup = () =>
    shareService.cleanupExpired().catch((err) => console.error('Cleanup failed:', err));
  runCleanup();
  setInterval(runCleanup, config.cleanupIntervalMs).unref();
}

if (require.main === module) {
  init()
    .then(() => {
      const server = app.listen(config.port, '0.0.0.0', () => {
        console.log(`Local:            http://localhost:${config.port}`);
        const lanAddresses = getLanAddresses();
        if (lanAddresses.length) {
          lanAddresses.forEach((address) => {
            console.log(`On Your Network:  http://${address}:${config.port}`);
          });
        } else {
          console.log('On Your Network:  no network interface detected');
        }
      });

      // Let in-flight requests finish, then close the database, on deploys/restarts.
      let closing = false;
      const shutdown = (signal) => {
        if (closing) return;
        closing = true;
        console.log(`${signal} received, shutting down...`);
        const force = setTimeout(() => process.exit(1), 10_000);
        force.unref();
        server.close(async () => {
          await db.disconnect().catch(() => {});
          process.exit(0);
        });
      };
      process.on('SIGTERM', () => shutdown('SIGTERM'));
      process.on('SIGINT', () => shutdown('SIGINT'));
    })
    .catch((err) => {
      console.error('Startup failed:', err.message || err);
      process.exit(1);
    });
}

app.init = init;

module.exports = app;
