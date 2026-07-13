// ============================================================
// src/services/AuthService.js
// Email + OTP login, backed by the "send-otp" n8n workflow.
//
// Flow:
//   1. requestOtp(email, name) calls the n8n webhook, which generates
//      a 6-digit code, upserts the user in n8n's own "users" data
//      table, and emails the code via SMTP. n8n's response also
//      happens to include the code (useful for n8n-side debugging),
//      but this service stores it server-side in PendingOtp and
//      strips it before anything goes back to the browser.
//   2. verifyOtp(email, code) checks the stored PendingOtp, and on a
//      match creates a Session and deletes the (single-use) OTP.
//
// n8n owns user identity (email/name); Butler owns the ephemeral
// security artifacts (pending codes, sessions) in its own MongoDB,
// consistent with how the rest of the app is built.
// ============================================================

const crypto = require("crypto");
const mongoose = require("mongoose");
const PendingOtp = require("../models/PendingOtp");
const Session = require("../models/Session");

const N8N_OTP_WEBHOOK_URL = process.env.N8N_OTP_WEBHOOK_URL || "";
const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES) > 0 ? Number(process.env.OTP_TTL_MINUTES) : 5;
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) > 0 ? Number(process.env.SESSION_TTL_DAYS) : 30;
const MAX_VERIFY_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ------------------------------------------------------------------
// Minimal in-memory rate limit for OTP requests: N per email per
// window. This is a security guard against someone hammering a
// stranger's inbox with codes; it is intentionally NOT persisted —
// worst case on a restart is the limiter resets, which is an
// acceptable trade-off for a coursework app.
// ------------------------------------------------------------------
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestLog = new Map();

function isRateLimited(email) {
  const now = Date.now();
  const recent = (requestLog.get(email) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  recent.push(now);
  requestLog.set(email, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

function httpError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// mongoose.set("bufferCommands", false) in app.js means any query
// attempted before the connection is fully open throws immediately
// with a low-level Mongoose message. Checking readyState up front
// lets every login/signup path fail with one clear, user-facing
// message instead of that raw error leaking to the browser.
function assertDatabaseReady() {
  if (mongoose.connection.readyState !== 1) {
    throw httpError("The database isn't ready yet. Please wait a moment and try again.", 503);
  }
}

/**
 * Ask n8n to generate + email an OTP code for this email address.
 * Returns only { isNew, name, expiresInSeconds } — never the code.
 */
async function requestOtp(email, name) {
  assertDatabaseReady();

  const normalizedEmail = String(email || "").trim().toLowerCase();

  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    throw httpError("Enter a valid email address.", 400);
  }

  if (isRateLimited(normalizedEmail)) {
    throw httpError("Too many code requests for this email. Try again in a few minutes.", 429);
  }

  if (!N8N_OTP_WEBHOOK_URL) {
    throw httpError("OTP delivery is not configured yet. Set N8N_OTP_WEBHOOK_URL in .env.", 503);
  }

  let payload;
  try {
    const response = await fetch(N8N_OTP_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, name: String(name || "").trim() }),
    });

    if (!response.ok) {
      throw new Error(`n8n webhook responded with HTTP ${response.status}`);
    }

    payload = await response.json();
  } catch (err) {
    console.error("[AuthService] requestOtp: n8n webhook call failed:", err.message);
    throw httpError("Could not send the verification code right now. Please try again.", 502);
  }

  const code = String((payload && payload.code) || "").trim();
  if (!code) {
    throw httpError("The code delivery service did not return a code.", 502);
  }

  const resolvedName = (payload && payload.name) || String(name || "").trim();
  const isNewUser = Boolean(payload && payload.isNew);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  // Only one active challenge per email at a time.
  await PendingOtp.deleteMany({ email: normalizedEmail });
  await PendingOtp.create({
    email: normalizedEmail,
    code,
    name: resolvedName,
    isNewUser,
    expiresAt,
  });

  // API response key stays "isNew" for the browser — only the Mongoose
  // field is renamed, since that's the one that collided with the
  // reserved `Document.isNew` property.
  return {
    isNew: isNewUser,
    name: resolvedName,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
  };
}

/**
 * Verify a submitted code and, on success, create a logged-in
 * Session. Throws on any invalid/expired/mismatched code.
 */
async function verifyOtp(email, code) {
  assertDatabaseReady();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const submittedCode = String(code || "").trim();

  if (!normalizedEmail || !submittedCode) {
    throw httpError("Email and code are required.", 400);
  }

  const pending = await PendingOtp.findOne({ email: normalizedEmail });
  if (!pending) {
    throw httpError("That code expired or was never requested. Request a new one.", 400);
  }

  if (pending.attempts >= MAX_VERIFY_ATTEMPTS) {
    await PendingOtp.deleteOne({ _id: pending._id });
    throw httpError("Too many incorrect attempts. Request a new code.", 429);
  }

  if (pending.code !== submittedCode) {
    pending.attempts += 1;
    await pending.save();
    throw httpError("Incorrect code.", 400);
  }

  // Correct + single-use: consume it immediately.
  await PendingOtp.deleteOne({ _id: pending._id });

  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await Session.create({
    token,
    email: normalizedEmail,
    name: pending.name || "",
    expiresAt,
  });

  return {
    token,
    email: normalizedEmail,
    name: pending.name || "",
    expiresAt,
    sessionTtlDays: SESSION_TTL_DAYS,
  };
}

async function getSessionByToken(token) {
  if (!token) return null;
  return Session.findOne({ token, expiresAt: { $gt: new Date() } });
}

async function destroySession(token) {
  if (!token) return;
  await Session.deleteOne({ token });
}

module.exports = { requestOtp, verifyOtp, getSessionByToken, destroySession };
