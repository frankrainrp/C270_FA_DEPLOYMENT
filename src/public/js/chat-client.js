// ============================================================
// public/js/chat-client.js
// Streams a chat completion from POST /api/chat and parses the SSE
// response into content deltas, tool calls, and errors.
//
// Tool execution remains separate from transport: this module surfaces
// complete tool calls to chat-ui.js, which delegates them to tool-executor.js.
// ============================================================

(function initChatClient() {
  var ENDPOINT = "/api/chat";

  /**
   * Start a streaming chat request.
   *
   * @param {Object} opts
   * @param {Array}  opts.messages     - Prior messages in OpenAI format.
   * @param {string=} opts.model        - UI model id (deepseek-v4-flash, ...).
   * @param {string=} opts.personality  - gentle | standard | sassy.
   * @param {string=} opts.contextSummary
   * @param {string=} opts.userName
   * @param {AbortSignal=} opts.signal
   * @param {Object} opts.callbacks
   * @param {Function=} opts.callbacks.onContentDelta - (text) => void
   * @param {Function=} opts.callbacks.onToolCall     - (call) => void
   * @param {Function=} opts.callbacks.onAssistantMessage - (msg) => void
   * @param {Function=} opts.callbacks.onError        - (err) => void
   * @param {Function=} opts.callbacks.onDone         - () => void
   */
  async function streamChat(opts) {
    var cb = opts.callbacks || {};
    var res;
    try {
      res = await fetch(ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        signal: opts.signal,
        body: JSON.stringify({
          messages: opts.messages,
          model: opts.model,
          personality: opts.personality,
          contextSummary: opts.contextSummary,
          userName: opts.userName,
          includeTools: opts.includeTools !== false,
          sessionId: opts.sessionId || null,
        }),
      });
    } catch (err) {
      if (err && (err.name === "AbortError" || err.name === "DOMException")) throw err;
      if (cb.onError) cb.onError(err);
      throw err;
    }

    if (!res.ok || !res.body) {
      var detail = "HTTP " + res.status;
      try {
        var j = await res.json();
        detail = (j && j.error) || detail;
      } catch (_) { /* ignore */ }
      var httpErr = new Error(detail);
      if (cb.onError) cb.onError(httpErr);
      throw httpErr;
    }

    var reader = res.body.getReader();
    var decoder = new TextDecoder();
    var buffer = "";
    var content = "";
    var toolCallsById = new Map();

    while (true) {
      var read;
      try {
        read = await reader.read();
      } catch (err) {
        if (err && (err.name === "AbortError" || err.name === "DOMException")) throw err;
        if (cb.onError) cb.onError(err);
        throw err;
      }
      if (read.done) break;
      buffer += decoder.decode(read.value, { stream: true });

      // SSE events are separated by \n\n.
      var sepIdx = buffer.indexOf("\n\n");
      while (sepIdx >= 0) {
        var rawEvent = buffer.slice(0, sepIdx);
        buffer = buffer.slice(sepIdx + 2);

        var dataLines = rawEvent.split("\n")
          .filter(function (l) { return l.indexOf("data:") === 0; })
          .map(function (l) { return l.slice(5).trim(); });
        var data = dataLines.join("");

        if (data && data !== "[DONE]") {
          var chunk;
          try { chunk = JSON.parse(data); } catch (_) { chunk = null; }

          if (chunk) {
            if (chunk.error) {
              var chunkErr = new Error(chunk.error);
              if (cb.onError) cb.onError(chunkErr);
            } else if (chunk.choices && chunk.choices[0]) {
              var delta = chunk.choices[0].delta || {};

              if (typeof delta.content === "string" && delta.content.length > 0) {
                content += delta.content;
                if (cb.onContentDelta) cb.onContentDelta(delta.content);
              }

              if (Array.isArray(delta.tool_calls)) {
                delta.tool_calls.forEach(function (tc) {
                  var idx = tc.index != null ? tc.index : 0;
                  var acc = toolCallsById.get(idx) || {
                    id: tc.id || ("call-" + idx),
                    type: "function",
                    function: { name: "", arguments: "" },
                  };
                  if (tc.id) acc.id = tc.id;
                  if (tc.function) {
                    if (tc.function.name) acc.function.name += tc.function.name;
                    if (tc.function.arguments) acc.function.arguments += tc.function.arguments;
                  }
                  toolCallsById.set(idx, acc);
                });
              }
            }
          }
        }
        sepIdx = buffer.indexOf("\n\n");
      }
    }

    var toolCalls = Array.from(toolCallsById.values());
    if (toolCalls.length > 0 && cb.onToolCall) {
      toolCalls.forEach(function (call) { cb.onToolCall(call); });
    }

    var assistantMsg = {
      role: "assistant",
      content: content || null,
      tool_calls: toolCalls.length ? toolCalls : undefined,
    };
    if (cb.onAssistantMessage) cb.onAssistantMessage(assistantMsg);
    if (cb.onDone) cb.onDone();
    return assistantMsg;
  }

  window.ButlerChatClient = { streamChat: streamChat };
})();
