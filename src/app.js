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
//   - Start the HTTP server
//
// Business logic lives in services/*.js, and every URL is registered
// in routes/index.js.  Do not add inline route handlers here.
// ============================================================

const express = require("express");
const path = require("path");
const mongoose = require("mongoose");
const cookieParser = require("cookie-parser");

// Optional .env loader.  Wrapped in try/catch so the app still boots
// if `dotenv` is not installed yet — useful during the very first run.
try {
  require("dotenv").config();
} catch (_) { /* dotenv is optional */ }

const mountRoutes = require("./routes");
const { makeFail } = require("./lib/apiResponse");

const app = express();

// ------------------------------------------------------------------
// Global middleware
// ------------------------------------------------------------------
app.use(express.urlencoded({ extended: true, limit: "1mb" }));
app.use(express.json({ limit: "5mb" }));
// cookie-parser was already a dependency but never wired in — needed now
// to read the login session cookie set by /api/auth/verify-otp.
app.use(cookieParser());

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
// Database connection (MongoDB via Mongoose)
// ------------------------------------------------------------------
const connectDB = async () => {
  try {
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/butler";
    await mongoose.connect(mongoUri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log("[db] Connected to MongoDB:", mongoUri);
  } catch (err) {
    console.error("[db] MongoDB connection failed:", err.message);
    // Don't exit — allow app to run without DB (useful for dev/testing)
    // In production, you'd want to exit here
  }
};

// ------------------------------------------------------------------
// Server bootstrap
// ------------------------------------------------------------------
const PORT = process.env.PORT || 3000;

connectDB();

app.listen(PORT, () => {
  console.log(`Butler is running at http://localhost:${PORT}`);
});
