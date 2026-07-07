// ============================================================
// src/routes/api/chat.js
// Chat streaming endpoint.
//
// POST /api/chat
//   Body: { messages, contextSummary?, userName?, model?, personality?,
//           includeTools? }
//   Response: text/event-stream (SSE)
//
// This route hands the response object directly to the service so
// the service can write SSE frames as they arrive from the model.
// Do NOT call res.json() after invoking streamChat.
// ============================================================

const express = require("express");

const { streamChat } = require("../../services/ChatService");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    await streamChat(req.body || {}, res);
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
