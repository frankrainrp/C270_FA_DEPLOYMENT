// ============================================================
// public/js/tasks-ui.js
// DOM controller for the /tasks page. Handles:
//   - checkbox toggle -> PATCH /api/tasks/:id/toggle
//   - Edit button      -> load task and PUT /api/tasks/:id
//   - Delete button    -> DELETE /api/tasks/:id
//   - Refresh button   -> reload the page
// ============================================================

(function initTasksUi() {
  if (!window.ButlerApi) return;

  var root = document.querySelector("[data-tasks-root]");
  if (!root) return;
  var body = document.body;

  function injectStyles() {
    if (document.getElementById("task-ui-styles")) return;

    var style = document.createElement("style");
    style.id = "task-ui-styles";
    style.textContent = [
      ".task-create-modal-overlay{position:fixed;inset:0;z-index:80;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(20,24,28,.45);backdrop-filter:blur(8px);}",
      ".task-create-modal{width:min(720px,calc(100vw - 32px));max-height:min(90vh,860px);overflow:auto;border:1px solid var(--glass-border);border-radius:24px;background:var(--color-surface);box-shadow:0 30px 80px rgba(0,0,0,.18);color:var(--color-text);}",
      ".task-create-modal-header,.task-create-modal-footer{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:18px 20px;}",
      ".task-create-modal-header{border-bottom:1px solid var(--color-border-soft);}",
      ".task-create-modal-footer{border-top:1px solid var(--color-border-soft);align-items:flex-end;}",
      ".task-create-modal-body{display:grid;gap:14px;padding:18px 20px 8px;}",
      ".task-create-field{display:grid;gap:6px;}",
      ".task-create-field span{font-size:12px;font-weight:700;letter-spacing:.02em;color:var(--color-text-muted);text-transform:uppercase;}",
      ".task-create-field input,.task-create-field textarea,.task-create-field select{width:100%;box-sizing:border-box;border:1px solid var(--color-border-soft);border-radius:14px;background:var(--color-bg);color:var(--color-text);padding:12px 14px;font:inherit;outline:none;}",
      ".task-create-field input:focus,.task-create-field textarea:focus,.task-create-field select:focus{border-color:var(--color-primary);box-shadow:0 0 0 3px color-mix(in srgb, var(--color-primary) 18%, transparent);}",
      ".task-create-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;}",
      ".task-create-note{margin:0;color:var(--color-text-muted);font-size:12px;max-width:42ch;}",
      ".task-create-actions{display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end;}",
      ".task-actions .task-edit-trigger{margin-right:8px;}",
      "@media (max-width: 720px){.task-create-grid{grid-template-columns:1fr;}.task-create-modal-header,.task-create-modal-footer{flex-direction:column;align-items:stretch;}.task-create-actions{justify-content:stretch;}.task-create-actions .glass-btn{width:100%;}}"
    ].join("\n");

    document.head.appendChild(style);
  }

  function reload() {
    window.location.reload();
  }

  function currentView() {
    var params = new URLSearchParams(window.location.search);
    var raw = (params.get("view") || "active").toLowerCase();
    return ["active", "in_progress", "upcoming", "all", "completed"].indexOf(raw) >= 0 ? raw : "active";
  }

  function viewLabel(view) {
    return {
      active: "Active",
      in_progress: "In Progress",
      upcoming: "Upcoming",
      all: "All Tasks",
      completed: "Completed",
    }[view] || "Active";
  }

  function syncViewUi() {
    var view = currentView();
    var label = viewLabel(view);
    var labelNode = root.querySelector("[data-task-view-label]");
    if (labelNode) labelNode.textContent = "Viewing " + label;

    document.querySelectorAll("[data-task-view]").forEach(function (item) {
      var itemView = item.getAttribute("data-task-view");
      item.classList.toggle("active", itemView === view);
    });

    var groups = root.querySelectorAll(".task-group");
    var today = new Date();
    today.setHours(0, 0, 0, 0);

    groups.forEach(function (group) {
      var cards = Array.from(group.querySelectorAll("[data-task-id]"));
      var visibleCount = 0;

      cards.forEach(function (card) {
        var completed = card.getAttribute("data-task-completed") === "true";
        var dueIso = card.getAttribute("data-task-due-date") || "";
        var dueDate = dueIso ? new Date(dueIso) : null;
        if (dueDate && !isNaN(dueDate.getTime())) dueDate.setHours(0, 0, 0, 0);

        var visible = true;
        if (view === "active" || view === "in_progress") {
          visible = !completed;
        } else if (view === "completed") {
          visible = completed;
        } else if (view === "upcoming") {
          visible = !completed && dueDate && dueDate >= today;
        }

        card.hidden = !visible;
        if (visible) visibleCount += 1;
      });

      group.hidden = visibleCount === 0;
    });
  }

  function uniqueIdempotencyKey() {
    if (window.crypto && window.crypto.randomUUID) return window.crypto.randomUUID();
    return "task-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function ensureModal() {
    var modal = document.querySelector("[data-task-modal]");
    if (modal) return modal;

    modal = document.createElement("div");
    modal.className = "task-create-modal-overlay";
    modal.hidden = true;
    modal.setAttribute("data-task-modal", "true");
    modal.innerHTML = [
      '<div class="task-create-modal" role="dialog" aria-modal="true" aria-labelledby="task-modal-title">',
      '  <div class="task-create-modal-header">',
      '    <div>',
      '      <p class="hero-kicker" data-task-modal-kicker>New task</p>',
      '      <h3 id="task-modal-title">Create a study task</h3>',
      '    </div>',
      '    <button type="button" class="glass-btn" data-task-modal-close>Close</button>',
      '  </div>',
      '  <div class="task-create-modal-body">',
      '    <label class="task-create-field">',
      '      <span>Title</span>',
      '      <input type="text" maxlength="200" data-task-modal-title placeholder="Read chapter 4" />',
      '    </label>',
      '    <label class="task-create-field">',
      '      <span>Description</span>',
      '      <textarea rows="4" data-task-modal-description placeholder="What needs to be done?"></textarea>',
      '    </label>',
      '    <div class="task-create-grid">',
      '      <label class="task-create-field">',
      '        <span>Due date</span>',
      '        <input type="date" data-task-modal-due />',
      '      </label>',
      '      <label class="task-create-field">',
      '        <span>Priority</span>',
      '        <select data-task-modal-priority>',
      '          <option value="low">Low</option>',
      '          <option value="medium" selected>Medium</option>',
      '          <option value="high">High</option>',
      '        </select>',
      '      </label>',
      '    </div>',
      '    <label class="task-create-field">',
      '      <span>Status</span>',
      '      <select data-task-modal-status>',
      '        <option value="active">Active</option>',
      '        <option value="in_progress">In Progress</option>',
      '        <option value="upcoming">Upcoming</option>',
      '        <option value="completed">Completed</option>',
      '      </select>',
      '    </label>',
      '    </div>',
      '  <div class="task-create-modal-footer">',
      '    <p class="task-create-note">Create and edit use the same modal. The sidebar stays the only view selector.</p>',
      '    <div class="task-create-actions">',
      '      <button type="button" class="glass-btn" data-task-modal-cancel>Cancel</button>',
      '      <button type="button" class="glass-btn" data-task-modal-submit>Create task</button>',
      '    </div>',
      '  </div>',
      '</div>',
    ].join("");

    body.appendChild(modal);
    return modal;
  }

  function openTaskModal(task) {
    var modal = ensureModal();
    var kicker = modal.querySelector("[data-task-modal-kicker]");
    var titleHeading = modal.querySelector("#task-modal-title");
    var titleInput = modal.querySelector("[data-task-modal-title]");
    var descriptionInput = modal.querySelector("[data-task-modal-description]");
    var dueInput = modal.querySelector("[data-task-modal-due]");
    var priorityInput = modal.querySelector("[data-task-modal-priority]");
    var statusInput = modal.querySelector("[data-task-modal-status]");
    var submitBtn = modal.querySelector("[data-task-modal-submit]");
    var cancelBtn = modal.querySelector("[data-task-modal-cancel]");
    var closeBtn = modal.querySelector("[data-task-modal-close]");
    var editing = Boolean(task && task._id);

    kicker.textContent = editing ? "Edit task" : "New task";
    titleHeading.textContent = editing ? "Edit task" : "Create a study task";
    submitBtn.textContent = editing ? "Save changes" : "Create task";
    titleInput.value = task && task.title ? task.title : "";
    descriptionInput.value = task && task.description ? task.description : "";
    dueInput.value = task && task.dueDate ? String(task.dueDate).slice(0, 10) : "";
    priorityInput.value = task && task.priority ? task.priority : "medium";
    statusInput.value = task && task.status ? task.status : "active";

    function closeModal() {
      modal.hidden = true;
      modal.removeEventListener("click", onBackdropClick);
      document.removeEventListener("keydown", onKeydown);
    }

    function onBackdropClick(ev) {
      if (ev.target === modal) closeModal();
    }

    function onKeydown(ev) {
      if (ev.key === "Escape") closeModal();
    }

    function saveTask() {
      var title = titleInput.value.trim();
      if (!title) {
        alert("Title is required.");
        titleInput.focus();
        return;
      }

      var payload = {
        title: title,
        description: descriptionInput.value.trim(),
        dueDate: dueInput.value || undefined,
        priority: priorityInput.value,
        status: statusInput.value,
      };

      submitBtn.disabled = true;
      var request = editing
        ? ButlerApi.put("/tasks/" + task._id, payload)
        : ButlerApi.post("/tasks", payload, { headers: { "Idempotency-Key": uniqueIdempotencyKey() } });

      request.then(function () {
        closeModal();
        reload();
      }).catch(function (err) {
        submitBtn.disabled = false;
        alert((editing ? "Save failed: " : "Create failed: ") + (err && err.message ? err.message : "unknown"));
      });
    }

    submitBtn.onclick = saveTask;
    cancelBtn.onclick = closeModal;
    closeBtn.onclick = closeModal;
    modal.onclick = onBackdropClick;
    document.addEventListener("keydown", onKeydown);
    modal.hidden = false;
    titleInput.focus();
  }

  async function loadTaskForEdit(card) {
    if (!card) return;
    try {
      var task = (await ButlerApi.get("/tasks/" + card.dataset.taskId)).task;
      openTaskModal(task);
    } catch (err) {
      alert("Load failed: " + (err && err.message ? err.message : "unknown"));
    }
  }

  async function deleteTask(card) {
    if (!card) return;
    if (!confirm("Delete this task?")) return;

    try {
      await ButlerApi.del("/tasks/" + card.dataset.taskId);
      reload();
    } catch (err) {
      alert("Delete failed: " + (err && err.message ? err.message : "unknown"));
    }
  }

  injectStyles();
  syncViewUi();

  root.addEventListener("change", async function (ev) {
    var cb = ev.target;
    if (!cb || !cb.matches || !cb.matches("[data-task-toggle]")) return;

    var card = cb.closest("[data-task-id]");
    if (!card) return;

    try {
      await ButlerApi.patch("/tasks/" + card.dataset.taskId + "/toggle");
      reload();
    } catch (err) {
      alert("Toggle failed: " + (err && err.message ? err.message : "unknown"));
      cb.checked = !cb.checked;
    }
  });

  root.addEventListener("click", async function (ev) {
    var btn = ev.target;

    if (btn && btn.matches && btn.matches("[data-task-edit]")) {
      await loadTaskForEdit(btn.closest("[data-task-id]"));
      return;
    }

    if (btn && btn.matches && btn.matches("[data-task-delete]")) {
      await deleteTask(btn.closest("[data-task-id]"));
      return;
    }

    if (btn && btn.matches && btn.matches("[data-refresh-tasks]")) {
      reload();
    }
  });

  document.addEventListener("click", function (ev) {
    var trigger = ev.target && ev.target.closest ? ev.target.closest("[data-action='new-task']") : null;
    if (!trigger) return;
    ev.preventDefault();
    openTaskModal(null);
  });

  window.addEventListener("butler:data-changed", function (ev) {
    var tool = ev && ev.detail && ev.detail.tool;
    if (!tool || tool.indexOf("task_") === 0) reload();
  });

  try {
    var bc = new BroadcastChannel("butler-data");
    bc.onmessage = function (ev) {
      var tool = ev.data && ev.data.tool;
      if (!tool || tool.indexOf("task_") === 0) reload();
    };
  } catch (_) {}
})();