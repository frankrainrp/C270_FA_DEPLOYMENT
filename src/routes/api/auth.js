// ============================================================
// src/routes/api/auth.js
// Exposes the remote-style email OTP endpoints and writes an opaque
// Session token to the httpOnly Butler cookie after verification.
// ============================================================

const express = require("express");
const AuthService = require("../../services/AuthService");
const { readSessionCookie, setSessionCookie } = require("../../lib/cookies");
const { makeOk, makeFail } = require("../../lib/apiResponse");

const router = express.Router();

/** Requests an emailed OTP and returns only non-secret challenge metadata. */
router.post("/request-otp", async (req, res) => {
  try {
    const { email, name } = req.body || {};
    const result = await AuthService.requestOtp(email, name);
    res.json(makeOk(result));
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[api/auth] request-otp error:", err.message);
    res.status(status).json(makeFail(err.message));
  }
});

/** Verifies an OTP, creates a MongoDB Session, and sets its opaque cookie. */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const session = await AuthService.verifyOtp(email, code);
    const maxAgeMs = session.sessionTtlDays * 24 * 60 * 60 * 1000;
    setSessionCookie(res, session.token, maxAgeMs);
    res.json(makeOk({
      user: { email: session.email, name: session.name },
      isNew: session.isNew,
    }));
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[api/auth] verify-otp error:", err.message);
    res.status(status).json(makeFail(err.message));
  }
});

/** Creates a localhost demo session when LOCAL_DEMO_MODE is explicitly enabled. */
router.post("/demo", async (_req, res) => {
  try {
    const session = await AuthService.createLocalDemoSession();
    const maxAgeMs = session.sessionTtlDays * 24 * 60 * 60 * 1000;
    setSessionCookie(res, session.token, maxAgeMs);
    res.json(makeOk({
      user: { email: session.email, name: session.name },
      demo: true,
    }));
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[api/auth] demo login error:", err.message);
    res.status(status).json(makeFail(err.message));
  }
});

/** Returns the identity attached to the current unexpired server-side Session. */
router.get("/me", async (req, res) => {
  try {
    const token = req.sessionToken || readSessionCookie(req);
    const session = req.sessionUser || await AuthService.getSessionByToken(token);
    if (!session) return res.status(401).json(makeFail("Not logged in."));
    return res.json(makeOk({ user: { email: session.email, name: session.name } }));
  } catch (err) {
    console.error("[api/auth] session lookup error:", err.message);
    return res.status(503).json(makeFail("The login service is temporarily unavailable."));
  }
});

module.exports = router;
