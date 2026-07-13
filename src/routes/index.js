// ============================================================
// src/routes/index.js
//
// Mounts all application routes.
//
// ============================================================

const pages = require("./pages");
const apiHealth = require("./api/health");
const apiChat = require("./api/chat");
const apiTasks = require("./api/tasks");
const apiNotes = require("./api/notes");
const apiCalendar = require("./api/calendar");
const apiProfile = require("./api/profile");
const apiBilling = require("./api/billing");
const apiAuth = require("./api/auth");
const apiDocuments = require("./api/documents");

// =============================
// Task 5 API Routes
// =============================
const panelRoutes = require("./api/panels");
const connectorRoutes = require("./api/connectors");
const generatePanelRoutes = require("./api/generatePanel");
const researchRoutes = require("./api/research");
const visualizationRoutes = require("./api/visualization");

module.exports = function mountRoutes(app) {

  // HTML pages served with the shared layout shell.
  app.use(pages);

  // JSON / SSE API surface.
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


  // =============================
  // Task 5 API Routes
  // =============================
  app.use("/api/panels", panelRoutes);
  app.use("/api/connectors", connectorRoutes);
  app.use("/api/generate-panel", generatePanelRoutes);
  app.use("/api/research", researchRoutes);
  app.use("/api/visualization", visualizationRoutes);

};
