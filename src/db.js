'use strict';

/**
 * Database layer.
 *
 * MongoDB Atlas through Mongoose. The share model lives in models/Share.js;
 * this file only owns the connection.
 */

const mongoose = require('mongoose');
const config = require('./config');

mongoose.set('strictQuery', true);

let connecting = null;

/** Connects once and makes sure the indexes (notably the unique code) exist. */
function connect() {
  if (mongoose.connection.readyState === 1) return Promise.resolve(mongoose.connection);
  if (connecting) return connecting;

  connecting = (async () => {
    if (!config.mongo.uri) {
      throw new Error('MONGODB_URI is not set.');
    }
    await mongoose.connect(config.mongo.uri, {
      dbName: config.mongo.dbName,
      serverSelectionTimeoutMS: 10_000,
      maxPoolSize: 10
    });
    // Build indexes before serving traffic so the unique code index is in force.
    await require('./models/Share').init();
    return mongoose.connection;
  })().catch((error) => {
    connecting = null;
    throw error;
  });

  return connecting;
}

async function disconnect() {
  connecting = null;
  await mongoose.disconnect();
}

module.exports = { connect, disconnect, mongoose };
