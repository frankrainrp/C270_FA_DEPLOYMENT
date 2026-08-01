const client = require("prom-client");
const mongoose = require("mongoose");

client.collectDefaultMetrics({ prefix: "butler_" });

const httpRequestsTotal = new client.Counter({
  name: "butler_http_requests_total",
  help: "Total number of HTTP requests received by the Butler app.",
  labelNames: ["method", "route", "status"],
});

const httpRequestDurationSeconds = new client.Histogram({
  name: "butler_http_request_duration_seconds",
  help: "HTTP request latency in seconds.",
  labelNames: ["method", "route", "status"],
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
});

const dbConnected = new client.Gauge({
  name: "butler_db_connected",
  help: "1 when the application is connected to MongoDB, otherwise 0.",
  collect() {
    this.set(mongoose.connection.readyState === 1 ? 1 : 0);
  },
});

const appUptimeSeconds = new client.Gauge({
  name: "butler_app_uptime_seconds",
  help: "How long the Butler process has been running.",
});

const metricsRegistry = client.register;

function getRouteLabel(req) {
  if (!req || !req.route || !req.route.path) return "unmatched";

  const baseUrl = String(req.baseUrl || "").replace(/\/$/, "");
  const routePath = String(req.route.path);
  const separator = routePath.startsWith("/") ? "" : "/";
  return `${baseUrl}${separator}${routePath}` || "/";
}

function observeHttpRequest(req, res, startTimeNs) {
  const durationSeconds = Number(process.hrtime.bigint() - startTimeNs) / 1e9;
  const route = getRouteLabel(req);
  const method = req.method || "GET";
  const status = String(res.statusCode || 0);

  httpRequestsTotal.inc({ method, route, status });
  httpRequestDurationSeconds.observe({ method, route, status }, durationSeconds);
}

function refreshUptime() {
  appUptimeSeconds.set(process.uptime());
}

refreshUptime();
setInterval(refreshUptime, 10_000).unref();

module.exports = {
  metricsRegistry,
  observeHttpRequest,
  getRouteLabel,
};
