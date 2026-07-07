// ============================================================
// public/js/chat-ui.js
// DOM controller for the chat page.  Wires the composer form to
// the streaming chat client, appends message bubbles, and manages
// the "Stop" button while a response is in flight.
//
// Depends on:
//   ButlerState        (app-state.js)
//   ButlerChatClient   (chat-client.js)
// ============================================================

(function initChatUi() {
  if (!window.ButlerChatClient || !window.ButlerState) {
    // Chat scripts are only loaded on the chat page.  Bail on other pages.
    return;
  }

  var stream = document.querySelector("[data-message-stream]");
  var emptyBlock = document.querySelector("[data-chat-empty]");
  var form = document.querySelector("[data-composer]");
  var input = document.querySelector("[data-composer-input]");
  var sendBtn = document.querySelector("[data-composer-send]");
  var stopBtn = document.querySelector("[data-composer-stop]");
  var promptCards = document.querySelectorAll("[data-prompt]");

  if (!stream || !form || !input || !sendBtn) return;

  var abortController = null;
  var pendingBubble = null;

  // ---------- DOM helpers ----------
  function scrollToEnd() {
    stream.scrollTop = stream.scrollHeight;
  }

  function hideEmptyBlock() {
    if (emptyBlock) emptyBlock.hidden = true;
  }

  function appendMessageBubble(role, text) {
    var row = document.createElement("div");
    row.className = "message-row " + (role === "user" ? "user" : "ai");

    var bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (role === "user" ? "chat-bubble-user" : "chat-bubble-ai");
    bubble.textContent = text;

    row.appendChild(bubble);
    stream.appendChild(row);
    scrollToEnd();
    return bubble;
  }

  function setStreamingState(streaming) {
    ButlerState.set({ isStreaming: streaming });
    sendBtn.disabled = streaming;
    stopBtn.hidden = !streaming;
    input.disabled = false;
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  // ---------- Send flow ----------
  async function sendMessage(text) {
    var trimmed = String(text || "").trim();
    if (!trimmed) return;

    hideEmptyBlock();

    var userMsg = { id: "m-" + Date.now(), role: "user", content: trimmed };
    ButlerState.addMessage(userMsg);
    appendMessageBubble("user", trimmed);

    input.value = "";
    autoResize(input);

    pendingBubble = appendMessageBubble("assistant", "");
    setStreamingState(true);

    abortController = new AbortController();

    var messagesForApi = ButlerState.get().messages.map(function (m) {
      return { role: m.role, content: m.content };
    });

    try {
      await ButlerChatClient.streamChat({
        messages: messagesForApi,
        model: "deepseek-v4-flash",
        personality: "standard",
        signal: abortController.signal,
        callbacks: {
          onContentDelta: function (delta) {
            if (!pendingBubble) return;
            pendingBubble.textContent += delta;
            scrollToEnd();
          },
          onToolCall: function (call) {
            // Tool execution is added in a later phase.
            console.info("[chat] tool call requested:", call.function && call.function.name);
          },
          onAssistantMessage: function (msg) {
            ButlerState.addMessage({
              id: "m-" + Date.now(),
              role: "assistant",
              content: msg.content || "",
            });
          },
          onError: function (err) {
            if (pendingBubble) {
              pendingBubble.textContent = "Butler could not answer: " + (err && err.message ? err.message : "unknown error");
            }
          },
        },
      });
    } catch (err) {
      if (!(err && (err.name === "AbortError" || err.name === "DOMException"))) {
        console.error("[chat] streamChat failed:", err);
      }
    } finally {
      pendingBubble = null;
      abortController = null;
      setStreamingState(false);
    }
  }

  // ---------- Event wiring ----------
  form.addEventListener("submit", function (event) {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("input", function () { autoResize(input); });

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(input.value);
    }
  });

  if (stopBtn) {
    stopBtn.addEventListener("click", function () {
      if (abortController) abortController.abort();
    });
  }

  promptCards.forEach(function (card) {
    card.addEventListener("click", function () {
      var prompt = card.getAttribute("data-prompt") || "";
      input.value = prompt;
      autoResize(input);
      sendMessage(prompt);
    });
  });
})();
