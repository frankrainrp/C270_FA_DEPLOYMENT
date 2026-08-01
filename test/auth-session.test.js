const test = require("node:test");
const assert = require("node:assert/strict");

const {
  readCookie,
  readSessionCookie,
  setSessionCookie,
  clearSessionCookie,
} = require("../src/lib/cookies");
const AuthService = require("../src/services/AuthService");
const { isPublicPath } = require("../src/lib/authGuard");

/** Builds the minimal response object required by the cookie helpers. */
function createResponseRecorder() {
  const headers = new Map();
  return {
    setHeader(name, value) {
      headers.set(String(name).toLowerCase(), value);
    },
    getHeader(name) {
      return headers.get(String(name).toLowerCase());
    },
  };
}

test("cookie helpers read the opaque Butler session token", () => {
  const req = {
    headers: {
      cookie: "theme=dark; butler_session=token%20with%20spaces; lang=en",
    },
  };

  assert.equal(readCookie(req, "theme"), "dark");
  assert.equal(readSessionCookie(req), "token with spaces");
  assert.equal(readCookie(req, "missing"), null);
});

test("session cookie is httpOnly and can be expired", () => {
  const res = createResponseRecorder();

  setSessionCookie(res, "opaque-token", 60_000);
  assert.match(res.getHeader("Set-Cookie"), /^butler_session=opaque-token;/);
  assert.match(res.getHeader("Set-Cookie"), /HttpOnly/);
  assert.match(res.getHeader("Set-Cookie"), /SameSite=Lax/);
  assert.match(res.getHeader("Set-Cookie"), /Max-Age=60/);

  clearSessionCookie(res);
  assert.match(res.getHeader("Set-Cookie"), /Max-Age=0/);
});

test("active auth service exposes MongoDB session operations instead of JWT operations", () => {
  assert.equal(typeof AuthService.requestOtp, "function");
  assert.equal(typeof AuthService.verifyOtp, "function");
  assert.equal(typeof AuthService.getSessionByToken, "function");
  assert.equal(typeof AuthService.destroySession, "function");
  assert.equal(typeof AuthService.createLocalDemoSession, "function");
  assert.equal(typeof AuthService.isLocalDemoMode, "function");
  assert.equal(AuthService.verifySessionToken, undefined);
  assert.equal(AuthService.issueSessionToken, undefined);
});

test("global auth guard keeps login, probe, and Prometheus scrape endpoints public", () => {
  assert.equal(isPublicPath("/auth/login"), true);
  assert.equal(isPublicPath("/api/live"), true);
  assert.equal(isPublicPath("/api/health"), true);
  assert.equal(isPublicPath("/metrics"), true);
  assert.equal(isPublicPath("/api/auth/request-otp"), true);
  assert.equal(isPublicPath("/api/tasks"), false);
});

test("local demo login is opt-in", () => {
  const previous = process.env.LOCAL_DEMO_MODE;
  delete process.env.LOCAL_DEMO_MODE;
  assert.equal(AuthService.isLocalDemoMode(), false);
  process.env.LOCAL_DEMO_MODE = "true";
  assert.equal(AuthService.isLocalDemoMode(), true);
  if (previous === undefined) delete process.env.LOCAL_DEMO_MODE;
  else process.env.LOCAL_DEMO_MODE = previous;
});
