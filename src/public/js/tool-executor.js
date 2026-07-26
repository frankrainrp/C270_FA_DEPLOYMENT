// ============================================================
// public/js/tool-executor.js
// Executes AI tool calls by dispatching to the REST API layer
// (/api/tasks, /api/notes, /api/calendar), which in turn talks to
// MongoDB.  The result payload (or an error string) is returned
// to chat-ui.js so it can be appended to the message list as a
// role: "tool" message for the next round of the chat loop.
//
// Depends on:
//   ButlerApi   (api.js) -- fetch wrapper with { ok, data } envelope
//
// Exposed as:
//   window.ButlerToolExecutor.execute(call) -> Promise<string>
//     'call' is one tool_call from the assistant message:
//       { id, type: "function", function: { name, arguments } }
//     Returns a JSON-stringified result suitable for the tool
//     message content field.
// ============================================================

/** Initializes the browser-side mapping from model tool calls to authenticated REST APIs. */
(function initToolExecutor() {
  if (!window.ButlerApi) return;

  /** Parses a tool's JSON argument string into an object without throwing. */
  function parseArgs(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  // Encode a bag of key/value pairs into a URL query string, skipping
  // empty values.  Used only by the *_list tools.
  /** Serializes non-empty tool arguments into an encoded URL query string. */
  function toQuery(params) {
    var parts = [];
    Object.keys(params || {}).forEach(function (k) {
      var v = params[k];
      if (v === undefined || v === null || v === "") return;
      parts.push(encodeURIComponent(k) + "=" + encodeURIComponent(v));
    });
    return parts.length ? "?" + parts.join("&") : "";
  }

  // Map tool_name -> async (args) => any.
  // Each handler returns a JSON-serialisable value which is passed
  // back to the model as the tool result.
  /** Uses the model tool-call id as an idempotency key for create requests. */
  function idempotencyOptions(call) {
    return call && call.id
      ? { headers: { "Idempotency-Key": String(call.id) } }
      : undefined;
  }

  function generateUuid() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "tool-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  var HANDLERS = {
    // ---------- TASKS ----------
    // Creates an account-scoped task and forwards the tool-call id for idempotency.
    task_create: function (args, call) {
      return ButlerApi.post("/tasks", {
        title:       args.title,
        description: args.description,
        dueDate:     args.dueDate,
        priority:    args.priority,
      }, { headers: { "Idempotency-Key": (call && call.id) ? String(call.id) : generateUuid() } });
    },
    // Updates the editable fields of an existing task.
    task_update: function (args) {
      return ButlerApi.patch("/tasks/" + args.id, {
        title:       args.title,
        description: args.description,
        dueDate:     args.dueDate,
        priority:    args.priority,
        status:      args.status,
        completed:   args.completed,
      });
    },
    // Deletes an existing task by its MongoDB id.
    task_delete: function (args) {
      return ButlerApi.del("/tasks/" + args.id);
    },
    // Toggles the completed state of an existing task.
    task_toggle: function (args) {
      return ButlerApi.patch("/tasks/" + args.id + "/toggle");
    },
    // Reads tasks using the requested task view filter.
    task_list: function (args) {
      return ButlerApi.get("/tasks" + toQuery({ view: args.view || "all" }));
    },
    // Reads deterministic task progress metrics instead of asking the model to count raw records.
    task_summary: function (args) {
      return ButlerApi.get("/tasks/summary" + toQuery({ days: args.days || 7 }));
    },
    // Combines task, note, and calendar data for a grounded study plan.
    study_briefing: function (args) {
      return ButlerApi.get("/briefing" + toQuery({ days: args.days || 7 }));
    },

    // ---------- NOTES ----------
    // Creates an account-scoped note and forwards the tool-call id for idempotency.
    note_create: function (args, call) {
      return ButlerApi.post("/notes", {
        title:   args.title,
        content: args.content,
        tags:    args.tags,
        pinned:  args.pinned,
      }, { headers: { "Idempotency-Key": (call && call.id) ? String(call.id) : generateUuid() } });
    },
    // Updates the editable fields of an existing note.
    note_update: function (args) {
      return ButlerApi.patch("/notes/" + args.id, {
        title:   args.title,
        content: args.content,
        tags:    args.tags,
        pinned:  args.pinned,
      });
    },
    // Deletes an existing note by its MongoDB id.
    note_delete: function (args) {
      return ButlerApi.del("/notes/" + args.id);
    },
    // Toggles the pinned state of an existing note.
    note_toggle_pin: function (args) {
      return ButlerApi.patch("/notes/" + args.id + "/toggle");
    },
    // Reads notes using the requested pinned-state filter.
    note_list: function (args) {
      return ButlerApi.get("/notes" + toQuery({ filter: args.filter || "all" }));
    },

    // ---------- CALENDAR ----------
    // Creates an account-scoped event and forwards the tool-call id for idempotency.
    event_create: function (args, call) {
      return ButlerApi.post("/calendar", {
        title:       args.title,
        date:        args.date,
        description: args.description,
        color:       args.color,
        tag:         args.tag,
        allDay:      args.allDay,
      }, { headers: { "Idempotency-Key": (call && call.id) ? String(call.id) : generateUuid() } });
    },
    // Updates the editable fields of an existing calendar event.
    event_update: function (args) {
      return ButlerApi.patch("/calendar/" + args.id, {
        title:       args.title,
        date:        args.date,
        description: args.description,
        color:       args.color,
        tag:         args.tag,
        allDay:      args.allDay,
      });
    },
    // Deletes an existing calendar event by its MongoDB id.
    event_delete: function (args) {
      return ButlerApi.del("/calendar/" + args.id);
    },
    // Reads all events or the upcoming event window requested by the model.
    event_list: function (args) {
      if (args.scope === "upcoming") return ButlerApi.get("/calendar/upcoming");
      return ButlerApi.get("/calendar");
    },
  };

  // Fire a DOM event after any write so tasks/notes/calendar pages
  // can refresh themselves without a full navigation.
  // Also broadcast cross-tab so other open pages refresh too.
  var channel = null;
  try { channel = new BroadcastChannel("butler-data"); } catch (_) {}

  /** Notifies the current page and other tabs after a successful agent write. */
  function dispatchChanged(toolName) {
    try {
      window.dispatchEvent(new CustomEvent("butler:data-changed", {
        detail: { tool: toolName },
      }));
    } catch (_) { /* older browsers */ }

    // Cross-tab broadcast
    if (channel) {
      try { channel.postMessage({ tool: toolName }); } catch (_) {}
    }
  }

  var WRITE_TOOLS = /_(create|update|delete|toggle|toggle_pin)$/;

  /**
   * @param {Object} call - tool_call object from the assistant message.
   * @returns {Promise<string>} JSON-encoded result for the tool message.
   */
  async function execute(call) {
    var name = call && call.function && call.function.name;
    var handler = HANDLERS[name];
    if (!handler) {
      return JSON.stringify({ ok: false, error: "Unknown tool: " + name });
    }
    var args = parseArgs(call.function && call.function.arguments);

    try {
      var data = await handler(args, call);
      if (WRITE_TOOLS.test(name)) dispatchChanged(name);
      return JSON.stringify({ ok: true, data: data });
    } catch (err) {
      var msg = (err && err.message) ? err.message : String(err);
      return JSON.stringify({ ok: false, error: msg });
    }
  }

  window.ButlerToolExecutor = {
    execute: execute,
    knownTools: Object.keys(HANDLERS),
  };
})();
