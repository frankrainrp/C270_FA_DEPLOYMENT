// ============================================================
// public/js/notes-ui.js
// DOM controller for the /notes page.  Handles:
//   - Click a note in the list  -> GET /api/notes/:id and load into editor
//   - Save button               -> POST or PUT /api/notes[/id]
//   - Delete button             -> DELETE /api/notes/:id
//   - New button                -> clear editor (no server round trip yet)
//   - butler:data-changed       -> reload the page
// ============================================================

(function initNotesUi() {
  if (!window.ButlerApi) return;

  var root = document.querySelector("[data-notes-root]");
  if (!root) return;

  var editor     = root.querySelector("[data-note-editor]");
  var titleInput = root.querySelector("[data-note-title]");
  var bodyInput  = root.querySelector("[data-note-body]");
  var list       = root.querySelector("[data-notes-list]");
  var saveBtn    = root.querySelector("[data-note-save]");
  var deleteBtn  = root.querySelector("[data-note-delete]");
  var newBtn     = root.querySelector("[data-new-note]");
  var updatedLabel = document.getElementById("note-updated-label");

  if (!editor || !titleInput || !bodyInput) return;

  function currentId() {
    return editor.dataset.noteId || "";
  }

  function reload() {
    window.location.reload();
  }

  function setUpdated(text) {
    if (updatedLabel) updatedLabel.textContent = "Updated " + (text || "just now");
  }

  async function loadNoteInto(id) {
    if (!id) return;
    try {
      var data = await ButlerApi.get("/notes/" + id);
      var n = data.note;
      editor.dataset.noteId = String(n._id);
      titleInput.value = n.title || "";
      bodyInput.value = n.content || "";
      setUpdated("just now");
      Array.prototype.forEach.call(
        list.querySelectorAll(".note-list-item"),
        function (el) {
          el.classList.toggle("active", el.dataset.noteId === String(n._id));
        }
      );
    } catch (err) {
      alert("Load note failed: " + (err && err.message ? err.message : "unknown"));
    }
  }

  if (list) {
    list.addEventListener("click", function (ev) {
      var item = ev.target.closest && ev.target.closest("[data-note-id]");
      if (!item) return;
      ev.preventDefault();
      loadNoteInto(item.dataset.noteId);
    });
  }

  if (saveBtn) {
    saveBtn.addEventListener("click", async function () {
      var id = currentId();
      var payload = {
        title: titleInput.value.trim(),
        content: bodyInput.value,
      };
      if (!payload.title) {
        alert("Title is required.");
        titleInput.focus();
        return;
      }
      try {
        if (!id) {
          await ButlerApi.post("/notes", payload);
        } else {
          await ButlerApi.put("/notes/" + id, payload);
        }
        reload();
      } catch (err) {
        alert("Save failed: " + (err && err.message ? err.message : "unknown"));
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async function () {
      var id = currentId();
      if (!id) {
        alert("Nothing selected.");
        return;
      }
      if (!confirm("Delete this note?")) return;
      try {
        await ButlerApi.del("/notes/" + id);
        reload();
      } catch (err) {
        alert("Delete failed: " + (err && err.message ? err.message : "unknown"));
      }
    });
  }

  if (newBtn) {
    newBtn.addEventListener("click", function () {
      editor.dataset.noteId = "";
      titleInput.value = "";
      bodyInput.value = "";
      titleInput.focus();
    });
  }

  window.addEventListener("butler:data-changed", function (ev) {
    var tool = ev && ev.detail && ev.detail.tool;
    if (!tool || tool.indexOf("note_") === 0) reload();
  });

  try {
    var bc = new BroadcastChannel("butler-data");
    bc.onmessage = function (ev) {
      var tool = ev.data && ev.data.tool;
      if (!tool || tool.indexOf("note_") === 0) reload();
    };
  } catch (_) {}
})();
