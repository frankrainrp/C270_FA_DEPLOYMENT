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

router.get("/search", (req, res) => {
  const query = String(req.query.q || "").trim();
  const normalizedQuery = query.toLowerCase();

  const demoNotes = [
    {
      id: "n1",
      title: "DevOps CA2 spec",
      preview: "Butler must combine tasks, calendar, notes, and AI chat into one workspace.",
      body: "# DevOps CA2 spec\n\n- Bring tasks, calendar, notes, and AI chat together.\n- Keep the experience calm and visually clear.\n- Record the final reflection for the hand-in.",
      updated: "5 min ago",
    },
    {
      id: "n2",
      title: "React → EJS mapping",
      preview: "ChatCanvas.tsx maps to pages/chat.ejs plus the shared shell.js behaviour.",
      body: "# React → EJS mapping\n\n- Use the current layout shell for the main app chrome.\n- Reuse the chat stream logic and the existing state container.\n- Keep the styling system consistent across the workspace.",
      updated: "1 hour ago",
    },
    {
      id: "n3",
      title: "Ideas for the data panel",
      preview: "Small charts, generated by AI, saved as custom panels for the weekly review.",
      body: "# Ideas for the data panel\n\n- Generate a tiny insight card for task completion.\n- Highlight the daily focus trend.\n- Save the best view as a custom panel.",
      updated: "Yesterday",
    },
  ];

  const demoTasks = [
    {
      id: "t1",
      title: "Finish DevOps CA2 report",
      due: "Today",
      priority: "high",
      done: false,
      description: "Polish the study dashboard, finalise the report, and prepare the hand-in summary.",
    },
    {
      id: "t2",
      title: "Review React → EJS mapping",
      due: "Tomorrow",
      priority: "medium",
      done: false,
      description: "Revisit the component architecture and map each UI concept to the current server-rendered shell.",
    },
    {
      id: "t3",
      title: "Push initial commit",
      due: "This week",
      priority: "low",
      done: false,
      description: "Package the current milestone and share the progress update with the team.",
    },
    {
      id: "t4",
      title: "Read Butler style.css",
      due: "Done",
      priority: "low",
      done: true,
      description: "Review the shared styling system for later UI improvements.",
    },
  ];

  const demoChats = [
    { id: "s-001", title: "Study plan for finals" },
    { id: "s-002", title: "Refactor Butler layout" },
    { id: "s-003", title: "Ideas for data panel" },
  ];

  const searchMatch = (text) => text.toLowerCase().includes(normalizedQuery);

  const notes = normalizedQuery
    ? demoNotes.filter((note) => searchMatch(note.title) || searchMatch(note.preview) || searchMatch(note.body))
    : [];

  const tasks = normalizedQuery
    ? demoTasks.filter((task) => searchMatch(task.title) || searchMatch(task.description))
    : [];

  const chats = normalizedQuery
    ? demoChats.filter((chat) => searchMatch(chat.title))
    : [];

  renderLayout(res, {
    title: query ? `Search results for "${query}"` : "Search — Butler",
    activeNav: "search",
    page: "search",
    searchQuery: query,
    pageLocals: {
      query,
      results: { notes, tasks, chats },
    },
  });
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
// Calendar: load real events + tasks with dueDate, overlay
// both onto the month grid.
// -----------------------------------------------------------
router.get("/calendar", async (_req, res, next) => {
  try {
    const [events, tasks] = await Promise.all([
      CalendarService.findAll(),
      TaskService.findAll("all"),
    ]);

    const taskEvents = tasks
      .filter((t) => t.dueDate)
      .map((t) => {
        const plain = t.toObject();
        return {
          _id: plain._id,
          title: plain.title,
          date: plain.dueDate,
          description: plain.description || "",
          color: plain.completed ? "gray" : "green",
          isTask: true,
          completed: plain.completed,
          priority: plain.priority,
        };
      });

    const combined = [
      ...events.map((e) => e.toObject()),
      ...taskEvents,
    ];

    renderLayout(res, {
      title: "Calendar",
      activeNav: "calendar",
      page: "calendar",
      rail: getMockRail("calendar"),
      pageLocals: { events: combined },
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
