const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ejs = require("ejs");

const root = path.join(__dirname, "..");
const sidebarView = path.join(root, "src/views/partials/sidebar.ejs");

async function renderNotesSidebar(noteView) {
  return ejs.renderFile(sidebarView, {
    activeNav: "notes",
    activeCustomPanelId: null,
    rail: {
      noteView,
      noteCounts: { all: 3, pinned: 1 },
      pinnedNotes: [{ id: "note-1", title: "Pinned note" }],
    },
  });
}

function linkForView(html, view) {
  return (
    html.match(
      new RegExp(`<a\\b(?=[^>]*data-note-view="${view}")[^>]*>`, "i")
    ) || []
  )[0] || "";
}

test("All Notes is active only for the all-notes view", async () => {
  const html = await renderNotesSidebar("all");
  const allLink = linkForView(html, "all");
  const pinnedLink = linkForView(html, "pinned");

  assert.match(allLink, /\bactive\b/);
  assert.match(allLink, /aria-current="page"/);
  assert.doesNotMatch(pinnedLink, /\bactive\b/);
  assert.doesNotMatch(pinnedLink, /aria-current="page"/);
});

test("Pinned is active after navigating to the pinned filter", async () => {
  const html = await renderNotesSidebar("pinned");
  const allLink = linkForView(html, "all");
  const pinnedLink = linkForView(html, "pinned");

  assert.doesNotMatch(allLink, /\bactive\b/);
  assert.doesNotMatch(allLink, /aria-current="page"/);
  assert.match(pinnedLink, /\bactive\b/);
  assert.match(pinnedLink, /aria-current="page"/);
  assert.match(pinnedLink, /href="\/notes\?pinned=1"/);
});

test("notes route passes the selected filter state into the sidebar rail", () => {
  const pages = fs.readFileSync(path.join(root, "src/routes/pages.js"), "utf8");
  const railService = fs.readFileSync(path.join(root, "src/services/RailService.js"), "utf8");

  assert.match(pages, /const noteView = onlyPinned \? "pinned" : "all"/);
  assert.match(pages, /buildNotesRail\(ownerEmail, allNotes, noteView\)/);
  assert.match(pages, /onlyPinned: req\.query\.pinned === "1"/);
  assert.match(railService, /noteView: noteView === "pinned" \? "pinned" : "all"/);
});

test("pin and unpin refresh the rendered note list and sidebar after persistence", () => {
  const notesUi = fs.readFileSync(path.join(root, "src/public/js/notes-ui.js"), "utf8");

  assert.match(
    notesUi,
    /await ButlerApi\.patch\("\/notes\/" \+ id \+ "\/toggle"\);\s*reload\(\)/
  );
});

test("notes rail computes pinned counts, links, and selected view from persisted notes", async () => {
  const { buildNotesRail } = require("../src/services/RailService");
  const notes = [
    { _id: "note-1", title: "Pinned one", pinned: true },
    { _id: "note-2", title: "Regular note", pinned: false },
    { _id: "note-3", title: "Pinned two", pinned: true },
  ];

  const rail = await buildNotesRail("student@example.com", notes, "pinned");

  assert.equal(rail.noteView, "pinned");
  assert.deepEqual(rail.noteCounts, { all: 3, pinned: 2, linked: 0 });
  assert.deepEqual(rail.pinnedNotes, [
    { id: "note-1", title: "Pinned one" },
    { id: "note-3", title: "Pinned two" },
  ]);
});

test("notes rail safely falls back to the all-notes view", async () => {
  const { buildNotesRail } = require("../src/services/RailService");
  const rail = await buildNotesRail("student@example.com", [], "unexpected");

  assert.equal(rail.noteView, "all");
});
