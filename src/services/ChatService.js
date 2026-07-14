// ============================================================
// src/services/ChatService.js
// Streaming chat service.
//
// If DEEPSEEK_API_KEY is configured, this proxies the browser's chat
// request to the DeepSeek Chat Completions API and forwards the SSE
// stream verbatim.  Otherwise it emits a small local mock stream so
// the UI can be developed without an API key.
//
// This module writes SSE directly to the Express Response object; the
// caller MUST NOT call res.json() after invoking streamChat().
//
// Every call is scoped to input.ownerEmail (the logged-in session's
// email, set by the /api/chat route handler). On every request the
// server:
//   1. Builds a fresh MongoDB snapshot (tasks/notes/events) for THAT
//      account only and injects it into the system prompt so the AI
//      has current ids — never another account's data.
//   2. Best-effort persists the last user message and the assistant
//      reply into that account's ChatSession collection.  If MongoDB
//      is down, persistence is silently skipped so chat still works.
// ============================================================

const { buildSystemPrompt } = require("./ChatPrompt");
const { CHAT_TOOLS } = require("./ChatToolDefinitions");
const { buildSnapshot } = require("./ContextService");
const ChatSessionService = require("./ChatSessionService");

const MODEL_MAP = {
  "deepseek-v4-flash":    { apiModel: "deepseek-chat",     supportsTools: true  },
  "deepseek-v4-thinking": { apiModel: "deepseek-reasoner", supportsTools: false },
};

const DEFAULT_MODEL_ID = "deepseek-v4-flash";

const HISTORY_LIMIT = 20;
const CONTENT_LIMIT = 12000;
const HISTORY_CONTENT_LIMIT = 100000;
const MAX_ATTACHMENTS = 3;
const ATTACHMENT_TEXT_LIMIT = 60000;
const PERSISTED_ATTACHMENT_TEXT_LIMIT = 12000;

/** Truncates string input to a fixed character limit without coercing non-strings. */
function clampText(text, max) {
  if (typeof text !== "string") return text;
  if (text.length <= max) return text;
  return text.slice(0, max);
}

/** Normalizes, limits, and removes empty document attachments before model use or persistence. */
function clampAttachments(attachments, textLimit = ATTACHMENT_TEXT_LIMIT) {
  if (!Array.isArray(attachments)) return [];
  return attachments.slice(0, MAX_ATTACHMENTS).map((attachment) => ({
    name: clampText(String(attachment.name || "document"), 255),
    mimeType: clampText(String(attachment.mimeType || "application/octet-stream"), 128),
    size: Number.isFinite(Number(attachment.size)) ? Number(attachment.size) : 0,
    text: clampText(String(attachment.text || ""), textLimit),
    truncated: Boolean(attachment.truncated),
  })).filter((attachment) => attachment.text);
}

/** Expands a chat message into plain text with clearly delimited uploaded document content. */
function contentWithAttachments(content, attachments) {
  const base = typeof content === "string" ? clampText(content, CONTENT_LIMIT) : "";
  const documents = clampAttachments(attachments);
  if (!documents.length) return base;
  const sections = documents.map((document) => [
    `--- Uploaded document: ${document.name} ---`,
    document.text,
    `--- End document: ${document.name} ---`,
  ].join("\n"));
  return [base, ...sections].filter(Boolean).join("\n\n");
}

// Preserve tool_calls / tool_call_id so multi-round tool loops work.
/** Converts recent browser messages into a bounded OpenAI-compatible history. */
function clampMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  let remaining = HISTORY_CONTENT_LIMIT;
  const result = [];
  const recent = list.slice(-HISTORY_LIMIT);
  for (let i = recent.length - 1; i >= 0; i -= 1) {
    const m = recent[i];
    const expandedContent = contentWithAttachments(m.content, m.attachments);
    const content = remaining > 0 ? clampText(expandedContent, remaining) : "[Earlier content omitted]";
    remaining = Math.max(0, remaining - content.length);
    const out = {
      role: m.role,
      content,
    };
    if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
      out.tool_calls = m.tool_calls;
    }
    if (m.tool_call_id) {
      out.tool_call_id = m.tool_call_id;
    }
    result.unshift(out);
  }
  return result;
}

/** Writes one JSON payload as a Server-Sent Events data frame. */
function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

/** Initializes the Express response headers required for an SSE stream. */
function beginSse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
}

// Best-effort chat session helpers.  Never throw — if MongoDB is not
// available the chat should still work in-memory.
//
// If the client passes a sessionId, we save into that specific
// conversation (scoped to ownerEmail). Different tabs / URLs isolate
// their history this way. If sessionId is missing, invalid, or
// belongs to someone else, we fall back to the latest session for
// THIS account (creating one if none exists).
/** Resolves an account-owned chat session without allowing persistence failures to break chat. */
async function safeGetSession(sessionId, ownerEmail) {
  try {
    if (sessionId) {
      const s = await ChatSessionService.findById(sessionId, ownerEmail);
      if (s) return s;
    }
    return await ChatSessionService.getLatestSession(ownerEmail);
  } catch (err) {
    console.warn("[ChatService] session unavailable:", err.message);
    return null;
  }
}

/** Persists one bounded user or assistant message while treating database errors as non-fatal. */
async function safeSaveMessage(session, role, content, ownerEmail, attachments) {
  if (!session || !content) return;
  // ChatSession model only allows role "user" | "assistant".
  if (role !== "user" && role !== "assistant") return;
  try {
    await ChatSessionService.addMessage(
      session._id,
      role,
      content,
      ownerEmail,
      clampAttachments(attachments, PERSISTED_ATTACHMENT_TEXT_LIMIT)
    );
  } catch (err) {
    console.warn("[ChatService] failed to persist message:", err.message);
  }
}

// Only persist the LAST user turn (not the entire history every time).
/** Finds the most recent user message in an OpenAI-compatible message list. */
function extractLastUserMessage(messages) {
  const list = Array.isArray(messages) ? messages : [];
  for (let i = list.length - 1; i >= 0; i -= 1) {
    if (list[i].role === "user" && typeof list[i].content === "string") {
      return list[i];
    }
  }
  return null;
}

// Determine whether this request is the first turn of a user message
// (worth persisting) or a follow-up tool round (already persisted).
/** Detects whether the current request follows a tool result in the multi-round agent loop. */
function isFollowUpToolRound(messages) {
  const list = Array.isArray(messages) ? messages : [];
  if (list.length === 0) return false;
  return list[list.length - 1].role === "tool";
}

/** Emits a deterministic local SSE response when the real model path is disabled. */
async function streamMock(input, res) {
  beginSse(res);

  const lastUser = extractLastUserMessage(input.messages);
  const echo = lastUser ? lastUser.content : "Hello!";
  const reply = `Butler (mock mode): I received "${echo}". Configure DEEPSEEK_API_KEY in .env to enable tool calling against MongoDB.`;

  const words = reply.split(/(\s+)/);
  for (const chunk of words) {
    if (input.signal && input.signal.aborted) return;
    writeSse(res, { choices: [{ delta: { content: chunk }, finish_reason: null }] });
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  writeSse(res, { choices: [{ delta: {}, finish_reason: "stop" }] });
  res.write("data: [DONE]\n\n");
  res.end();

  const session = await safeGetSession(input.sessionId, input.ownerEmail);
  if (session && !isFollowUpToolRound(input.messages)) {
    if (lastUser) await safeSaveMessage(session, "user", lastUser.content, input.ownerEmail, lastUser.attachments);
    await safeSaveMessage(session, "assistant", reply, input.ownerEmail);
  }
}

/** Streams a DeepSeek completion, including optional tool calls, through the OpenAI client. */
async function streamReal(input, res) {
  let OpenAI;
  try {
    OpenAI = require("openai").OpenAI;
  } catch (_) {
    beginSse(res);
    writeSse(res, { error: "The 'openai' package is not installed. Run: npm install openai" });
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  const modelChoice = MODEL_MAP[input.model] || MODEL_MAP[DEFAULT_MODEL_ID];
  const useTools = input.includeTools !== false && modelChoice.supportsTools;

  // Always build the account snapshot on the server for the first round.
  // Client-provided context is intentionally ignored because it must not
  // be able to replace trusted MongoDB ids or cross the account boundary.
  let contextSummary = "";
  if (!isFollowUpToolRound(input.messages)) {
    try {
      contextSummary = await buildSnapshot(input.ownerEmail);
    } catch (err) {
      console.warn("[ChatService] snapshot unavailable:", err.message);
    }
  }

  const messages = [
    { role: "system", content: buildSystemPrompt({ ...input, contextSummary }) },
    ...clampMessages((input.messages || []).filter((m) => m.role !== "system")),
  ];

  const client = new OpenAI({
    apiKey: process.env.DEEPSEEK_API_KEY,
    baseURL: process.env.DEEPSEEK_BASE_URL || "https://api.deepseek.com/v1",
  });

  let stream;
  try {
    stream = await client.chat.completions.create({
      model: modelChoice.apiModel,
      messages,
      tools: useTools ? CHAT_TOOLS : undefined,
      tool_choice: useTools ? "auto" : undefined,
      stream: true,
      temperature: 0.4,
      max_tokens: 2048,
    }, input.signal ? { signal: input.signal } : undefined);
  } catch (err) {
    beginSse(res);
    writeSse(res, { error: err && err.message ? err.message : "Failed to reach model." });
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  beginSse(res);
  let hasEmitted = false;
  let fullResponse = "";
  try {
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      hasEmitted = true;
      const delta = chunk.choices && chunk.choices[0] && chunk.choices[0].delta;
      if (delta && typeof delta.content === "string") {
        fullResponse += delta.content;
      }
    }
  } catch (err) {
    if (input.signal && input.signal.aborted) return;
    if (!hasEmitted) {
      writeSse(res, { error: err && err.message ? err.message : "Stream failed." });
    }
  } finally {
    const aborted = Boolean(input.signal && input.signal.aborted);
    if (!res.destroyed && !res.writableEnded) {
      res.write("data: [DONE]\n\n");
      res.end();
    }
    if (aborted) return;

    // Best-effort persistence.  Only on the first turn of a user
    // message (not on tool follow-up rounds).
    const session = await safeGetSession(input.sessionId, input.ownerEmail);
    if (session && !isFollowUpToolRound(input.messages)) {
      const lastUser = extractLastUserMessage(input.messages);
      if (lastUser) await safeSaveMessage(session, "user", lastUser.content, input.ownerEmail, lastUser.attachments);
    }
    if (session && fullResponse && !aborted) {
      await safeSaveMessage(session, "assistant", fullResponse, input.ownerEmail);
    }
  }
}

/** Validates a chat request and selects either the real or deterministic mock streaming path. */
async function streamChat(input, res) {
  if (!Array.isArray(input.messages)) {
    res.status(400).json({ ok: false, error: "messages must be an array." });
    return;
  }
  if (!input.ownerEmail) {
    res.status(401).json({ ok: false, error: "Not logged in." });
    return;
  }

  const forceMock = /^(1|true|yes)$/i.test(process.env.CHAT_MOCK_MODE || "");
  if (process.env.DEEPSEEK_API_KEY && !forceMock) {
    await streamReal(input, res);
  } else {
    await streamMock(input, res);
  }
}

module.exports = { streamChat, DEFAULT_MODEL_ID, MODEL_MAP };
