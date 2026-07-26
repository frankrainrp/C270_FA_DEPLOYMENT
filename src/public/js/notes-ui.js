// ============================================================
// public/js/notes-ui.js
// Controls the /notes page. Talks to the JSON API via ButlerApi:
//   - Click a note  -> GET    /api/notes/:id        (load into editor)
//   - Save          -> POST   /api/notes  OR  PUT /api/notes/:id
//   - Delete        -> DELETE /api/notes/:id
//   - Pin / Unpin   -> PATCH  /api/notes/:id/toggle
// After any change we reload the page so the note list and the sidebar
// (counts + Pinned list) stay in sync with the database.
// ============================================================

(function initNotesUi() {
  if (!window.ButlerApi) return;

  var root = document.querySelector("[data-notes-root]");
  if (!root) return;

  var editor = root.querySelector("[data-note-editor]");
  // Editor fields are found by unique id. (The note-list buttons also carry
  // [data-note-title]/[data-note-body], so a data-attribute lookup could grab
  // a list button by mistake and make Save always say "Title is required".)
  var titleInput   = document.getElementById("note-title-input");
  var bodyInput    = document.getElementById("note-body-input");
  var updatedLabel = document.getElementById("note-updated-label");
  var pinBtn       = document.getElementById("note-pin-btn");
  var list         = root.querySelector("[data-notes-list]");
  var saveBtn      = root.querySelector("[data-note-save]");
  var deleteBtn    = root.querySelector("[data-note-delete]");
  // Note-list buttons also expose a data-note-preview snippet for global
  // search, so scope this lookup to the actual editor preview surface.
  var preview      = root.querySelector(".note-markdown-preview[data-note-preview]");
  var modeButtons  = root.querySelectorAll("[data-note-mode]");

  if (!editor || !titleInput || !bodyInput) return;

  // ---- small helpers -------------------------------------------------
  function currentId() { return editor.dataset.noteId || ""; }
  function reload()    { window.location.reload(); }

  function setUpdated(text) {
    if (updatedLabel) updatedLabel.textContent = "Updated " + (text || "just now");
  }

  // Pin button label reflects the note being viewed (● pinned / ○ not).
  function setPinLabel(isPinned) {
    if (pinBtn) pinBtn.textContent = isPinned ? "● Unpin" : "○ Pin";
  }

  function showError(action, err) {
    alert(action + " failed: " + (err && err.message ? err.message : "unknown"));
  }

  function renderPreview() {
    if (!preview) return;
    var markdown = bodyInput.value || "";
    if (!markdown.trim()) {
      preview.innerHTML = '<div class="note-preview-empty"><strong>Nothing to preview yet.</strong><span>Switch to Edit and start writing in Markdown.</span></div>';
      return;
    }
    preview.innerHTML = window.ButlerMarkdown
      ? window.ButlerMarkdown.render(markdown)
      : "<pre>" + markdown.replace(/[&<>]/g, function (char) {
          return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[char];
        }) + "</pre>";
  }

  function setMode(mode) {
    var nextMode = mode === "edit" ? "edit" : "preview";
    var editing = nextMode === "edit";
    bodyInput.hidden = !editing;
    if (preview) preview.hidden = editing;
    modeButtons.forEach(function (button) {
      var active = button.getAttribute("data-note-mode") === nextMode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
    if (editing) {
      bodyInput.focus();
    } else {
      renderPreview();
    }
  }

  // ---- load a note into the editor -----------------------------------
  async function loadNoteInto(id) {
    if (!id) return;
    try {
      var note = (await ButlerApi.get("/notes/" + id)).note;
      editor.dataset.noteId = String(note._id);
      titleInput.value = note.title || "";
      bodyInput.value = note.content || "";
      setUpdated("just now");
      setPinLabel(!!note.pinned);
      setMode("preview");
      // Highlight the selected note in the list.
      list.querySelectorAll(".note-list-item").forEach(function (el) {
        el.classList.toggle("active", el.dataset.noteId === String(note._id));
      });
    } catch (err) {
      showError("Load note", err);
    }
  }

  // ---- button wiring -------------------------------------------------
  modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setMode(button.getAttribute("data-note-mode"));
    });
  });

  bodyInput.addEventListener("input", renderPreview);
  setMode(currentId() && bodyInput.value.trim() ? "preview" : "edit");

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
      var payload = { title: titleInput.value.trim(), content: bodyInput.value };
      if (!payload.title) {
        alert("Title is required.");
        titleInput.focus();
        return;
      }
      try {
        // No id yet -> create the note; otherwise update the existing one.
        await (id ? ButlerApi.put("/notes/" + id, payload)
                  : ButlerApi.post("/notes", payload));
        reload();
      } catch (err) {
        showError("Save", err);
      }
    });
  }

  if (deleteBtn) {
    deleteBtn.addEventListener("click", async function () {
      var id = currentId();
      if (!id) { alert("Nothing selected."); return; }
      if (!confirm("Delete this note?")) return;
      try {
        await ButlerApi.del("/notes/" + id);
        reload();
      } catch (err) {
        showError("Delete", err);
      }
    });
  }

  if (pinBtn) {
    pinBtn.addEventListener("click", async function () {
      var id = currentId();
      if (!id) { alert("Save the note before pinning it."); return; }
      try {
        await ButlerApi.patch("/notes/" + id + "/toggle");
        reload();
      } catch (err) {
        showError("Pin", err);
      }
    });
  }

  // ---- auto-refresh when the AI assistant changes a note -------------
  // Butler's chat tools fire these signals after a note_* action so the
  // page updates without the user refreshing manually.
  function reloadIfNoteChanged(tool) {
    if (!tool || tool.indexOf("note_") === 0) reload();
  }

  window.addEventListener("butler:data-changed", function (ev) {
    reloadIfNoteChanged(ev && ev.detail && ev.detail.tool);
  });

  try {
    var bc = new BroadcastChannel("butler-data");
    bc.onmessage = function (ev) { reloadIfNoteChanged(ev.data && ev.data.tool); };
  } catch (_) {}
})();
