// ============================================================
// src/routes/index.js
// Central route aggregator.  app.js calls this once to mount every
// public route in the app.  Keeping this in one place makes it easy
// to see the full URL surface at a glance.
// ============================================================

const pages = require("./pages");
const apiHealth = require("./api/health");
const apiChat = require("./api/chat");

module.exports = function mountRoutes(app) {
  // HTML pages served with the shared layout shell.
  app.use(pages);

  // JSON / SSE API surface.
  app.use("/api/health", apiHealth);
  app.use("/api/chat", apiChat);
};
