// ============================================================
// src/routes/pages.js
// HTML page routes.  Every route renders an EJS template and
// returns text/html.  Data is pulled from the Mongoose services
// server-side (SSR) so the page arrives with real data already
// in the DOM.  Client-side JS on each page handles subsequent
// CRUD (toggle, delete, save) and reloads on agent writes.
// ============================================================

const express = require("express");

const { renderLayout } = require("../lib/renderLayout");
const { getMockRail } = require("../data/mockRail");
const TaskService = require("../services/TaskService");
const NoteService = require("../services/NoteService");
const CalendarService = require("../services/CalendarService");
const ChatSessionService = require("../services/ChatSessionService");

const router = express.Router();

// -----------------------------------------------------------
// Root: redirect to the default tab.
// -----------------------------------------------------------
router.get("/", (_req, res) => {
  res.redirect("/chat");
});

// -----------------------------------------------------------
// Chat: load the latest ChatSession's messages from MongoDB and
// hydrate ButlerState in the browser so history survives reloads.
// The sidebar rail also lists real recent sessions from the DB
// (derived title = first user message, truncated).
// -----------------------------------------------------------
function summariseTitle(session) {
  const msgs = Array.isArray(session.messages) ? session.messages : [];
  const firstUser = msgs.find((m) => m.role === "user" && typeof m.content === "string");
  if (firstUser) {
    const t = firstUser.content.trim();
    return t.length > 40 ? t.slice(0, 40) + "…" : t || "Untitled chat";
  }
  return "New chat";
}

async function loadSessionsList() {
  try {
    const all = await ChatSessionService.findAll();
    return all.slice(0, 12).map((s) => ({
      id: String(s._id),
      title: summariseTitle(s),
      updatedAt: s.updatedAt ? new Date(s.updatedAt).getTime() : Date.now(),
    }));
  } catch (err) {
    console.warn("[pages] chat sessions unavailable:", err.message);
    return [];
  }
}

function renderChatPage(res, session, sessions) {
  const activeSessionId = session ? String(session._id) : null;
  const initialMessages = session && Array.isArray(session.messages)
    ? session.messages.map((m) => ({ role: m.role, content: m.content }))
    : [];

  renderLayout(res, {
    title: "Chat",
    activeNav: "chat",
    page: "chat",
    rail: { sessions, activeSessionId },
    pageLocals: { initialMessages, activeSessionId },
  });
}

// GET /chat  -> redirect to the latest (or newly-created) session's URL.
// Every chat lives at its own /chat/:id so refreshes and sidebar clicks
// map to a specific isolated conversation.
router.get("/chat", async (_req, res, _next) => {
  try {
    let session = await ChatSessionService.getLatestSession();
    if (!session) session = await ChatSessionService.create();
    res.redirect("/chat/" + String(session._id));
  } catch (err) {
    console.warn("[pages] chat redirect failed:", err.message);
    // MongoDB unavailable — render an empty chat page so the UI still works.
    renderChatPage(res, null, []);
  }
});

// GET /chat/:id  -> load a specific session and render its history.
// The literal "/chat/new" URL is treated as "create a new session and
// redirect to it".  This keeps the existing sidebar <a href="/chat/new">
// button working without any client-side change.
router.get("/chat/:id", async (req, res, next) => {
  try {
    if (req.params.id === "new") {
      const created = await ChatSessionService.create();
      return res.redirect("/chat/" + String(created._id));
    }

    let session = null;
    try {
      session = await ChatSessionService.findById(req.params.id);
    } catch (_) { /* invalid ObjectId, treat as not found */ }

    if (!session) return res.redirect("/chat");

    const sessions = await loadSessionsList();
    renderChatPage(res, session, sessions);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Tasks: load real tasks + stats from MongoDB.
// -----------------------------------------------------------
router.get("/tasks", async (_req, res, next) => {
  try {
    const [tasks, stats] = await Promise.all([
      TaskService.findAll("all"),
      TaskService.getStats(),
    ]);

    renderLayout(res, {
      title: "Tasks",
      activeNav: "tasks",
      page: "task",
      rail: {
        taskCounts: {
          active: stats.active,
          completed: stats.completed,
          upcoming: stats.upcoming,
          all: stats.total,
          in_progress: 0,
        },
        taskView: "all",
      },
      pageLocals: { tasks: tasks.map((t) => t.toObject()) },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Notes: load real notes from MongoDB, populate sidebar too.
// -----------------------------------------------------------
router.get("/notes", async (_req, res, next) => {
  try {
    const notes = await NoteService.findAll("all");
    const plain = notes.map((n) => n.toObject());
    const pinned = plain.filter((n) => n.pinned);

    renderLayout(res, {
      title: "Notes",
      activeNav: "notes",
      page: "note",
      rail: {
        noteCounts: {
          all: plain.length,
          pinned: pinned.length,
          linked: 0,
        },
        pinnedNotes: pinned.slice(0, 5).map((n) => ({
          id: String(n._id),
          title: n.title,
        })),
      },
      pageLocals: { notes: plain },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Calendar: load real events, overlay onto the month grid.
// -----------------------------------------------------------
router.get("/calendar", async (_req, res, next) => {
  try {
    const events = await CalendarService.findAll();
    renderLayout(res, {
      title: "Calendar",
      activeNav: "calendar",
      page: "calendar",
      rail: getMockRail("calendar"),
      pageLocals: { events: events.map((e) => e.toObject()) },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Legacy path aliases.
// -----------------------------------------------------------
router.get("/ai/chat", (_req, res) => res.redirect("/chat"));
router.get("/study/dashboard", (_req, res) => res.redirect("/tasks"));

// -----------------------------------------------------------
// Standalone auth / preferences pages (no layout shell).
// -----------------------------------------------------------
router.get("/auth/login", (_req, res) => {
  res.render("auth/login", {
    title: "Sign in — Butler",
    lang: "en",
    theme: "retro",
  });
});

router.get("/preferences", (_req, res) => {
  res.render("preferences", {
    title: "Preferences — Butler",
    lang: "en",
  });
});

module.exports = router;
