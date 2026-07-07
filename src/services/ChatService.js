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
// Ported from C270_FA apps/api/src/services/ChatService.ts, simplified
// to plain JS (no zod, no reasoning mode) and adapted to run inside
// the same Express process as the EJS UI.
// ============================================================

const { buildSystemPrompt } = require("./ChatPrompt");
const { CHAT_TOOLS } = require("./ChatToolDefinitions");

// UI model id -> upstream DeepSeek model id.
// Kept as a whitelist so a client cannot smuggle arbitrary model names
// through to the provider.
const MODEL_MAP = {
  "deepseek-v4-flash":    { apiModel: "deepseek-chat",     supportsTools: true  },
  "deepseek-v4-thinking": { apiModel: "deepseek-reasoner", supportsTools: false },
};

const DEFAULT_MODEL_ID = "deepseek-v4-flash";

// Only keep the last N messages so a very long history does not blow
// past the model context window or run up cost unexpectedly.
const HISTORY_LIMIT = 20;
const CONTENT_LIMIT = 12000;

function clampText(text, max) {
  if (typeof text !== "string") return text;
  if (text.length <= max) return text;
  return text.slice(0, max);
}

function clampMessages(messages) {
  const list = Array.isArray(messages) ? messages : [];
  return list.slice(-HISTORY_LIMIT).map((m) => ({
    role: m.role,
    content: typeof m.content === "string" ? clampText(m.content, CONTENT_LIMIT) : m.content,
    tool_calls: m.tool_calls,
    tool_call_id: m.tool_call_id,
  }));
}

// Write one SSE data event.
function writeSse(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

// Configure the response for streaming SSE.
function beginSse(res) {
  res.status(200);
  res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  if (typeof res.flushHeaders === "function") {
    res.flushHeaders();
  }
}

// Emit a small, deterministic mock stream so the UI works without an API key.
// The chunk shape mimics the OpenAI/DeepSeek delta format so chat-client.js
// can parse both real and mock streams with the same code path.
async function streamMock(input, res) {
  beginSse(res);

  const lastUser = [...(input.messages || [])].reverse().find((m) => m.role === "user");
  const echo = lastUser && typeof lastUser.content === "string" ? lastUser.content : "Hello!";
  const reply = `Butler (mock mode): I received "${echo}". Configure DEEPSEEK_API_KEY in .env to enable the real model.`;

  const words = reply.split(/(\s+)/);
  for (const chunk of words) {
    writeSse(res, {
      choices: [{ delta: { content: chunk }, finish_reason: null }],
    });
    // Small delay so the UI shows a streaming effect.
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  writeSse(res, { choices: [{ delta: {}, finish_reason: "stop" }] });
  res.write("data: [DONE]\n\n");
  res.end();
}

// Real streaming path against the DeepSeek Chat Completions API.
// We keep this dependency lazy so the server still boots when the
// `openai` package is not installed.
async function streamReal(input, res) {
  let OpenAI;
  try {
    OpenAI = require("openai").OpenAI;
  } catch (err) {
    beginSse(res);
    writeSse(res, { error: "The 'openai' package is not installed. Run: npm install openai" });
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  const modelChoice = MODEL_MAP[input.model] || MODEL_MAP[DEFAULT_MODEL_ID];
  const useTools = input.includeTools !== false && modelChoice.supportsTools;

  const messages = [
    { role: "system", content: buildSystemPrompt(input) },
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
    });
  } catch (err) {
    beginSse(res);
    writeSse(res, { error: err && err.message ? err.message : "Failed to reach model." });
    res.write("data: [DONE]\n\n");
    res.end();
    return;
  }

  beginSse(res);
  let hasEmitted = false;
  try {
    for await (const chunk of stream) {
      res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      hasEmitted = true;
    }
  } catch (err) {
    if (!hasEmitted) {
      writeSse(res, { error: err && err.message ? err.message : "Stream failed." });
    }
  } finally {
    res.write("data: [DONE]\n\n");
    res.end();
  }
}

// Public entry: pick real or mock based on env, then delegate.
async function streamChat(input, res) {
  if (!Array.isArray(input.messages)) {
    res.status(400).json({ ok: false, error: "messages must be an array." });
    return;
  }

  if (process.env.DEEPSEEK_API_KEY) {
    await streamReal(input, res);
  } else {
    await streamMock(input, res);
  }
}

module.exports = { streamChat, DEFAULT_MODEL_ID, MODEL_MAP };
