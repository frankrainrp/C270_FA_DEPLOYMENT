// ============================================================
// src/routes/api/health.js
// GET /api/health — application and MongoDB readiness probe.
// Useful for Docker healthchecks, demo diagnostics, and CI smoke tests.
// ============================================================

const express = require("express");
const mongoose = require("mongoose");

const { makeOk } = require("../../lib/apiResponse");

const router = express.Router();

router.get("/", (_req, res) => {
  const databaseReady = mongoose.connection.readyState === 1;
  const forceMock = /^(1|true|yes)$/i.test(process.env.CHAT_MOCK_MODE || "");
  const chatMode = process.env.DEEPSEEK_API_KEY && !forceMock ? "live" : "mock";
  const payload = makeOk({
    status: databaseReady ? "ready" : "starting",
    database: databaseReady ? "connected" : "disconnected",
    chatMode,
    localDemoMode: /^(1|true|yes)$/i.test(process.env.LOCAL_DEMO_MODE || ""),
    timestamp: Date.now(),
  });

  res.status(databaseReady ? 200 : 503).json(payload);
});

module.exports = router;
