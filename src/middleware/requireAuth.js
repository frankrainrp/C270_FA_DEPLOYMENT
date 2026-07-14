// ============================================================
// src/middleware/requireAuth.js
// Provides route-level page and API guards backed by MongoDB Session
// records. The global authGuard normally preloads req.sessionUser;
// these guards remain a defensive boundary on account-owned routes.
// ============================================================

const AuthService = require("../services/AuthService");
const { readSessionCookie } = require("../lib/cookies");
const { makeFail } = require("../lib/apiResponse");

/** Resolves and caches the current request's authenticated Session identity. */
async function getSessionUser(req) {
  if (req.sessionUser) return req.sessionUser;

  const token = req.sessionToken || readSessionCookie(req);
  const session = token ? await AuthService.getSessionByToken(token) : null;
  if (!session) return null;

  req.sessionToken = token;
  req.sessionUser = { email: session.email, name: session.name };
  return req.sessionUser;
}

/** Redirects signed-out HTML requests to login and preserves the target URL. */
async function requireAuthPage(req, res, next) {
  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      const nextUrl = encodeURIComponent(req.originalUrl || "/");
      return res.redirect(`/auth/login?next=${nextUrl}`);
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

/** Returns HTTP 401 for signed-out JSON API requests. */
async function requireAuthApi(req, res, next) {
  try {
    const sessionUser = await getSessionUser(req);
    if (!sessionUser) {
      return res.status(401).json(makeFail("Please sign in to continue."));
    }
    return next();
  } catch (err) {
    return next(err);
  }
}

module.exports = { requireAuthPage, requireAuthApi, getSessionUser };
