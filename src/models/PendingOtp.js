// ============================================================
// src/models/PendingOtp.js
// Stores one short-lived, single-use OTP challenge per email.
// The code is kept server-side and removed after successful
// verification or automatically by MongoDB after it expires.
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
  { timestamps: true }
);

PendingOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("PendingOtp", PendingOtpSchema);
