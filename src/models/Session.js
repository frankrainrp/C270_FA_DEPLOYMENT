// ============================================================
// src/models/Session.js
// A logged-in browser session, created after a successful OTP
// verification. The random `token` value is what's stored in the
// httpOnly `butler_session` cookie — the cookie itself never holds
// the email or any other identifying data directly.
//
// `expiresAt` has a TTL index so Mongo automatically deletes expired
// sessions without any manual cleanup job.
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
  {
    timestamps: true,
  }
);

SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Session", SessionSchema);
