// ============================================================
// src/lib/cookies.js
// Tiny cookie read/write helpers. Deliberately dependency-free
// (no cookie-parser) since the app only ever needs a single
// httpOnly session cookie.
// ============================================================

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "butler_session";

/**
 * Reads a named cookie value out of a raw "Cookie" request header.
 */
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;

  const parts = header.split(";");
  for (const part of parts) {
    const eq = part.indexOf("=");
    if (eq === -1) continue;
    const key = part.slice(0, eq).trim();
    if (key === name) {
      return decodeURIComponent(part.slice(eq + 1).trim());
    }
  }
  return null;
}

function readSessionCookie(req) {
  return readCookie(req, SESSION_COOKIE_NAME);
}

/**
 * Sets the session cookie. httpOnly + SameSite=Lax so it is never
 * readable from client JS and is not sent on cross-site requests.
 * `Secure` is added automatically outside development so local HTTP
 * testing still works.
 */
function setSessionCookie(res, token, maxAgeMs) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAgeSeconds = Math.floor(maxAgeMs / 1000);
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
  );
}

function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}

module.exports = {
  SESSION_COOKIE_NAME,
  readSessionCookie,
  setSessionCookie,
  clearSessionCookie,
};
