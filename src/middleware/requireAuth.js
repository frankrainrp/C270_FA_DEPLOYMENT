// ============================================================
// src/middleware/requireAuth.js
// Shared login gate for the per-account data features (tasks, notes,
// calendar, chat, search). Reads the same butler_session cookie used
// everywhere else and resolves it via AuthService.verifySessionToken.
//
// Two flavors:
//   requireAuthPage — for HTML page routes (pages.js). Redirects an
//     unauthenticated visitor to /auth/login?next=<original url> so
//     they land back where they were headed after signing in.
//   requireAuthApi  — for JSON API routes (routes/api/*). Responds
//     401 instead of redirecting, since these are called by fetch().
//
// On success, both attach req.sessionUser = { sub, email, name } so
// downstream handlers never need to re-decode the cookie themselves.
// ============================================================

const AuthService = require("../services/AuthService");
const { makeFail } = require("../lib/apiResponse");

const SESSION_COOKIE = "butler_session";

function getSessionUser(req) {
  const token = req && req.cookies ? req.cookies[SESSION_COOKIE] : null;
  return AuthService.verifySessionToken(token);
}

function requireAuthPage(req, res, next) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    const next_ = encodeURIComponent(req.originalUrl || "/");
    return res.redirect(`/auth/login?next=${next_}`);
  }
  req.sessionUser = sessionUser;
  next();
}

function requireAuthApi(req, res, next) {
  const sessionUser = getSessionUser(req);
  if (!sessionUser) {
    return res.status(401).json(makeFail("Please sign in to continue."));
  }
  req.sessionUser = sessionUser;
  next();
}

module.exports = { requireAuthPage, requireAuthApi, getSessionUser };
