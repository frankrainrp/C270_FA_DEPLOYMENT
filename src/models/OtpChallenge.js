// ============================================================
// src/models/OtpChallenge.js
// Short-lived, server-side-only record of "a code was emailed to
// this address and hasn't been used yet." The code itself never
// leaves the backend — it's compared here, not in the browser and
// not in n8n.
//
// One active challenge per email (upsert on request, delete on
// success). expiresAt uses a TTL index (`expires: 0`) so MongoDB
// automatically reaps expired/abandoned challenges on its own.
// ============================================================

const mongoose = require("mongoose");

const OtpChallengeSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
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
    // NOTE: named isNewUser, not isNew — Mongoose documents already have a
    // built-in `.isNew` property (tracks "has this doc been saved yet?"),
    // and a schema field with that exact name would collide with it.
    isNewUser: {
      type: Boolean,
      default: true,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    // TTL index: Mongo deletes this document once the current time
    // passes the value stored here (expires: 0 means "no extra delay").
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("OtpChallenge", OtpChallengeSchema);
