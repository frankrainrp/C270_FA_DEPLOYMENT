// ============================================================
// public/js/app-state.js
// Simple client-side state container.  Replaces the React hooks
// (useCoreAppData / useChatSessions) with a minimal event emitter.
//
// State fields (Phase 0 scope):
//   messages        - full chat history for the current session
//   activeSessionId - currently focused chat session
//   pendingReply    - text of the assistant message being streamed
//
// Later phases will grow this to include tasks, notes, and full
// multi-session support.
// ============================================================

(function initAppState() {
  var listeners = [];

  var state = {
    activeSessionId: "local-session",
    messages: [],
    pendingReply: null,
    isStreaming: false,
  };

  function subscribe(fn) {
    listeners.push(fn);
    return function unsubscribe() {
      listeners = listeners.filter(function (l) { return l !== fn; });
    };
  }

  function emit() {
    for (var i = 0; i < listeners.length; i += 1) {
      try { listeners[i](state); } catch (err) { console.error(err); }
    }
  }

  function set(patch) {
    Object.assign(state, patch);
    emit();
  }

  function get() {
    return state;
  }

  function addMessage(msg) {
    state.messages.push(msg);
    emit();
  }

  function updatePendingReply(text) {
    state.pendingReply = text;
    emit();
  }

  function commitPendingReply() {
    if (state.pendingReply != null) {
      state.messages.push({
        id: "m-" + Date.now(),
        role: "assistant",
        content: state.pendingReply,
      });
      state.pendingReply = null;
    }
    emit();
  }

  window.ButlerState = {
    get: get,
    set: set,
    subscribe: subscribe,
    addMessage: addMessage,
    updatePendingReply: updatePendingReply,
    commitPendingReply: commitPendingReply,
  };
})();
