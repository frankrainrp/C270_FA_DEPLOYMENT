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

(function initToolExecutor() {
  if (!window.ButlerApi) return;

  function parseArgs(raw) {
    if (!raw) return {};
    if (typeof raw === "object") return raw;
    try { return JSON.parse(raw); } catch (_) { return {}; }
  }

  // Encode a bag of key/value pairs into a URL query string, skipping
  // empty values.  Used only by the *_list tools.
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
  var HANDLERS = {
    // ---------- TASKS ----------
    task_create: function (args) {
      return ButlerApi.post("/tasks", {
        title:       args.title,
        description: args.description,
        dueDate:     args.dueDate,
        priority:    args.priority,
      });
    },
    task_update: function (args) {
      return ButlerApi.put("/tasks/" + args.id, {
        title:       args.title,
        description: args.description,
        dueDate:     args.dueDate,
        priority:    args.priority,
        completed:   args.completed,
      });
    },
    task_delete: function (args) {
      return ButlerApi.del("/tasks/" + args.id);
    },
    task_toggle: function (args) {
      return ButlerApi.patch("/tasks/" + args.id + "/toggle");
    },
    task_list: function (args) {
      return ButlerApi.get("/tasks" + toQuery({ view: args.view || "all" }));
    },

    // ---------- NOTES ----------
    note_create: function (args) {
      return ButlerApi.post("/notes", {
        title:   args.title,
        content: args.content,
        tags:    args.tags,
        pinned:  args.pinned,
      });
    },
    note_update: function (args) {
      return ButlerApi.put("/notes/" + args.id, {
        title:   args.title,
        content: args.content,
        tags:    args.tags,
        pinned:  args.pinned,
      });
    },
    note_delete: function (args) {
      return ButlerApi.del("/notes/" + args.id);
    },
    note_toggle_pin: function (args) {
      return ButlerApi.patch("/notes/" + args.id + "/toggle");
    },
    note_list: function (args) {
      return ButlerApi.get("/notes" + toQuery({ filter: args.filter || "all" }));
    },

    // ---------- CALENDAR ----------
    event_create: function (args) {
      return ButlerApi.post("/calendar", {
        title:       args.title,
        date:        args.date,
        description: args.description,
        color:       args.color,
        tag:         args.tag,
        allDay:      args.allDay,
      });
    },
    event_update: function (args) {
      return ButlerApi.put("/calendar/" + args.id, {
        title:       args.title,
        date:        args.date,
        description: args.description,
        color:       args.color,
        tag:         args.tag,
        allDay:      args.allDay,
      });
    },
    event_delete: function (args) {
      return ButlerApi.del("/calendar/" + args.id);
    },
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
      var data = await handler(args);
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
