// ============================================================
// public/js/notes.js
// Notes page behaviour: select, search, save, create, delete.
// Talks to the /api/notes endpoints through window.ButlerApi.
// Loaded only on the Notes page (see views/pages/note.ejs).
// ============================================================

(function initNotes() {
  var root = document.querySelector("[data-notes-root]");
  if (!root || !window.ButlerApi) return;

  var listBox = root.querySelector("[data-notes-listbox]");
  var searchInput = document.getElementById("note-search");
  var titleInput = document.getElementById("note-title-input");
  var bodyInput = document.getElementById("note-body-input");
  var updatedLabel = document.getElementById("note-updated-label");
  var activeIdInput = document.getElementById("note-active-id");
  var saveBtn = document.getElementById("save-note-btn");
  var deleteBtn = document.getElementById("delete-note-btn");

  function currentId() {
    return activeIdInput ? activeIdInput.value : "";
  }

  function activeButton() {
    return listBox.querySelector('.note-list-item[data-note-id="' + currentId() + '"]');
  }

  // ---------- Select a note ----------
  function selectNote(button) {
    if (!button) return;
    listBox.querySelectorAll(".note-list-item").forEach(function (item) {
      item.classList.remove("active");
    });
    button.classList.add("active");
    if (activeIdInput) activeIdInput.value = button.getAttribute("data-note-id");
    if (titleInput) titleInput.value = button.getAttribute("data-note-title");
    if (bodyInput) bodyInput.value = button.getAttribute("data-note-body");
    if (updatedLabel) updatedLabel.textContent = "Updated " + button.getAttribute("data-note-updated");
  }

  listBox.addEventListener("click", function (event) {
    var button = event.target.closest(".note-list-item");
    if (button) selectNote(button);
  });

  // ---------- Search (instant, client-side) ----------
  if (searchInput) {
    searchInput.addEventListener("input", function () {
      var query = searchInput.value.trim().toLowerCase();
      listBox.querySelectorAll(".note-list-item").forEach(function (button) {
        var text = (button.getAttribute("data-note-title") + " " +
                    button.getAttribute("data-note-preview")).toLowerCase();
        button.style.display = text.indexOf(query) === -1 ? "none" : "grid";
      });
    });
  }

  // ---------- Save the current note ----------
  if (saveBtn) {
    saveBtn.addEventListener("click", function () {
      var id = currentId();
      if (!id) return;
      saveBtn.disabled = true;
      window.ButlerApi.put("/notes/" + id, { title: titleInput.value, body: bodyInput.value })
        .then(function (data) {
          var note = data.note;
          var button = activeButton();
          if (button) {
            button.setAttribute("data-note-title", note.title);
            button.setAttribute("data-note-body", note.body);
            button.setAttribute("data-note-preview", note.preview);
            button.setAttribute("data-note-updated", note.updated);
            button.querySelector("strong").textContent = note.title;
            button.querySelector("p").textContent = note.preview;
          }
          if (updatedLabel) updatedLabel.textContent = "Updated " + note.updated;
        })
        .catch(function (err) { window.alert("Could not save note: " + err.message); })
        .finally(function () { saveBtn.disabled = false; });
    });
  }

  // ---------- Delete the current note ----------
  if (deleteBtn) {
    deleteBtn.addEventListener("click", function () {
      var id = currentId();
      if (!id) return;
      if (!window.confirm("Delete this note? This cannot be undone.")) return;
      deleteBtn.disabled = true;
      window.ButlerApi.del("/notes/" + id)
        .then(function () { window.location.href = "/notes"; })
        .catch(function (err) {
          window.alert("Could not delete note: " + err.message);
          deleteBtn.disabled = false;
        });
    });
  }

  // ---------- Create a new note (sidebar "New Note" button) ----------
  var newNoteTrigger = document.querySelector('[data-action="new-note"]');
  if (newNoteTrigger) {
    newNoteTrigger.addEventListener("click", function (event) {
      event.preventDefault();
      window.ButlerApi.post("/notes", { title: "Untitled note", body: "" })
        .then(function (data) {
          window.location.href = "/notes?note=" + encodeURIComponent(data.note.id);
        })
        .catch(function (err) { window.alert("Could not create note: " + err.message); });
    });
  }
})();
