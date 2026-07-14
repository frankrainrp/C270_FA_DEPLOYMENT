// ============================================================
// public/js/app-state.js
// Simple client-side state container.  Replaces the React hooks
// (useCoreAppData / useChatSessions) with a minimal event emitter.
//
// State fields:
//   messages        - full chat history for the current session
//   activeSessionId - currently focused chat session
// Task, note, and calendar state stays in their focused UI modules.
// ============================================================

/** Initializes the shared browser-side chat state and its subscription API. */
(function initAppState() {
  var listeners = [];

  // If chat.ejs injected SSR-rendered history via window.__BUTLER_INIT__,
  // start with those messages already in state so the AI keeps context
  // after a page reload.
  var seedMessages = [];
  var seedSessionId = null;
  try {
    var init = window.__BUTLER_INIT__ || {};
    if (Array.isArray(init.messages)) {
      seedMessages = init.messages.map(function (m, i) {
        return {
          id: "seed-" + i,
          role: m.role,
          content: typeof m.content === "string" ? m.content : "",
          attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
        };
      });
    }
    if (typeof init.activeSessionId === "string" && init.activeSessionId) {
      seedSessionId = init.activeSessionId;
    }
  } catch (_) { /* ignore */ }

  var state = {
    activeSessionId: seedSessionId,
    messages: seedMessages,
    isStreaming: false,
  };

  /** Registers a state listener and returns a function that removes it. */
  function subscribe(fn) {
    listeners.push(fn);
    /** Removes the associated listener from future state notifications. */
    return function unsubscribe() {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  /** Notifies every current subscriber with the latest mutable state object. */
  function emit() {
    for (var i = 0; i < listeners.length; i += 1) {
      try { listeners[i](state); } catch (err) { console.error(err); }
    }
  }

  /** Merges a partial update into state and notifies subscribers. */
  function set(patch) {
    Object.assign(state, patch);
    emit();
  }

  /** Returns the current chat state object. */
  function get() {
    return state;
  }

  /** Appends one message to the active in-memory conversation. */
  function addMessage(msg) {
    state.messages.push(msg);
    emit();
  }

  /** Replaces the active conversation after loading a persisted chat session. */
  function replaceMessages(messages, activeSessionId) {
    state.messages = Array.isArray(messages) ? messages.map(function (message, index) {
      return Object.assign({ id: "loaded-" + index }, message);
    }) : [];
    state.activeSessionId = activeSessionId || null;
    emit();
  }

  window.ButlerState = {
    get: get,
    set: set,
    subscribe: subscribe,
    addMessage: addMessage,
    replaceMessages: replaceMessages,
  };
})();
