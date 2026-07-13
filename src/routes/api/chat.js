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
const ChatSessionService = require("../../services/ChatSessionService");
const { makeOk, makeFail } = require("../../lib/apiResponse");

const router = express.Router();

function serializeSession(session) {
  return {
    id: String(session._id),
    messages: (session.messages || []).map((message) => ({
      role: message.role,
      content: message.content,
      attachments: Array.isArray(message.attachments)
        ? message.attachments.map((attachment) => ({
          name: attachment.name,
          mimeType: attachment.mimeType,
          size: attachment.size,
          text: attachment.text,
          truncated: attachment.truncated,
        }))
        : undefined,
    })),
  };
}

router.get("/session/latest", async (_req, res) => {
  try {
    const session = await ChatSessionService.getLatestSession();
    res.json(makeOk({ session: serializeSession(session) }));
  } catch (err) {
    res.status(503).json(makeFail(`Chat history is unavailable: ${err.message}`));
  }
});

router.post("/session", async (_req, res) => {
  try {
    const session = await ChatSessionService.create();
    res.status(201).json(makeOk({ session: serializeSession(session) }));
  } catch (err) {
    res.status(503).json(makeFail(`Could not create a chat session: ${err.message}`));
  }
});

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
