const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const apiSource = fs.readFileSync(
  path.join(__dirname, "../src/public/js/api.js"),
  "utf8"
);

function loadApi() {
  const requests = [];
  let keyNumber = 0;
  const window = {
    crypto: {
      randomUUID() {
        keyNumber += 1;
        return `request-${keyNumber}`;
      },
    },
  };
  const context = {
    window,
    fetch: async (url, options) => {
      requests.push({ url, options });
      return {
        ok: true,
        status: 201,
        async json() {
          return { ok: true, data: { created: true } };
        },
      };
    },
  };

  vm.runInNewContext(apiSource, context);
  return { api: window.ButlerApi, requests };
}

test("task and event create operations share retry-safe request logic", async () => {
  const { api, requests } = loadApi();
  const createTask = api.createOperation("task");
  const createEvent = api.createOperation("event");

  await createTask("/tasks", { title: "First attempt" });
  await createTask("/tasks", { title: "Retry" });
  await createEvent("/calendar", { title: "Lecture", date: "2026-07-30" });

  assert.equal(requests[0].options.headers["Idempotency-Key"], "request-1");
  assert.equal(requests[1].options.headers["Idempotency-Key"], "request-1");
  assert.equal(requests[2].options.headers["Idempotency-Key"], "request-2");
  assert.deepEqual(
    requests.map((request) => [request.options.method, request.url]),
    [
      ["POST", "/api/tasks"],
      ["POST", "/api/tasks"],
      ["POST", "/api/calendar"],
    ]
  );
});
