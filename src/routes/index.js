// ============================================================
// src/routes/index.js
// Central route aggregator.  app.js calls this once to mount every
// public route in the app.  Keeping this in one place makes it easy
// to see the full URL surface at a glance.
// ============================================================

// ============================================================
// src/routes/index.js
//
// Mounts all application routes.
//
// ============================================================

const pages = require("./pages");
const apiHealth = require("./api/health");
const apiChat = require("./api/chat");

// =============================
// Member 5 API Routes
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

  // =============================
  // Member 5 API Routes
  // =============================
  app.use("/api/panels", panelRoutes);
  app.use("/api/connectors", connectorRoutes);
  app.use("/api/generate-panel", generatePanelRoutes);
  app.use("/api/research", researchRoutes);
  app.use("/api/visualization", visualizationRoutes);

};