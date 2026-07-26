// ============================================================
// src/routes/index.js
// Central route aggregator.  app.js calls this once to mount every
// public route in the app.  Keeping this in one place makes it easy
// to see the full URL surface at a glance.
// ============================================================

const pages = require("./pages");
const apiLive = require("./api/live");
const apiHealth = require("./api/health");
const apiChat = require("./api/chat");
const apiTasks = require("./api/tasks");
const apiNotes = require("./api/notes");
const apiCalendar = require("./api/calendar");
const apiProfile = require("./api/profile");
const apiBilling = require("./api/billing");
const apiAuth = require("./api/auth");
const apiDocuments = require("./api/documents");
const apiBriefing = require("./api/briefing");
const { authGuard } = require("../lib/authGuard");

module.exports = function mountRoutes(app) {
  // Resolve the remote-style server-side Session before any page or API route.
  app.use(authGuard);

  // HTML pages served with the shared layout shell.
  app.use(pages);

  // JSON / SSE API surface.
  app.use("/api/live", apiLive);
  app.use("/api/health", apiHealth);
  app.use("/api/chat", apiChat);
  // NOTE: tasks/notes/calendar were previously imported here but never
  // mounted, so tasks-ui.js / notes-ui.js calls to these endpoints were
  // silently 404ing. Fixed as part of Task 6 quality checks.
  app.use("/api/tasks", apiTasks);
  app.use("/api/notes", apiNotes);
  app.use("/api/calendar", apiCalendar);
  app.use("/api/profile", apiProfile);
  app.use("/api/billing", apiBilling);
  app.use("/api/auth", apiAuth);
  app.use("/api/documents", apiDocuments);
  app.use("/api/briefing", apiBriefing);
};
