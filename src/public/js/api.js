// ============================================================
// public/js/api.js
// Thin fetch wrapper around the /api/* JSON endpoints.
// Every API response follows the { ok, data } / { ok, error } envelope
// defined in src/lib/apiResponse.js.
// ============================================================

(function initApi() {
  var API_BASE = "/api";

  function uniqueIdempotencyKey(scope) {
    if (window.crypto && window.crypto.randomUUID) {
      return window.crypto.randomUUID();
    }
    return String(scope || "create") + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  async function request(method, path, body, options) {
    var extraHeaders = options && options.headers ? options.headers : {};
    var res = await fetch(API_BASE + path, {
      method: method,
      credentials: "same-origin",
      headers: Object.assign({ "Content-Type": "application/json" }, extraHeaders),
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    var payload = null;
    try {
      payload = await res.json();
    } catch (_) {
      throw new Error("API response was not JSON (" + res.status + ").");
    }

    if (!res.ok || !payload || payload.ok === false) {
      var reason = (payload && payload.error) || ("HTTP " + res.status);
      throw new Error(reason);
    }
    return payload.data;
  }

  /**
   * Creates a retry-safe POST operation. Reusing the returned function reuses
   * the same idempotency key; creating a new operation produces a new key.
   */
  function createOperation(scope) {
    var idempotencyKey = uniqueIdempotencyKey(scope);
    return function create(path, body) {
      return request("POST", path, body, {
        headers: { "Idempotency-Key": idempotencyKey },
      });
    };
  }

  window.ButlerApi = {
    get:    function (path)       { return request("GET",    path); },
    post:   function (path, body, options) { return request("POST", path, body, options); },
    createOperation: createOperation,
    put:    function (path, body) { return request("PUT",    path, body); },
    patch:  function (path, body) { return request("PATCH",  path, body); },
    del:    function (path)       { return request("DELETE", path); },
  };
})();
