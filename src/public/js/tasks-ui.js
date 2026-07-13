// ============================================================
// public/js/tasks-ui.js
// DOM controller for the /tasks page.  Handles:
//   - checkbox toggle -> PATCH /api/tasks/:id/toggle
//   - Delete button   -> DELETE /api/tasks/:id
//   - Refresh button  -> reload the page
//   - New Task button -> opens a form drawer, POST /api/tasks
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

  // ----------------------------------------------------------
  // New Task drawer (sidebar "+ New Task" button lives outside
  // [data-tasks-root], in the layout sidebar, so this listener
  // is attached to the whole document rather than root).
  // ----------------------------------------------------------
  var newTaskDrawer = document.getElementById("new-task-drawer");
  var newTaskForm = document.getElementById("new-task-form");

  document.addEventListener("click", function (ev) {
    var opener = ev.target.closest && ev.target.closest("[data-open-new-task]");
    if (opener) {
      if (newTaskDrawer) {
        newTaskDrawer.classList.add("is-open");
        newTaskDrawer.setAttribute("aria-hidden", "false");
        var titleInput = document.getElementById("new-task-title");
        if (titleInput) titleInput.focus();
      }
      return;
    }
    if (ev.target.matches && ev.target.matches("[data-close-new-task]")) {
      if (newTaskDrawer) {
        newTaskDrawer.classList.remove("is-open");
        newTaskDrawer.setAttribute("aria-hidden", "true");
      }
    }
  });

  if (newTaskForm) {
    newTaskForm.addEventListener("submit", async function (ev) {
      ev.preventDefault();
      var submitBtn = newTaskForm.querySelector("button[type='submit']");
      var formData = new FormData(newTaskForm);
      var payload = {
        title: (formData.get("title") || "").toString().trim(),
        description: (formData.get("description") || "").toString().trim(),
        dueDate: formData.get("dueDate") || null,
        priority: formData.get("priority") || "medium",
      };
      if (!payload.title) {
        alert("Title is required.");
        return;
      }
      if (submitBtn) submitBtn.disabled = true;
      try {
        if (typeof ButlerApi.post === "function") {
          await ButlerApi.post("/tasks", payload);
        } else {
          // Fallback in case api.js doesn't expose a post() helper yet.
          var res = await fetch("/api/tasks", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify(payload),
          });
          if (!res.ok) {
            var body = await res.json().catch(function () { return {}; });
            throw new Error(body.message || body.error || ("Request failed: " + res.status));
          }
        }
        reload();
      } catch (err) {
        alert("Create failed: " + (err && err.message ? err.message : "unknown"));
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }
})();