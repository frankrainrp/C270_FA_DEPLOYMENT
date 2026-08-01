// ============================================================
// src/lib/authGuard.js
// Resolves the server-side Session for every routed request, exposes
// the authenticated identity to downstream handlers, and applies the
// remote branch's global login gate when AUTH_REQUIRED is enabled.
// ============================================================

const AuthService = require("../services/AuthService");
const { readSessionCookie } = require("./cookies");
const { makeFail } = require("./apiResponse");

const AUTH_REQUIRED = process.env.AUTH_REQUIRED !== "false";
const PUBLIC_EXACT_PATHS = new Set(["/auth/login", "/api/live", "/api/health", "/metrics"]);

/** Returns true when a request may be served without a login session. */
function isPublicPath(path) {
  return PUBLIC_EXACT_PATHS.has(path) || path.startsWith("/api/auth/");
}

/** Loads the current Session and enforces the global page/API login policy. */
async function authGuard(req, res, next) {
  try {
    const token = readSessionCookie(req);
    const session = token ? await AuthService.getSessionByToken(token) : null;

    if (session) {
      req.sessionToken = token;
      req.sessionUser = { email: session.email, name: session.name };
      res.locals.authProfile = {
        name: session.name || session.email,
        email: session.email,
        imageUrl: "",
      };
      res.locals.isLoggedIn = true;
      return next();
    }

    res.locals.isLoggedIn = false;
    if (!AUTH_REQUIRED || isPublicPath(req.path)) return next();

    if (req.path.startsWith("/api/")) {
      return res.status(401).json(makeFail("Not signed in."));
    }

    const nextUrl = encodeURIComponent(req.originalUrl || "/chat");
    return res.redirect(`/auth/login?next=${nextUrl}`);
  } catch (err) {
    console.error("[authGuard] session lookup failed:", err.message);
    if (req.path.startsWith("/api/")) {
      return res.status(503).json(makeFail("The login service is temporarily unavailable."));
    }
    return next(err);
  }
}

module.exports = { authGuard, AUTH_REQUIRED, isPublicPath };
