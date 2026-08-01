// ============================================================
// src/app.js
// Application entry point.
//
// Responsibilities (this file only):
//   - Load environment variables
//   - Create the Express app
//   - Register global middleware (body parsers and static assets)
//   - Configure EJS view engine
//   - Mount every route through routes/index.js
//   - Register 404 and error handlers
//   - Start the HTTP server
//
// Business logic lives in services/*.js, and every URL is registered
// in routes/index.js.  Do not add inline route handlers here.
// ============================================================

const express = require("express");
const mongoose = require("mongoose");
const path = require("path");

// Optional .env loader.  Wrapped in try/catch so the app still boots
// if `dotenv` is not installed yet — useful during the very first run.
try {
  require("dotenv").config();
} catch (_) { /* dotenv is optional */ }

const mountRoutes = require("./routes");
const { makeFail } = require("./lib/apiResponse");
const { connectDb } = require("./lib/db");
const { metricsRegistry, observeHttpRequest, setDbConnectedState } = require("./lib/metrics");
const AuthService = require("./services/AuthService");

AuthService.assertProductionConfig();

const app = express();

// ------------------------------------------------------------------
// Global middleware
// ------------------------------------------------------------------
app.use((req, res, next) => {
  const startTimeNs = process.hrtime.bigint();
  res.on("finish", () => observeHttpRequest(req, res, startTimeNs));
  next();
});
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "5mb" }));
// Static assets served from src/public.
// Requests like /css/style.css or /js/shell.js resolve to files here.
app.use(express.static(path.join(__dirname, "public")));

app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", metricsRegistry.contentType);
  res.end(await metricsRegistry.metrics());
});

// ------------------------------------------------------------------
// EJS view engine
// ------------------------------------------------------------------
app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

// ------------------------------------------------------------------
// Routes (single mount point)
// ------------------------------------------------------------------
mountRoutes(app);

// ------------------------------------------------------------------
// 404 handler.  Responds with JSON for /api/*, HTML for everything else.
// ------------------------------------------------------------------
app.use((req, res) => {
  if (req.path.startsWith("/api/")) {
    res.status(404).json(makeFail("Not found."));
    return;
  }
  res.status(404).send("404 - Page Not Found");
});

// ------------------------------------------------------------------
// Error handler.  Must have 4 args to be treated as an error middleware.
// ------------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error("[app] unhandled error:", err);
  if (res.headersSent) return;
  if (req.path.startsWith("/api/")) {
    res.status(500).json(makeFail(err && err.message ? err.message : "Unknown server error."));
    return;
  }
  res.status(500).send("500 - Server Error");
});

// ------------------------------------------------------------------
// Server bootstrap
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
let server = null;
let shuttingDown = false;

/** Starts listening only after MongoDB is ready, so Docker health is truthful. */
async function start() {
  await connectDb();
  setDbConnectedState(true);
  server = app.listen(PORT, () => {
    console.log(`Butler is running at http://localhost:${PORT}`);
  });
}

/** Drains HTTP connections and closes MongoDB cleanly when Docker stops. */
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[app] ${signal} received; shutting down.`);

  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
  setDbConnectedState(false);
  await mongoose.disconnect();
}

process.once("SIGTERM", () => {
  shutdown("SIGTERM").then(() => process.exit(0)).catch((err) => {
    console.error("[app] shutdown failed:", err.message);
    process.exit(1);
  });
});
process.once("SIGINT", () => {
  shutdown("SIGINT").then(() => process.exit(0)).catch((err) => {
    console.error("[app] shutdown failed:", err.message);
    process.exit(1);
  });
});

start().catch((err) => {
  console.error("[db] MongoDB connection failed:", err.message);
  process.exit(1);
});
