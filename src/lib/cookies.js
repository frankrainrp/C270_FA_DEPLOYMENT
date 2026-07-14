// ============================================================
// src/lib/cookies.js
// Reads, writes, and clears Butler's single httpOnly session cookie
// without exposing the opaque token to client-side JavaScript.
// ============================================================

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "butler_session";

/** Reads one named cookie from the raw Cookie request header. */
function readCookie(req, name) {
  const header = req.headers && req.headers.cookie;
  if (!header) return null;

  for (const part of header.split(";")) {
    const separator = part.indexOf("=");
    if (separator === -1) continue;
    const key = part.slice(0, separator).trim();
    if (key !== name) continue;

    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch (_) {
      return null;
    }
  }
  return null;
}

/** Reads the configured Butler session cookie from a request. */
function readSessionCookie(req) {
  return readCookie(req, SESSION_COOKIE_NAME);
}

/** Writes an opaque session token as a secure, httpOnly cookie. */
function setSessionCookie(res, token, maxAgeMs) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  const maxAgeSeconds = Math.floor(maxAgeMs / 1000);
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAgeSeconds}${secure}`
  );
}

/** Expires the Butler session cookie immediately. */
function clearSessionCookie(res) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`
  );
}

module.exports = {
  SESSION_COOKIE_NAME,
  readCookie,
  readSessionCookie,
  setSessionCookie,
  clearSessionCookie,
};
