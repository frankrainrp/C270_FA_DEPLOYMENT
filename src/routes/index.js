// ============================================================
// src/routes/index.js
// Central route aggregator.  app.js calls this once to mount every
// public route in the app.  Keeping this in one place makes it easy
// to see the full URL surface at a glance.
// ============================================================

const pages = require("./pages");
const apiHealth = require("./api/health");
const apiAuth = require("./api/auth");
const apiChat = require("./api/chat");
const apiTasks = require("./api/tasks");
const apiNotes = require("./api/notes");
const apiCalendar = require("./api/calendar");
const apiDocuments = require("./api/documents");
const { authGuard } = require("../lib/authGuard");

module.exports = function mountRoutes(app) {
  // Attaches the logged-in user (if any) to every request and, when
  // AUTH_REQUIRED is enabled, redirects signed-out visitors to
  // /auth/login. Must run before every route below.
  app.use(authGuard);

  // HTML pages served with the shared layout shell.
  app.use(pages);

  // JSON / SSE API surface.
  app.use("/api/health", apiHealth);
  app.use("/api/auth", apiAuth);
  app.use("/api/chat", apiChat);
  app.use("/api/tasks", apiTasks);
  app.use("/api/notes", apiNotes);
  app.use("/api/calendar", apiCalendar);
  app.use("/api/documents", apiDocuments);
};
