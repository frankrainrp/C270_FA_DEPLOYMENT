// ============================================================
// src/routes/api/chat.js
// Chat streaming endpoint.
//
// POST /api/chat
//   Body: { messages, contextSummary?, userName?, model?, personality?,
//           includeTools?, sessionId? }
//   Response: text/event-stream (SSE)
//
// Requires a logged-in session. req.sessionUser.email is forwarded to
// ChatService as ownerEmail so the MongoDB snapshot and any persisted
// history only ever touch THIS account's data.
//
// This route hands the response object directly to the service so
// the service can write SSE frames as they arrive from the model.
// Do NOT call res.json() after invoking streamChat.
// ============================================================

const express = require("express");

const { streamChat } = require("../../services/ChatService");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();

router.post("/", requireAuthApi, async (req, res, next) => {
  try {
    await streamChat({ ...(req.body || {}), ownerEmail: req.sessionUser.email }, res);
  } catch (err) {
    // If the stream already started, headers are gone and we can only log.
    if (!res.headersSent) {
      next(err);
    } else {
      // Best-effort: end the connection so the browser reader unblocks.
      try {
        res.write("data: [DONE]\n\n");
      } catch (_) { /* ignore */ }
      res.end();
    }
  }
});

module.exports = router;
