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

router.get("/notes", (_req, res) => {
  renderLayout(res, {
    title: "Notes",
    activeNav: "notes",
    page: "note",
    rail: getMockRail("notes"),
  });
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
