// ============================================================
// public/js/tasks-ui.js
// DOM controller for the /tasks page.  Handles:
//   - checkbox toggle -> PATCH /api/tasks/:id/toggle
//   - Delete button   -> DELETE /api/tasks/:id
//   - Refresh button  -> reload the page
//   - butler:data-changed event fired by tool-executor after the
//     agent writes a task -> reload so new/removed rows appear
// ============================================================

(function initTasksUi() {
  if (!window.ButlerApi) return;

  var root = document.querySelector("[data-tasks-root]");
  if (!root) return;

  function reload() {
    window.location.reload();
  }

  root.addEventListener("change", async function (ev) {
    var cb = ev.target;
    if (!cb || !cb.matches || !cb.matches("[data-task-toggle]")) return;

    var card = cb.closest("[data-task-id]");
    if (!card) return;
    var id = card.dataset.taskId;

    try {
      await ButlerApi.patch("/tasks/" + id + "/toggle");
      reload();
    } catch (err) {
      alert("Toggle failed: " + (err && err.message ? err.message : "unknown"));
      cb.checked = !cb.checked;
    }
  });

  root.addEventListener("click", async function (ev) {
    var btn = ev.target;

    if (btn && btn.matches && btn.matches("[data-task-delete]")) {
      var card = btn.closest("[data-task-id]");
      if (!card) return;
      if (!confirm("Delete this task?")) return;
      try {
        await ButlerApi.del("/tasks/" + card.dataset.taskId);
        reload();
      } catch (err) {
        alert("Delete failed: " + (err && err.message ? err.message : "unknown"));
      }
      return;
    }

    if (btn && btn.matches && btn.matches("[data-refresh-tasks]")) {
      reload();
    }
  });

  window.addEventListener("butler:data-changed", function (ev) {
    var tool = ev && ev.detail && ev.detail.tool;
    if (!tool || tool.indexOf("task_") === 0) reload();
  });

  // Cross-tab: reload when another tab (e.g. Chat) modifies tasks
  try {
    var bc = new BroadcastChannel("butler-data");
    bc.onmessage = function (ev) {
      var tool = ev.data && ev.data.tool;
      if (!tool || tool.indexOf("task_") === 0) reload();
    };
  } catch (_) {}
})();
