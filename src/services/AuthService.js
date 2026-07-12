// ============================================================
// src/services/AuthService.js
// Login/signup via emailed OTP, generated & delivered by an n8n
// workflow (n8n owns: code generation, SMTP delivery, "have we seen
// this email before" lookup in its own Data Table). Butler owns:
// holding the code server-side and verifying it, and the real User
// record / session once verification succeeds.
//
// IMPORTANT: the n8n webhook's response includes the raw code. This
// service is the ONLY thing allowed to call that webhook — never call
// N8N_OTP_WEBHOOK_URL from client-side JS, or the code (and therefore
// the whole point of emailing it) leaks straight to the browser.
// ============================================================

const jwt = require("jsonwebtoken");
const User = require("../models/User");
const OtpChallenge = require("../models/OtpChallenge");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_RE = /^\d{4,8}$/;
const RESEND_COOLDOWN_MS = 30 * 1000; // 30s between OTP requests per email
const SESSION_TTL = "7d";

function getConfig() {
  return {
    webhookUrl: process.env.N8N_OTP_WEBHOOK_URL || "",
    expiryMinutes: Number(process.env.OTP_EXPIRY_MINUTES) || 5,
    maxAttempts: Number(process.env.OTP_MAX_ATTEMPTS) || 5,
    jwtSecret: process.env.JWT_SECRET || "change-me",
  };
}

class AuthService {
  /**
   * Calls the n8n "send-otp" webhook, stores the code it returns
   * server-side (with an expiry), and never forwards the code itself
   * to whoever called this function.
   */
  async requestOtp({ email, name }) {
    const { webhookUrl, expiryMinutes } = getConfig();
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new Error("Enter a valid email address.");
    }
    if (!webhookUrl) {
      throw new Error("OTP delivery is not configured (missing N8N_OTP_WEBHOOK_URL).");
    }

    // Simple resend cooldown so a user (or a script) can't hammer the
    // email/n8n webhook by repeatedly requesting codes.
    const existing = await OtpChallenge.findOne({ email: normalizedEmail });
    if (existing) {
      const elapsed = Date.now() - existing.updatedAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const waitSeconds = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        throw new Error(`Please wait ${waitSeconds}s before requesting another code.`);
      }
    }

    let response;
    try {
      response = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail, name: String(name || "").trim() }),
      });
    } catch (err) {
      throw new Error(`Could not reach the OTP service: ${err.message}`);
    }

    if (!response.ok) {
      throw new Error(`OTP service returned HTTP ${response.status}.`);
    }

    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      throw new Error("OTP service returned an unexpected (non-JSON) response.");
    }

    if (!payload || !payload.ok || !payload.code) {
      throw new Error("OTP service did not return a code.");
    }

    const expiresAt = new Date(Date.now() + expiryMinutes * 60 * 1000);

    await OtpChallenge.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        code: String(payload.code),
        name: payload.name || name || "",
        isNewUser: Boolean(payload.isNew),
        attempts: 0,
        expiresAt,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Deliberately excludes the code — only the emailed message should have it.
    return {
      isNew: Boolean(payload.isNew),
      name: payload.name || "",
      expiresInMinutes: expiryMinutes,
    };
  }

  /**
   * Compares a user-submitted code against the stored challenge.
   * On success, promotes/updates the User record and issues a JWT.
   */
  async verifyOtp({ email, code }) {
    const { maxAttempts, jwtSecret } = getConfig();
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const submittedCode = String(code || "").trim();

    if (!EMAIL_RE.test(normalizedEmail)) {
      throw new Error("Enter a valid email address.");
    }
    if (!CODE_RE.test(submittedCode)) {
      throw new Error("Enter the code from your email.");
    }

    const challenge = await OtpChallenge.findOne({ email: normalizedEmail });
    if (!challenge) {
      throw new Error("No pending code for this email. Request a new one.");
    }
    if (challenge.expiresAt.getTime() < Date.now()) {
      await OtpChallenge.deleteOne({ _id: challenge._id });
      throw new Error("This code has expired. Request a new one.");
    }
    if (challenge.attempts >= maxAttempts) {
      await OtpChallenge.deleteOne({ _id: challenge._id });
      throw new Error("Too many incorrect attempts. Request a new code.");
    }

    if (challenge.code !== submittedCode) {
      challenge.attempts += 1;
      await challenge.save();
      const remaining = maxAttempts - challenge.attempts;
      throw new Error(`Incorrect code. ${remaining} attempt${remaining === 1 ? "" : "s"} left.`);
    }

    const wasNewUser = challenge.isNewUser;
    const resolvedName = challenge.name || "";

    const user = await User.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        name: resolvedName,
        verified: true,
        lastLoginAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    await OtpChallenge.deleteOne({ _id: challenge._id });

    const token = jwt.sign(
      { sub: String(user._id), email: user.email, name: user.name },
      jwtSecret,
      { expiresIn: SESSION_TTL }
    );

    return {
      token,
      user: { email: user.email, name: user.name },
      isNew: wasNewUser,
    };
  }

  /** Verifies a session cookie's JWT, returning its payload or null. */
  verifySessionToken(token) {
    if (!token) return null;
    try {
      return jwt.verify(token, getConfig().jwtSecret);
    } catch (_) {
      return null;
    }
  }
}

module.exports = new AuthService();
