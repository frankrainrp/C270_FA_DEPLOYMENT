// ============================================================
// src/models/PendingOtp.js
// A short-lived, single-use OTP challenge for one email address.
//
// IMPORTANT: the code lives ONLY here, server-side. It is generated
// by the n8n workflow and handed to AuthService.requestOtp(), which
// stores it in this collection and never returns it to the browser.
// The n8n "Respond to Webhook" node happens to include the code in
// its own response for its own debugging/testing purposes — Butler's
// backend deliberately drops that field before responding to the
// client. See AuthService.js.
//
// `expiresAt` has a TTL index so Mongo automatically deletes expired
// / used challenges without any manual cleanup job.
// ============================================================

const mongoose = require("mongoose");

const PendingOtpSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    name: {
      type: String,
      trim: true,
      default: "",
    },
    // Named isNewUser (not isNew) because Mongoose reserves `isNew` as a
    // built-in document property (whether it's been saved yet) — reusing
    // that name causes a schema warning and unreliable field behavior.
    isNewUser: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
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

// TTL index: MongoDB removes the document once expiresAt passes.
PendingOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PendingOtp", PendingOtpSchema);
