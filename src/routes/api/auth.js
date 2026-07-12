// ============================================================
// src/routes/api/auth.js
// Login/signup via emailed OTP (n8n sends it, Butler verifies it).
//
//   POST /api/auth/request-otp  -> { email, name } triggers n8n email
//   POST /api/auth/verify-otp   -> { email, code } checks it, sets session
//   GET  /api/auth/me           -> current logged-in user, if any
// ============================================================

const express = require("express");
const AuthService = require("../../services/AuthService");
const { makeOk, makeFail } = require("../../lib/apiResponse");

const router = express.Router();

const SESSION_COOKIE = "butler_session";
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days, matches the JWT's own expiry

/**
 * POST /api/auth/request-otp
 * Body: { email, name }
 */
router.post("/request-otp", async (req, res) => {
  try {
    const { email, name } = req.body;
    const result = await AuthService.requestOtp({ email, name });
    res.json(makeOk(result));
  } catch (err) {
    console.error("[api/auth] request-otp error:", err.message);
    res.status(400).json(makeFail(err.message));
  }
});

/**
 * POST /api/auth/verify-otp
 * Body: { email, code }
 */
router.post("/verify-otp", async (req, res) => {
  try {
    const { email, code } = req.body;
    const result = await AuthService.verifyOtp({ email, code });

    res.cookie(SESSION_COOKIE, result.token, {
      httpOnly: true,
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE_MS,
      secure: process.env.NODE_ENV === "production",
    });

    res.json(makeOk({ user: result.user, isNew: result.isNew }));
  } catch (err) {
    console.error("[api/auth] verify-otp error:", err.message);
    res.status(400).json(makeFail(err.message));
  }
});

/**
 * GET /api/auth/me
 * Reads the session cookie, if any, and returns the logged-in user.
 * Does not require auth — used by the frontend to check login state.
 */
router.get("/me", (req, res) => {
  const token = req.cookies ? req.cookies[SESSION_COOKIE] : null;
  const payload = AuthService.verifySessionToken(token);
  if (!payload) {
    return res.status(401).json(makeFail("Not logged in."));
  }
  res.json(makeOk({ user: { email: payload.email, name: payload.name } }));
});

module.exports = router;
