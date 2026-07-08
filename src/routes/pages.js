// ============================================================
// src/routes/pages.js
// HTML page routes.  Every route here renders an EJS template and
// returns text/html.  API routes live under routes/api/*.
//
// All page routes are optional-auth for now: they render even when
// no user is signed in.  Later phases can swap attachUser for a
// stricter requireAuth guard.
// ============================================================

const express = require("express");

const { renderLayout } = require("../lib/renderLayout");
const { getMockRail } = require("../data/mockRail");
const notesStore = require("../data/notesStore"); //for future use, not used in this snippet but may be used in the future for notes data ei
const router = express.Router();

// -----------------------------------------------------------
// Root: redirect to the default tab.
// -----------------------------------------------------------
router.get("/", (_req, res) => {
  res.redirect("/chat");
});

// -----------------------------------------------------------
// Main navigation pages.
// Each one supplies its own activeNav + page + sidebar rail.
// -----------------------------------------------------------
router.get("/chat", (_req, res) => {
  renderLayout(res, {
    title: "Chat",
    activeNav: "chat",
    page: "chat",
    rail: getMockRail("chat"),
  });
});

router.get("/tasks", (_req, res) => {
  renderLayout(res, {
    title: "Tasks",
    activeNav: "tasks",
    page: "task",
    rail: getMockRail("tasks"),
  });
});

router.get("/calendar", (_req, res) => {
  renderLayout(res, {
    title: "Calendar",
    activeNav: "calendar",
    page: "calendar",
    rail: getMockRail("calendar"),
  });
});

// New Note (server fallback for no-JS): create, then open it.
router.get("/notes/new", (_req, res) => {
  const note = notesStore.createNote({ title: "Untitled note", body: "" });
  res.redirect("/notes?note=" + encodeURIComponent(note.id));
});

router.get("/notes", (req, res) => {
  const notes = notesStore.listNotes();
  const activeNote =
    (req.query.note && notesStore.getNote(req.query.note)) || notes[0] || null;

  const rail = getMockRail("notes");
  rail.noteCounts = Object.assign({}, rail.noteCounts, { all: notes.length });
  rail.pinnedNotes = notes.slice(0, 2).map((n) => ({ id: n.id, title: n.title }));

  renderLayout(res, {
    title: "Notes",
    activeNav: "notes",
    page: "note",
    rail,
    pageLocals: { notes, activeNote },
  });
});

// Open a specific note (used by the pinned-notes sidebar links).
router.get("/notes/:id", (req, res) => {
  if (!notesStore.getNote(req.params.id)) return res.redirect("/notes");
  res.redirect("/notes?note=" + encodeURIComponent(req.params.id));
});

// -----------------------------------------------------------
// Legacy path aliases.  Kept so older bookmarks still work.
// -----------------------------------------------------------
router.get("/ai/chat", (_req, res) => res.redirect("/chat"));
router.get("/study/dashboard", (_req, res) => res.redirect("/tasks"));

// -----------------------------------------------------------
// Standalone auth pages (no layout shell).
// -----------------------------------------------------------
router.get("/auth/login", (_req, res) => {
  res.render("auth/login", {
    title: "Sign in — Butler",
    lang: "en",
    // Match the app's default paper/parchment aesthetic.
    theme: "retro",
  });
});

// -----------------------------------------------------------
// Preferences page.  Standalone (no layout shell) so it works
// even when other app state is not ready yet.  For now it only
// offers theme switching; persistence is client-side only.
// -----------------------------------------------------------
router.get("/preferences", (_req, res) => {
  res.render("preferences", {
    title: "Preferences — Butler",
    lang: "en",
  });
});

module.exports = router;
