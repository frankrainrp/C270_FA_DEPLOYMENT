// ============================================================
// src/models/Session.js
// Stores an opaque browser session token and its server-side user
// identity. MongoDB removes expired sessions through the TTL index.
// ============================================================

const mongoose = require("mongoose");

const SessionSchema = new mongoose.Schema(
  {
    token: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", SessionSchema);
