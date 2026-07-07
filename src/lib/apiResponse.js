// ============================================================
// src/lib/apiResponse.js
// Standard JSON envelope for all /api/* JSON endpoints.
// Every API response is either { ok: true, data } or { ok: false, error }.
// Streaming SSE endpoints (POST /api/chat) do NOT use this envelope.
// ============================================================

function makeOk(data) {
  return { ok: true, data };
}

function makeFail(error) {
  return { ok: false, error: String(error || "Unknown error") };
}

// Wraps an async Express handler and forwards thrown errors to next().
// Lets route files stay flat instead of nesting try/catch everywhere.
function runSafe(handler) {
  return function safeHandler(req, res, next) {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

module.exports = { makeOk, makeFail, runSafe };
