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

module.exports = { makeOk, makeFail };
