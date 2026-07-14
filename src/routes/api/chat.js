// ============================================================
// src/routes/api/chat.js
// Chat streaming + session endpoints.
//
// POST /api/chat
//   Body: { messages, model?, personality?,
//           includeTools?, sessionId? }
//   Response: text/event-stream (SSE)
//
// GET  /api/chat/session/latest  -> current account's latest session
// POST /api/chat/session         -> create a new session for the account
//
// Every route requires a logged-in session. req.sessionUser.email is
// forwarded as ownerEmail so the MongoDB snapshot, session lookups, and
// any persisted history only ever touch THIS account's data.
//
// This route hands the response object directly to the service so
// the service can write SSE frames as they arrive from the model.
// Do NOT call res.json() after invoking streamChat.
// ============================================================

const express = require("express");

const { streamChat } = require("../../services/ChatService");
const ChatSessionService = require("../../services/ChatSessionService");
const { makeOk, makeFail } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();

router.use(requireAuthApi);

/** Converts a Mongoose chat session into the safe account API response shape. */
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

// Loads the latest account-owned session for browser state recovery.
router.get("/session/latest", async (req, res) => {
  try {
    const session = await ChatSessionService.getLatestSession(req.sessionUser.email);
    res.json(makeOk({ session: serializeSession(session) }));
  } catch (err) {
    res.status(503).json(makeFail(`Chat history is unavailable: ${err.message}`));
  }
});

// Creates a new empty chat session for the authenticated account.
router.post("/session", async (req, res) => {
  try {
    const session = await ChatSessionService.create(req.sessionUser.email);
    res.status(201).json(makeOk({ session: serializeSession(session) }));
  } catch (err) {
    res.status(503).json(makeFail(`Could not create a chat session: ${err.message}`));
  }
});

// Streams one model round and cancels the upstream request if the browser disconnects.
router.post("/", async (req, res, next) => {
  const controller = new AbortController();
  res.on("close", () => {
    if (!res.writableEnded) controller.abort();
  });
  try {
    await streamChat({
      ...(req.body || {}),
      ownerEmail: req.sessionUser.email,
      userName: req.sessionUser.name,
      signal: controller.signal,
    }, res);
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
