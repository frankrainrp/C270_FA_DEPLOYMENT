// ============================================================
// public/js/api.js
// Thin fetch wrapper around the /api/* JSON endpoints.
// Every API response follows the { ok, data } / { ok, error } envelope
// defined in src/lib/apiResponse.js.
// ============================================================

(function initApi() {
  var API_BASE = "/api";

  async function request(method, path, body) {
    var res = await fetch(API_BASE + path, {
      method: method,
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
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

  window.ButlerApi = {
    get:    function (path)       { return request("GET",    path); },
    post:   function (path, body) { return request("POST",   path, body); },
    put:    function (path, body) { return request("PUT",    path, body); },
    patch:  function (path, body) { return request("PATCH",  path, body); },
    del:    function (path)       { return request("DELETE", path); },
  };
})();
