// ============================================================
// public/js/chat-ui.js
// DOM controller for the chat page.
//
// Implements a multi-round TOOL LOOP:
//   1. Send the current messages to /api/chat.
//   2. If the assistant reply contains tool_calls, execute each via
//      ButlerToolExecutor (which calls /api/tasks|notes|calendar and
//      talks to MongoDB), append a role:"tool" message with the
//      result, then go to step 1.
//   3. Loop until the assistant reply has no tool_calls, or the
//      safety cap (MAX_TOOL_ROUNDS) is hit.
//
// Depends on:
//   ButlerState         (app-state.js)
//   ButlerChatClient    (chat-client.js)
//   ButlerToolExecutor  (tool-executor.js)
// ============================================================

(function initChatUi() {
  if (!window.ButlerChatClient || !window.ButlerState) return;

  var MAX_TOOL_ROUNDS = 6;

  var stream = document.querySelector("[data-message-stream]");
  var emptyBlock = document.querySelector("[data-chat-empty]");
  var form = document.querySelector("[data-composer]");
  var input = document.querySelector("[data-composer-input]");
  var sendBtn = document.querySelector("[data-composer-send]");
  var stopBtn = document.querySelector("[data-composer-stop]");
  var promptCards = document.querySelectorAll("[data-prompt]");
  var documentInput = document.querySelector("[data-document-input]");
  var documentPick = document.querySelector("[data-document-pick]");
  var documentList = document.querySelector("[data-document-list]");
  var statusEl = document.querySelector("[data-chat-status]");

  if (!stream || !form || !input || !sendBtn) return;

  var abortController = null;
  var pendingBubble = null;
  var selectedDocuments = [];

  var sessionReady = Promise.resolve();
  if (!ButlerState.get().activeSessionId && window.ButlerApi) {
    sessionReady = ButlerApi.get("/chat/session/latest").then(function (data) {
      var session = data && data.session;
      if (!session) return;
      ButlerState.replaceMessages(session.messages || [], session.id);
      if ((session.messages || []).length > 0) {
        hideEmptyBlock();
        (session.messages || []).forEach(function (message) {
          appendMessageBubble(message.role, message.content || "");
        });
      }
    }).catch(function (err) {
      console.warn("[chat] history unavailable:", err.message);
    });
  }

  // ---------- DOM helpers ----------
  function isNearEnd() {
    return stream.scrollHeight - stream.scrollTop - stream.clientHeight < 120;
  }

  function scrollToEnd(force) {
    if (force || isNearEnd()) stream.scrollTop = stream.scrollHeight;
  }

  function setStatus(message) {
    if (statusEl) statusEl.textContent = message || "";
  }

  function hideEmptyBlock() {
    if (emptyBlock) emptyBlock.hidden = true;
  }

  function appendInlineMarkdown(parent, text) {
    var pattern = /(\*\*[^*]+\*\*|`[^`]+`)/g;
    var cursor = 0;
    var match;
    while ((match = pattern.exec(text)) !== null) {
      if (match.index > cursor) parent.appendChild(document.createTextNode(text.slice(cursor, match.index)));
      var token = match[0];
      var node = token.indexOf("**") === 0
        ? document.createElement("strong")
        : document.createElement("code");
      node.textContent = token.indexOf("**") === 0 ? token.slice(2, -2) : token.slice(1, -1);
      parent.appendChild(node);
      cursor = match.index + token.length;
    }
    if (cursor < text.length) parent.appendChild(document.createTextNode(text.slice(cursor)));
  }

  function renderMessageContent(bubble, text) {
    var lines = String(text || "").replace(/\r\n/g, "\n").split("\n");
    var fragment = document.createDocumentFragment();
    var list = null;
    var codeLines = null;

    function finishList() { list = null; }
    function finishCode() {
      if (!codeLines) return;
      var pre = document.createElement("pre");
      var code = document.createElement("code");
      code.textContent = codeLines.join("\n");
      pre.appendChild(code);
      fragment.appendChild(pre);
      codeLines = null;
    }

    lines.forEach(function (line) {
      if (/^```/.test(line)) {
        finishList();
        if (codeLines) finishCode();
        else codeLines = [];
        return;
      }
      if (codeLines) {
        codeLines.push(line);
        return;
      }
      if (!line.trim()) {
        finishList();
        return;
      }

      var listMatch = line.match(/^\s*(-|\*)\s+(.+)$/);
      var orderedMatch = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (listMatch || orderedMatch) {
        var tag = orderedMatch ? "ol" : "ul";
        if (!list || list.tagName.toLowerCase() !== tag) {
          list = document.createElement(tag);
          fragment.appendChild(list);
        }
        var item = document.createElement("li");
        appendInlineMarkdown(item, (orderedMatch || listMatch)[orderedMatch ? 1 : 2]);
        list.appendChild(item);
        return;
      }

      finishList();
      var heading = line.match(/^(#{1,3})\s+(.+)$/);
      var block = document.createElement(heading ? "h" + heading[1].length : "p");
      appendInlineMarkdown(block, heading ? heading[2] : line);
      fragment.appendChild(block);
    });
    finishCode();
    bubble.replaceChildren(fragment);
    bubble.classList.add("chat-markdown");
  }

  function appendMessageBubble(role, text) {
    var row = document.createElement("div");
    row.className = "message-row " + (role === "user" ? "user" : "ai");

    var bubble = document.createElement("div");
    bubble.className = "chat-bubble " + (role === "user" ? "chat-bubble-user" : "chat-bubble-ai");
    bubble.setAttribute("data-message-content", "");
    renderMessageContent(bubble, text);

    row.appendChild(bubble);
    stream.appendChild(row);
    scrollToEnd(true);
    return bubble;
  }

  function appendErrorBubble(text) {
    var bubble = appendMessageBubble("assistant", text);
    bubble.setAttribute("role", "alert");
    bubble.classList.add("chat-bubble-error");
    return bubble;
  }

  document.querySelectorAll("[data-message-content]").forEach(function (bubble) {
    renderMessageContent(bubble, bubble.textContent || "");
  });

  function appendToolNotice(text) {
    var row = document.createElement("div");
    row.className = "message-row ai tool-notice";
    row.style.opacity = "0.7";
    row.style.fontSize = "0.8em";

    var bubble = document.createElement("div");
    bubble.className = "chat-bubble chat-bubble-ai";
    bubble.textContent = text;

    row.appendChild(bubble);
    stream.appendChild(row);
    scrollToEnd(true);
  }

  function setStreamingState(streaming) {
    ButlerState.set({ isStreaming: streaming });
    sendBtn.disabled = streaming;
    stopBtn.hidden = !streaming;
    input.disabled = false;
    form.setAttribute("aria-busy", streaming ? "true" : "false");
    if (documentPick) documentPick.disabled = streaming;
    promptCards.forEach(function (card) { card.disabled = streaming; });
  }

  function autoResize(el) {
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  }

  // ---------- Message conversion ----------
  // Convert ButlerState messages -> OpenAI-compatible wire format.
  // MUST preserve tool_calls (on assistant messages) and tool_call_id
  // (on tool messages) so the tool loop actually works.
  function toWireMessages(list) {
    return list.map(function (m) {
      var out = { role: m.role, content: m.content == null ? "" : m.content };
      if (Array.isArray(m.tool_calls) && m.tool_calls.length > 0) {
        out.tool_calls = m.tool_calls;
        // OpenAI protocol: assistant tool-call messages may have null content.
        if (!out.content) out.content = "";
      }
      if (m.tool_call_id) out.tool_call_id = m.tool_call_id;
      if (Array.isArray(m.attachments) && m.attachments.length > 0) {
        out.attachments = m.attachments;
      }
      return out;
    });
  }

  // Push into ButlerState so the message survives across the loop.
  function record(msg) {
    ButlerState.addMessage(Object.assign({ id: "m-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6) }, msg));
  }

  // ---------- Single streaming round ----------
  // Returns the assistant message from that round.
  async function runOneRound(signal) {
    var messages = toWireMessages(ButlerState.get().messages);
    var localBubble = null;
    var assistantMsg = null;

    await ButlerChatClient.streamChat({
      messages: messages,
      sessionId: ButlerState.get().activeSessionId || null,
      model: "deepseek-v4-flash",
      personality: "standard",
      signal: signal,
      callbacks: {
        onContentDelta: function (delta) {
          var stickToBottom = isNearEnd();
          if (!localBubble) {
            localBubble = appendMessageBubble("assistant", "");
            pendingBubble = localBubble;
          }
          localBubble.textContent += delta;
          if (stickToBottom) scrollToEnd(true);
        },
        onToolCall: function (call) {
          console.info("[chat] tool call:", call.function && call.function.name);
        },
        onAssistantMessage: function (msg) {
          assistantMsg = msg;
        },
        onError: function (err) {
          console.warn("[chat] stream error:", err && err.message ? err.message : err);
        },
      },
    });

    pendingBubble = null;
    if (localBubble) renderMessageContent(localBubble, assistantMsg && assistantMsg.content ? assistantMsg.content : localBubble.textContent);
    return assistantMsg || { role: "assistant", content: "" };
  }

  // ---------- Confirmation card ----------
  var ACTION_LABELS = {
    create: "Create", update: "Update", delete: "Delete",
    toggle: "Toggle", toggle_pin: "Pin/Unpin", list: "List",
  };

  function escHtml(str) {
    var d = document.createElement("div");
    d.textContent = str || "";
    return d.innerHTML;
  }

  function getToolLabel(call) {
    var name = (call.function && call.function.name) || "unknown";
    var args = {};
    try { args = JSON.parse(call.function.arguments || "{}"); } catch (_) {}

    var parts = name.split("_");
    var type = (parts[0] || "action").charAt(0).toUpperCase() + (parts[0] || "").slice(1);
    var action = parts.slice(1).join("_");
    var actionLabel = ACTION_LABELS[action] || action;

    var title = args.title || args.name || "";
    var due = args.dueDate || args.date || "";
    if (due) {
      try {
        var d = new Date(due);
        if (!isNaN(d.getTime())) {
          due = d.toLocaleDateString("en", { weekday: "short", month: "short", day: "numeric" });
        }
      } catch (_) {}
    }

    var priority = args.priority || "";
    var description = args.description || args.content || "";
    if (description.length > 80) description = description.slice(0, 80) + "…";

    var summary = title || name.replace(/_/g, " ");
    return {
      type: type,
      action: action,
      actionLabel: actionLabel,
      title: summary,
      due: due ? "Due: " + due : "",
      priority: priority,
      description: description,
    };
  }

  function showConfirmationCard(toolCalls) {
    return new Promise(function (resolve) {
      var row = document.createElement("div");
      row.className = "message-row ai";

      var card = document.createElement("div");
      card.className = "tool-confirm-card";

      var items = [];

      toolCalls.forEach(function (call, idx) {
        var info = getToolLabel(call);
        var item = document.createElement("div");
        item.className = "tool-confirm-item";
        item.setAttribute("data-idx", idx);

        var priorityHtml = "";
        if (info.priority) {
          var pClass = "tool-confirm-priority tool-confirm-priority--" + info.priority;
          priorityHtml = '<span class="' + pClass + '">' + escHtml(info.priority) + '</span>';
        }

        var descHtml = "";
        if (info.description) {
          descHtml = '<span class="tool-confirm-desc">' + escHtml(info.description) + '</span>';
        }

        item.innerHTML =
          '<div class="tool-confirm-item-info">' +
            '<span class="tool-confirm-badge">' + escHtml(info.type) + '</span>' +
            '<span class="tool-confirm-action-label">' + escHtml(info.actionLabel) + '</span>' +
            '<strong>' + escHtml(info.title) + '</strong>' +
            (info.due ? '<span class="tool-confirm-due">' + escHtml(info.due) + '</span>' : '') +
            priorityHtml +
          '</div>' +
          (descHtml ? '<div class="tool-confirm-item-detail">' + descHtml + '</div>' : '') +
          '<div class="tool-confirm-item-actions">' +
            '<button class="tool-confirm-accept" type="button" data-action="accept" data-idx="' + idx + '">Accept</button>' +
            '<button class="tool-confirm-decline" type="button" data-action="decline" data-idx="' + idx + '">Decline</button>' +
          '</div>';
        card.appendChild(item);
        items.push({ call: call, el: item, accepted: null });
      });

      var footer = document.createElement("div");
      footer.className = "tool-confirm-footer";
      footer.innerHTML =
        '<button class="tool-confirm-accept-all" type="button" data-action="accept-all">Accept all</button>' +
        '<button class="tool-confirm-decline-all" type="button" data-action="decline-all">Decline all</button>';
      card.appendChild(footer);

      row.appendChild(card);
      stream.appendChild(row);
      scrollToEnd(true);
      setStatus("Review the proposed changes before they run.");

      function checkDone() {
        var allDecided = items.every(function (it) { return it.accepted !== null; });
        if (!allDecided) return;
        var accepted = [];
        var declined = [];
        items.forEach(function (it) {
          if (it.accepted) accepted.push(it.call);
          else declined.push(it.call);
        });
        resolve({ accepted: accepted, declined: declined });
      }

      function markItem(idx, accepted) {
        var it = items[idx];
        if (!it || it.accepted !== null) return;
        it.accepted = accepted;
        it.el.classList.add(accepted ? "confirmed" : "declined");
        var btns = it.el.querySelectorAll("button");
        for (var b = 0; b < btns.length; b++) btns[b].disabled = true;
        checkDone();
      }

      card.addEventListener("click", function (ev) {
        var btn = ev.target.closest && ev.target.closest("button");
        if (!btn) return;
        var action = btn.getAttribute("data-action");
        if (action === "accept-all") {
          items.forEach(function (it, i) { markItem(i, true); });
        } else if (action === "decline-all") {
          items.forEach(function (it, i) { markItem(i, false); });
        } else if (action === "accept") {
          markItem(Number(btn.getAttribute("data-idx")), true);
        } else if (action === "decline") {
          markItem(Number(btn.getAttribute("data-idx")), false);
        }
      });
    });
  }

  // ---------- Tool execution ----------
  function requiresConfirmation(call) {
    var name = call && call.function && call.function.name;
    return /_(create|update|delete|toggle|toggle_pin)$/.test(name || "");
  }

  async function runToolCalls(toolCalls) {
    if (!window.ButlerToolExecutor) {
      console.warn("[chat] tool executor missing; skipping", toolCalls.length, "tool calls");
      return toolCalls.map(function (c) {
        return { tool_call_id: c.id, content: JSON.stringify({ ok: false, error: "Executor not loaded." }) };
      });
    }

    var writeCalls = toolCalls.filter(requiresConfirmation);
    var decision = writeCalls.length
      ? await showConfirmationCard(writeCalls)
      : { accepted: [], declined: [] };
    var acceptedIds = new Set(decision.accepted.map(function (call) { return call.id; }));
    var declinedIds = new Set(decision.declined.map(function (call) { return call.id; }));

    var results = [];

    // Read-only calls run immediately. Write calls only run after approval.
    for (var i = 0; i < toolCalls.length; i += 1) {
      var call = toolCalls[i];
      if (declinedIds.has(call.id)) {
        results.push({
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: "User declined this action." }),
        });
        continue;
      }
      if (requiresConfirmation(call) && !acceptedIds.has(call.id)) continue;
      var name = call.function && call.function.name;
      appendToolNotice((requiresConfirmation(call) ? "Applying " : "Reading ") + name + "...");
      setStatus(requiresConfirmation(call) ? "Applying approved change." : "Reading your workspace.");
      var content = await ButlerToolExecutor.execute(call);
      results.push({ tool_call_id: call.id, content: content });
    }

    return results;
  }

  // ---------- Main send flow ----------
  async function sendMessage(text) {
    if (ButlerState.get().isStreaming) return;
    var trimmed = String(text || "").trim();
    if (!trimmed && selectedDocuments.length === 0) return;

    await sessionReady;

    hideEmptyBlock();

    var documentsForMessage = selectedDocuments.slice();
    var visibleText = trimmed || "Please review the attached document(s).";
    record({ role: "user", content: visibleText, attachments: documentsForMessage });
    appendMessageBubble("user", visibleText + (documentsForMessage.length
      ? "\n\nAttached: " + documentsForMessage.map(function (doc) { return doc.name; }).join(", ")
      : ""));

    selectedDocuments = [];
    renderSelectedDocuments();

    input.value = "";
    autoResize(input);

    setStreamingState(true);
    setStatus("Butler is responding.");
    abortController = new AbortController();

    try {
      var round = 0;
      while (round < MAX_TOOL_ROUNDS) {
        var assistantMsg = await runOneRound(abortController.signal);

        // Record the assistant turn (may have content and/or tool_calls).
        record({
          role: "assistant",
          content: assistantMsg.content || "",
          tool_calls: assistantMsg.tool_calls,
        });

        if (!Array.isArray(assistantMsg.tool_calls) || assistantMsg.tool_calls.length === 0) {
          break; // No tools -> conversation turn complete.
        }

        var results = await runToolCalls(assistantMsg.tool_calls);
        results.forEach(function (r) {
          record({ role: "tool", tool_call_id: r.tool_call_id, content: r.content });
        });

        round += 1;
      }

      if (round >= MAX_TOOL_ROUNDS) {
        appendToolNotice("Reached tool-call limit (" + MAX_TOOL_ROUNDS + "). Stopping.");
      }
      setStatus("Response complete.");
    } catch (err) {
      if (err && (err.name === "AbortError" || err.name === "DOMException")) {
        appendToolNotice("Generation stopped.");
        setStatus("Generation stopped.");
      } else {
        console.error("[chat] send failed:", err);
        appendErrorBubble("Butler could not answer. " + (err && err.message ? err.message : "Try again."));
        setStatus("The response failed. You can try again.");
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
    if (ButlerState.get().isStreaming) return;
    sendMessage(input.value);
  });

  input.addEventListener("input", function () { autoResize(input); });

  function renderSelectedDocuments() {
    if (!documentList) return;
    documentList.innerHTML = "";
    documentList.hidden = selectedDocuments.length === 0;
    selectedDocuments.forEach(function (attachedDocument, index) {
      var chip = window.document.createElement("div");
      chip.className = "attachment-preview";
      var label = window.document.createElement("span");
      label.textContent = attachedDocument.name + (attachedDocument.truncated ? " (text truncated)" : "");
      var remove = window.document.createElement("button");
      remove.type = "button";
      remove.className = "glass-btn";
      remove.textContent = "Remove";
      remove.addEventListener("click", function () {
        selectedDocuments.splice(index, 1);
        renderSelectedDocuments();
      });
      chip.appendChild(label);
      chip.appendChild(remove);
      documentList.appendChild(chip);
    });
  }

  async function uploadDocument(file) {
    var body = new FormData();
    body.append("document", file);
    var response = await fetch("/api/documents/decode", {
      method: "POST",
      credentials: "same-origin",
      body: body,
    });
    var payload = await response.json();
    if (!response.ok || !payload || payload.ok === false) {
      throw new Error((payload && payload.error) || ("HTTP " + response.status));
    }
    return payload.data.document;
  }

  if (documentPick && documentInput) {
    documentPick.addEventListener("click", function () { documentInput.click(); });
    documentInput.addEventListener("change", async function () {
      var files = Array.from(documentInput.files || []).slice(0, Math.max(0, 3 - selectedDocuments.length));
      documentPick.disabled = true;
      documentPick.textContent = "Decoding...";
      setStatus("Decoding selected documents.");
      try {
        for (var i = 0; i < files.length; i += 1) {
          selectedDocuments.push(await uploadDocument(files[i]));
          renderSelectedDocuments();
        }
      } catch (err) {
        appendToolNotice("Document upload failed: " + err.message);
        setStatus("A document could not be decoded. Remove it or try another file.");
      } finally {
        documentInput.value = "";
        documentPick.disabled = false;
        documentPick.textContent = "Attach";
      }
    });
  }

  input.addEventListener("keydown", function (event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      if (ButlerState.get().isStreaming) return;
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
      if (ButlerState.get().isStreaming) return;
      var prompt = card.getAttribute("data-prompt") || "";
      input.value = prompt;
      autoResize(input);
      sendMessage(prompt);
    });
  });
})();
