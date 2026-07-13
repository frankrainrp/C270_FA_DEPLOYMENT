// ============================================================
// src/lib/authGuard.js
// Global auth middleware. Attaches the logged-in user (if any) to
// every request, and — when AUTH_REQUIRED is enabled — redirects
// signed-out visitors to /auth/login for any page that isn't on the
// public whitelist. API requests get a 401 JSON body instead of a
// redirect, since the browser JS layer expects an envelope response.
//
// AUTH_REQUIRED defaults to "true". Set AUTH_REQUIRED=false in .env
// as a local escape hatch while other pages are still under active
// development and the n8n OTP webhook may not be configured yet —
// flip it back to true before the real login page ships.
// ============================================================

const AuthService = require("../services/AuthService");
const { readSessionCookie } = require("./cookies");
const { makeFail } = require("./apiResponse");

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";

const PUBLIC_EXACT_PATHS = new Set(["/auth/login", "/api/health"]);

function isPublicPath(path) {
  if (PUBLIC_EXACT_PATHS.has(path)) return true;
  if (path.startsWith("/api/auth/")) return true;
  return false;
}

async function authGuard(req, res, next) {
  try {
    const token = readSessionCookie(req);
    const session = token ? await AuthService.getSessionByToken(token) : null;

    if (session) {
      req.currentUser = { email: session.email, name: session.name };
      res.locals.authProfile = {
        name: session.name || session.email,
        email: session.email,
        imageUrl: "",
      };
      res.locals.isLoggedIn = true;
      return next();
    }

    res.locals.isLoggedIn = false;

    if (!AUTH_REQUIRED || isPublicPath(req.path)) {
      return next();
    }

    if (req.path.startsWith("/api/")) {
      return res.status(401).json(makeFail("Not signed in."));
    }

    const nextUrl = encodeURIComponent(req.originalUrl || "/chat");
    return res.redirect(`/auth/login?next=${nextUrl}`);
  } catch (err) {
    console.error("[authGuard] unexpected error, failing open:", err.message);
    // A DB hiccup shouldn't 500 every page — the rest of the app
    // already tolerates MongoDB being briefly unavailable.
    res.locals.isLoggedIn = false;
    return next();
  }
}

module.exports = { authGuard, AUTH_REQUIRED };
