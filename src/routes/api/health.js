// ============================================================
// src/routes/api/health.js
// GET /api/health — simple liveness probe.
// Useful for Docker healthchecks and CI smoke tests.
// ============================================================

const express = require("express");

const { makeOk } = require("../../lib/apiResponse");

const router = express.Router();

router.get("/", (_req, res) => {
  res.json(makeOk({ status: "up", timestamp: Date.now() }));
});

module.exports = router;
