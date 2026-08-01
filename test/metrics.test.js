const test = require("node:test");
const assert = require("node:assert/strict");

const { getRouteLabel, metricsRegistry } = require("../src/lib/metrics");

test("Prometheus route labels use Express route templates", () => {
  assert.equal(
    getRouteLabel({ baseUrl: "/api/tasks", route: { path: "/:taskId" } }),
    "/api/tasks/:taskId",
  );
  assert.equal(getRouteLabel({ route: { path: "/metrics" } }), "/metrics");
});

test("Prometheus route labels collapse unmatched URLs", () => {
  assert.equal(getRouteLabel({ path: "/random/value-1" }), "unmatched");
  assert.equal(getRouteLabel({ path: "/random/value-2" }), "unmatched");
});

test("database connection metric is collected from the current Mongoose state", async () => {
  const output = await metricsRegistry.getSingleMetricAsString("butler_db_connected");
  assert.match(output, /butler_db_connected 0/);
});
