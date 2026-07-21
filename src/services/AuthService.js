// ============================================================
// src/services/AuthService.js
// Implements the remote branch's email OTP flow. n8n generates and
// emails the code; Butler stores PendingOtp and opaque Session records
// in MongoDB and never returns the raw code to the browser.
// ============================================================

const crypto = require("crypto");
const mongoose = require("mongoose");
const PendingOtp = require("../models/PendingOtp");
const Session = require("../models/Session");

const OTP_TTL_MINUTES = Number(process.env.OTP_TTL_MINUTES) > 0
  ? Number(process.env.OTP_TTL_MINUTES)
  : 5;
const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS) > 0
  ? Number(process.env.SESSION_TTL_DAYS)
  : 30;
const MAX_VERIFY_ATTEMPTS = Number(process.env.OTP_MAX_ATTEMPTS) > 0
  ? Number(process.env.OTP_MAX_ATTEMPTS)
  : 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{4,8}$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const requestLog = new Map();

/** Returns true only for explicit truthy environment values. */
function envEnabled(value) {
  return /^(1|true|yes)$/i.test(String(value || ""));
}

/** The passwordless demo entry is deliberately limited to local demo setups. */
function isLocalDemoMode() {
  return envEnabled(process.env.LOCAL_DEMO_MODE);
}

/** Fails fast when production cannot reach the configured OTP delivery workflow. */
function assertProductionConfig() {
  if (
    process.env.NODE_ENV === "production"
    && !isLocalDemoMode()
    && !process.env.N8N_OTP_WEBHOOK_URL
  ) {
    throw new Error("N8N_OTP_WEBHOOK_URL must be configured in production.");
  }
}

/** Creates an Error carrying the HTTP status expected by the auth routes. */
function httpError(message, status) {
  const error = new Error(message);
  error.status = status;
  return error;
}

/** Rejects authentication operations until the MongoDB connection is ready. */
function assertDatabaseReady() {
  if (mongoose.connection.readyState !== 1) {
    throw httpError("The database isn't ready yet. Please wait a moment and try again.", 503);
  }
}

/** Records one OTP request and reports whether the email exceeded the rolling limit. */
function isRateLimited(email) {
  const now = Date.now();
  const recent = (requestLog.get(email) || []).filter(
    (timestamp) => now - timestamp < RATE_LIMIT_WINDOW_MS
  );
  recent.push(now);
  requestLog.set(email, recent);
  return recent.length > RATE_LIMIT_MAX_REQUESTS;
}

/** Creates one opaque, server-side session for a validated local identity. */
async function issueSession(email, name, isNew) {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);
  await Session.create({ token, email, name, expiresAt });

  return {
    token,
    email,
    name,
    isNew: Boolean(isNew),
    expiresAt,
    sessionTtlDays: SESSION_TTL_DAYS,
  };
}

/** Calls n8n, stores the returned OTP server-side, and returns only safe metadata. */
async function requestOtp(email, name) {
  assertDatabaseReady();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const normalizedName = String(name || "").trim();
  if (!normalizedEmail || !EMAIL_RE.test(normalizedEmail)) {
    throw httpError("Enter a valid email address.", 400);
  }
  if (isRateLimited(normalizedEmail)) {
    throw httpError("Too many code requests for this email. Try again in a few minutes.", 429);
  }

  const webhookUrl = process.env.N8N_OTP_WEBHOOK_URL || "";
  if (!webhookUrl) {
    throw httpError("OTP delivery is not configured yet. Set N8N_OTP_WEBHOOK_URL in .env.", 503);
  }

  let payload;
  try {
    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalizedEmail, name: normalizedName }),
    });
    if (!response.ok) {
      throw new Error(`n8n webhook responded with HTTP ${response.status}`);
    }
    payload = await response.json();
  } catch (err) {
    console.error("[AuthService] n8n OTP request failed:", err.message);
    throw httpError("Could not send the verification code right now. Please try again.", 502);
  }

  const code = String(payload && payload.code || "").trim();
  if (!CODE_RE.test(code)) {
    throw httpError("The code delivery service did not return a valid code.", 502);
  }

  const resolvedName = String(payload && payload.name || normalizedName).trim();
  const isNewUser = Boolean(payload && payload.isNew);
  const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

  await PendingOtp.deleteMany({ email: normalizedEmail });
  await PendingOtp.create({
    email: normalizedEmail,
    code,
    name: resolvedName,
    isNewUser,
    attempts: 0,
    expiresAt,
  });

  return {
    isNew: isNewUser,
    name: resolvedName,
    expiresInSeconds: OTP_TTL_MINUTES * 60,
  };
}

/** Verifies and consumes an OTP, then creates a server-side login Session. */
async function verifyOtp(email, code) {
  assertDatabaseReady();

  const normalizedEmail = String(email || "").trim().toLowerCase();
  const submittedCode = String(code || "").trim();
  if (!normalizedEmail || !submittedCode) {
    throw httpError("Email and code are required.", 400);
  }

  const pending = await PendingOtp.findOne({ email: normalizedEmail });
  if (!pending || pending.expiresAt.getTime() <= Date.now()) {
    if (pending) await PendingOtp.deleteOne({ _id: pending._id });
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

  await PendingOtp.deleteOne({ _id: pending._id });

  return issueSession(normalizedEmail, pending.name || "", pending.isNewUser);
}

/** Creates the fixed local-demo identity without depending on email delivery. */
async function createLocalDemoSession() {
  if (!isLocalDemoMode()) {
    throw httpError("Local demo login is disabled.", 404);
  }
  assertDatabaseReady();

  const configuredEmail = String(process.env.LOCAL_DEMO_EMAIL || "demo@butler.local")
    .trim()
    .toLowerCase();
  const email = EMAIL_RE.test(configuredEmail) ? configuredEmail : "demo@butler.local";
  const name = String(process.env.LOCAL_DEMO_NAME || "Demo Student").trim().slice(0, 80)
    || "Demo Student";

  return issueSession(email, name, false);
}

/** Resolves an unexpired server-side Session by its opaque token. */
async function getSessionByToken(token) {
  if (!token) return null;
  return Session.findOne({ token, expiresAt: { $gt: new Date() } });
}

/** Updates the display name stored with the active Session. */
async function updateSessionName(token, name) {
  if (!token) return null;
  return Session.findOneAndUpdate(
    { token, expiresAt: { $gt: new Date() } },
    { name: String(name || "").trim() },
    { new: true }
  );
}

/** Permanently destroys one server-side Session token. */
async function destroySession(token) {
  if (!token) return;
  await Session.deleteOne({ token });
}

module.exports = {
  requestOtp,
  verifyOtp,
  getSessionByToken,
  updateSessionName,
  destroySession,
  createLocalDemoSession,
  isLocalDemoMode,
  assertDatabaseReady,
  assertProductionConfig,
};
