'use strict';

const { mongoose } = require('../db');

const { Schema } = mongoose;

/**
 * One uploaded file. The bytes live in Google Drive; only metadata is here.
 * `id` is the public identifier used in download URLs, `driveFileId` never
 * leaves the server.
 */
const fileSchema = new Schema(
  {
    id: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true, default: 'application/octet-stream' },
    size: { type: Number, required: true },
    driveFileId: { type: String, required: true },
    position: { type: Number, required: true, default: 0 },
    downloads: { type: Number, required: true, default: 0 }
  },
  { _id: false }
);

/**
 * A share: the 6-digit code, its limits and counters, and either the text
 * itself or the metadata of the files sent under that code.
 * Times are epoch milliseconds, same as the API has always returned.
 */
const shareSchema = new Schema(
  {
    code: { type: String, required: true, unique: true, match: /^\d{6}$/ },
    type: { type: String, required: true, enum: ['text', 'file'] },
    content: { type: String, default: null },
    passwordHash: { type: String, default: null },

    // Limits (null = unlimited)
    maxViews: { type: Number, default: null },
    expiresAt: { type: Number, default: null },

    // Counters
    views: { type: Number, required: true, default: 0 },
    downloads: { type: Number, required: true, default: 0 },

    createdAt: { type: Number, required: true },
    lastViewedAt: { type: Number, default: null },

    files: { type: [fileSchema], default: [] }
  },
  { versionKey: false }
);

// No TTL index on purpose: a document must not vanish before its Drive files
// are deleted. The cleanup job in shareService removes both together.
shareSchema.index({ expiresAt: 1 });
shareSchema.index({ maxViews: 1, lastViewedAt: 1 });

module.exports = mongoose.models.Share || mongoose.model('Share', shareSchema);
