// GET /api/live — process-only liveness probe.
// This endpoint deliberately avoids MongoDB and external APIs. Kubernetes can
// therefore distinguish a dead Node.js process from a temporary dependency
// outage and will not create a restart loop when Atlas is unavailable.

const express = require("express");

const { makeOk } = require("../../lib/apiResponse");

const router = express.Router();

router.get("/", (_req, res) => {
  res.status(200).json(makeOk({
    status: "alive",
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: Date.now(),
  }));
});

module.exports = router;
