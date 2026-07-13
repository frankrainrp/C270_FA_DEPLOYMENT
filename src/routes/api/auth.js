// ============================================================
// src/routes/api/auth.js
// Email + OTP auth endpoints. See AuthService.js for the n8n
// webhook call and PendingOtp/Session bookkeeping.
//
// POST /api/auth/request-otp  { email, name? } -> { isNew, name }
// POST /api/auth/verify-otp   { email, code }  -> { name } + sets
//                                                  the session cookie
// ============================================================

const express = require("express");
const AuthService = require("../../services/AuthService");
const { setSessionCookie } = require("../../lib/cookies");
const { makeOk, makeFail } = require("../../lib/apiResponse");

const router = express.Router();

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

router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body || {};
    const session = await AuthService.verifyOtp(email, code);

    const maxAgeMs = session.sessionTtlDays * 24 * 60 * 60 * 1000;
    setSessionCookie(res, session.token, maxAgeMs);

    res.json(makeOk({ name: session.name, email: session.email }));
  } catch (err) {
    const status = err.status || 500;
    if (status >= 500) console.error("[api/auth] verify-otp error:", err.message);
    res.status(status).json(makeFail(err.message));
  }
});

module.exports = router;
