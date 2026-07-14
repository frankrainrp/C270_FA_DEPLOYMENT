// ============================================================
// public/js/tasks-ui.js
// Controls the /tasks page. Talks to the JSON API via ButlerApi:
//   - Toggle complete -> PATCH  /tasks/:id/toggle
//   - Delete          -> DELETE /tasks/:id
//   - Create          -> POST   /tasks
//   - Edit            -> (opens detail drawer)
// After any write, we reload the page so the task list and stats
// stay in sync with the database.
// ============================================================

(function initTasksUi() {
  if (!window.ButlerApi) return;

  const root = document.querySelector("[data-tasks-root]");
  if (!root) return;

  const detailDrawer = document.getElementById("task-detail-drawer");
  const newTaskDrawer = document.getElementById("new-task-drawer");
  const newTaskForm = document.getElementById("new-task-form");

  // ---- Helpers ----
  function reload() {
    window.location.reload();
  }

  function showError(action, err) {
    alert(action + " failed: " + (err && err.message ? err.message : "unknown error"));
  }

  // ---- Drawers ----
  function openDetailDrawer(taskCard) {
    if (!detailDrawer || !taskCard) return;

    const title = detailDrawer.querySelector("#task-detail-title");
    const priority = detailDrawer.querySelector("#task-detail-priority");
    const due = detailDrawer.querySelector("#task-detail-due");
    const description = detailDrawer.querySelector("#task-detail-description");
    const notes = detailDrawer.querySelector("#task-detail-notes");

    title.textContent = taskCard.dataset.title || "Task Detail";
    priority.textContent = `Priority: ${taskCard.dataset.priority || 'medium'}`;
    due.textContent = `Due: ${taskCard.dataset.due || 'No due date'}`;
    description.textContent = taskCard.dataset.description || "No description provided.";
    notes.textContent = taskCard.dataset.notes || "No notes yet.";

    detailDrawer.setAttribute("aria-hidden", "false");
  }

  function closeDetailDrawer() {
    if (detailDrawer) detailDrawer.setAttribute("aria-hidden", "true");
  }

  function openNewTaskDrawer() {
    if (newTaskDrawer) {
      newTaskDrawer.setAttribute("aria-hidden", "false");
      const titleInput = newTaskDrawer.querySelector("#new-task-title");
      if (titleInput) titleInput.focus();
    }
  }

  function closeNewTaskDrawer() {
    if (newTaskDrawer) {
      newTaskDrawer.setAttribute("aria-hidden", "true");
    }
  }

  // ---- Event Listeners ----
  // This listener handles actions inside the main tasks panel.
  root.addEventListener("click", async (ev) => {
    const target = ev.target;
    const taskCard = target.closest(".task-card");
    const taskId = taskCard ? taskCard.dataset.taskId : null;

    // Note: using 'click' for the checkbox toggle is fine since we reload
    // the page. The 'change' event is not strictly necessary here.
    if (target.closest("[data-task-toggle]") && taskId) {
      try {
        await ButlerApi.patch(`/tasks/${taskId}/toggle`);
        reload();
      } catch (err) {
        showError("Update task", err);
        // We don't manually revert the checkbox state because a reload
        // on success is the source of truth.
      }
      return;
    }

    if (target.closest("[data-task-delete]") && taskId) {
      if (!confirm("Are you sure you want to delete this task?")) return;
      try {
        await ButlerApi.del(`/tasks/${taskId}`);
        reload();
      } catch (err) {
        showError("Delete task", err);
      }
      return;
    }

    if (target.closest("[data-task-edit]") && taskCard) {
      openDetailDrawer(taskCard);
      return;
    }

    if (target.closest("[data-close-drawer]")) {
      closeDetailDrawer();
      return;
    }

    if (target.closest("[data-close-new-task]")) {
      closeNewTaskDrawer();
      return;
    }

    if (target.closest("[data-refresh-tasks]")) {
      reload();
      return;
    }
  });

  // The "New Task" button can be in the sidebar rail, outside the root.
  document.addEventListener("click", (ev) => {
    if (ev.target.closest("[data-open-new-task]")) {
      openNewTaskDrawer();
    }
  });

  if (newTaskForm) {
    newTaskForm.addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const submitBtn = newTaskForm.querySelector("button[type='submit']");
      const formData = new FormData(newTaskForm);
      const payload = Object.fromEntries(formData.entries());

      if (!payload.title || !payload.title.trim()) {
        alert("Title is required.");
        return;
      }

      // Remove empty fields so the backend can apply defaults
      for (const key in payload) {
        if (payload[key] === "") delete payload[key];
      }

      if (submitBtn) submitBtn.disabled = true;
      try {
        await ButlerApi.post("/tasks", payload);
        reload();
      } catch (err) {
        showError("Create task", err);
        if (submitBtn) submitBtn.disabled = false;
      }
    });
  }

  // ---- Auto-refresh on AI changes ----
  function reloadIfTaskChanged(tool) {
    if (!tool || tool.startsWith("task_")) {
      reload();
    }
  }

  window.addEventListener("butler:data-changed", (ev) => {
    reloadIfTaskChanged(ev && ev.detail && ev.detail.tool);
  });

  try {
    const bc = new BroadcastChannel("butler-data");
    bc.onmessage = (ev) => {
      reloadIfTaskChanged(ev.data && ev.data.tool);
    };
  } catch (_) { /* BroadcastChannel not supported */ }
})();