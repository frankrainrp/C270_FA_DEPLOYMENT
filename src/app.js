// ============================================================
// src/app.js
// Application entry point.
//
// Responsibilities (this file only):
//   - Load environment variables
//   - Create the Express app
//   - Register global middleware (body parsers, static, cookies)
//   - Configure EJS view engine
//   - Mount every route through routes/index.js
//   - Register 404 and error handlers
//   - Connect to MongoDB, then start the HTTP server
//
// Business logic lives in services/*.js, and every URL is registered
// in routes/index.js.  Do not add inline route handlers here.
// ============================================================

// Optional .env loader.  Wrapped in try/catch so the app still boots
// if `dotenv` is not installed yet — useful during the very first run.
try {
  require("dotenv").config();
} catch (_) { /* dotenv is optional */ }

const express = require("express");
const path = require("path");

const { connectDb } = require("./lib/db");
const mountRoutes = require("./routes");
const { makeFail } = require("./lib/apiResponse");
const notesStore = require("./data/notesStore");

const app = express();

// ------------------------------------------------------------------
// Global middleware
// ------------------------------------------------------------------
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "5mb" }));

// Static assets served from src/public.
// Requests like /css/style.css or /js/shell.js resolve to files here.
app.use(express.static(path.join(__dirname, "public")));

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
// Server bootstrap.  Connect to MongoDB first, seed if empty, then
// start listening.  If the DB is unreachable, fail loudly.
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

connectDb()
  .then(() => notesStore.seedIfEmpty())
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Butler is running at http://localhost:${PORT}`);
    });
  })
  .catch((err) => {
    console.error("[app] failed to start — is MongoDB running?", err);
    process.exit(1);
  });
