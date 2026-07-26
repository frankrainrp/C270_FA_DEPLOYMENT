// ============================================================
// public/js/tasks-ui.js
// Cleaned up client controller for the Tasks workspace.
// ============================================================

(function initTasksUi() {
  var root = document.querySelector("[data-tasks-root]");
  if (!root) return;

  // 1. Create Modal HTML (Reusing calendar styles for visual consistency)
  function ensureModal() {
    var existing = document.querySelector("[data-task-modal]");
    if (existing) return existing;
    
    var modal = document.createElement("div");
    modal.className = "calendar-event-modal-overlay"; 
    modal.hidden = true;
    modal.setAttribute("data-task-modal", "true");
    modal.innerHTML = `
      <div class="calendar-event-modal" role="dialog" aria-modal="true">
        <div class="calendar-event-modal-header">
          <div>
            <p class="hero-kicker" data-task-modal-kicker>New Task</p>
            <h3 id="task-modal-title">Create a study task</h3>
          </div>
          <button type="button" class="glass-btn" data-task-modal-close>Close</button>
        </div>
        <div class="calendar-event-modal-body">
          <input type="hidden" data-task-id-input />
          <label class="calendar-event-field">
            <span>Title</span>
            <input type="text" maxlength="200" data-task-title-input placeholder="Task title" />
          </label>
          <label class="calendar-event-field">
            <span>Description</span>
            <textarea rows="4" data-task-desc-input placeholder="Task description"></textarea>
          </label>
          <div class="calendar-event-grid">
            <label class="calendar-event-field">
              <span>Due Date</span>
              <input type="date" data-task-date-input />
            </label>
            <label class="calendar-event-field" data-task-only-field>
              <span>Priority</span>
              <select data-task-priority-input>
                <option value="low">Low</option>
                <option value="medium" selected>Medium</option>
                <option value="high">High</option>
              </select>
            </label>
          </div>
          <label class="calendar-event-field" data-task-only-field>
            <span>Status</span>
            <select data-task-status-input>
              <option value="active" selected>Active</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </label>
        </div>
        <div class="calendar-event-modal-footer">
          <div class="calendar-event-actions" style="width:100%; justify-content:flex-end;">
            <button type="button" class="glass-btn" data-task-modal-cancel>Cancel</button>
            <button type="button" class="glass-btn" data-task-modal-submit>Save task</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    return modal;
  }

  // 2. Open Modal Logic
  function openModal(taskData) {
    var modal = ensureModal();
    var idInput = modal.querySelector("[data-task-id-input]");
    var titleInput = modal.querySelector("[data-task-title-input]");
    var descInput = modal.querySelector("[data-task-desc-input]");
    var dateInput = modal.querySelector("[data-task-date-input]");
    var priorityInput = modal.querySelector("[data-task-priority-input]");
    var statusInput = modal.querySelector("[data-task-status-input]");
    var kicker = modal.querySelector("[data-task-modal-kicker]");
    var titleHeading = modal.querySelector("#task-modal-title");
    var isEvent = Boolean(taskData && taskData.itemType === "event");
    modal.dataset.itemType = isEvent ? "event" : "task";
    modal.querySelectorAll("[data-task-only-field]").forEach(function (field) {
      field.hidden = isEvent;
    });

    if (taskData) {
      kicker.textContent = isEvent ? "Edit calendar event" : "Edit task";
      titleHeading.textContent = isEvent ? "Update event details" : "Update task details";
      idInput.value = taskData.id;
      titleInput.value = taskData.title || "";
      descInput.value = taskData.description || "";
      if (taskData.dueDate) {
         dateInput.value = taskData.dueDate.split('T')[0];
      } else {
         dateInput.value = "";
      }
      priorityInput.value = taskData.priority || "medium";
      
      statusInput.value = taskData.status || (taskData.completed === "true" ? "completed" : "active");
    } else {
      kicker.textContent = "New Task";
      titleHeading.textContent = "Create a study task";
      idInput.value = "";
      titleInput.value = "";
      descInput.value = "";
      dateInput.value = "";
      priorityInput.value = "medium";
      statusInput.value = "active";
    }

    modal.hidden = false;

    // Clean up old submit listeners to prevent double-submitting
    var submitBtn = modal.querySelector("[data-task-modal-submit]");
    var newSubmitBtn = submitBtn.cloneNode(true);
    submitBtn.replaceWith(newSubmitBtn);

    // Save Task
    newSubmitBtn.addEventListener("click", function() {
      var title = titleInput.value.trim();
      if (!title) return alert("Title is required.");

      var payload = {
        title: title,
        description: descInput.value.trim(),
        dueDate: dateInput.value || null,
      };
      if (modal.dataset.itemType !== "event") {
        payload.priority = priorityInput.value;
        payload.status = statusInput.value;
        payload.completed = statusInput.value === "completed";
      }

      newSubmitBtn.disabled = true;

      var req;
      if (idInput.value) {
        req = ButlerApi.put("/tasks/" + idInput.value, payload);
      } else {
        req = ButlerApi.post("/tasks", payload);
      }

      req.then(function() {
        // Let the server-side EJS perfectly re-render the page
        window.location.reload();
      }).catch(function(err) {
        newSubmitBtn.disabled = false;
        alert("Error: " + err.message);
      });
    });

    modal.querySelector("[data-task-modal-close]").onclick = function() { modal.hidden = true; };
    modal.querySelector("[data-task-modal-cancel]").onclick = function() { modal.hidden = true; };
  }

  // 3. Handle Clicks on the Task Page
  root.addEventListener("click", function(ev) {
    
    // Toggle Completion Checkbox
    if (ev.target.hasAttribute("data-task-toggle")) {
      var card = ev.target.closest(".task-card");
      var id = card.getAttribute("data-task-id");
      ev.target.disabled = true;
      ButlerApi.patch("/tasks/" + id + "/toggle").then(function() {
         window.location.reload();
      }).catch(function(err) {
         ev.target.disabled = false;
         alert(err.message);
      });
    }

    // Delete Button
    var deleteBtn = ev.target.closest("[data-task-delete]");
    if (deleteBtn) {
      var delCard = deleteBtn.closest(".task-card");
      var delId = delCard.getAttribute("data-task-id");
      var deleteLabel = delCard.getAttribute("data-item-type") === "event"
        ? "Delete this calendar event?"
        : "Delete this task?";
      if (confirm(deleteLabel)) {
        deleteBtn.disabled = true;
        ButlerApi.del("/tasks/" + delId).then(function() {
           window.location.reload();
        }).catch(function(err) {
           deleteBtn.disabled = false;
           alert(err.message);
        });
      }
    }

    // Edit Button
    var editBtn = ev.target.closest("[data-task-edit]");
    if (editBtn) {
      var editCard = editBtn.closest(".task-card");
      openModal({
        id: editCard.getAttribute("data-task-id"),
        title: editCard.getAttribute("data-title"),
        description: editCard.getAttribute("data-description"),
        dueDate: editCard.getAttribute("data-task-due-date"),
        priority: editCard.getAttribute("data-priority"),
        completed: editCard.getAttribute("data-task-completed"),
        status: editCard.getAttribute("data-task-status"),
        itemType: editCard.getAttribute("data-item-type")
      });
    }

    // New Task Button (from header)
    if (ev.target.closest("[data-action='new-task']")) {
      openModal();
    }

    // Refresh Button
    if (ev.target.closest("[data-refresh-tasks]")) {
      window.location.reload();
    }
  });

  // Global listener for the "New Task" Sidebar button
  document.addEventListener("click", function (ev) {
    var newEventBtn = ev.target.closest('[data-action="new-task"]');
    if (newEventBtn && !root.contains(newEventBtn)) {
      openModal();
    }
  });

})();
