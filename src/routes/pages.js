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
const TaskService = require("../services/TaskService");
const NoteService = require("../services/NoteService");
const CalendarService = require("../services/CalendarService");
const ChatSessionService = require("../services/ChatSessionService");
const BillingService = require("../services/BillingService");
const AchievementService = require("../services/AchievementService");
const AuthService = require("../services/AuthService");
const { readSessionCookie, clearSessionCookie } = require("../lib/cookies");
const {
  buildTasksRail,
  buildNotesRail,
  buildCalendarRail,
  buildChatRail,
} = require("../services/RailService");

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
// The sidebar rail also lists recent persisted sessions.
// -----------------------------------------------------------
function renderChatPage(res, session, rail) {
  const activeSessionId = session ? String(session._id) : null;
  const initialMessages = session && Array.isArray(session.messages)
    ? session.messages.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
    }))
    : [];

  renderLayout(res, {
    title: "Chat",
    activeNav: "chat",
    page: "chat",
    rail: rail || { sessions: [], activeSessionId },
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
    // Render an empty chat page when MongoDB is unavailable.
    renderChatPage(res, null, { sessions: [], activeSessionId: null });
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

    const rail = await buildChatRail(null, String(session._id));
    renderChatPage(res, session, rail);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Global Search
// Searches across all Notes, Tasks and Chat Sessions stored
// in MongoDB instead of using demo data.
// -----------------------------------------------------------
router.get("/search", async (req, res, next) => {
  try {
    const query = String(req.query.q || "").trim().slice(0, 200);
    const normalizedQuery = query.toLowerCase();

    // Render an empty result set until the user enters a query.
    if (!normalizedQuery) {
      return renderLayout(res, {
        title: "Search — Butler",
        activeNav: "search",
        page: "search",
        pageLocals: {
          query: "",
          results: {
            notes: [],
            tasks: [],
            chats: [],
          },
        },
      });
    }

    // Load each searchable collection in parallel.
    const [allNotes, allTasks, allChats] = await Promise.all([
      NoteService.findAll("all"),
      TaskService.findAll("all"),
      ChatSessionService.findAll(),
    ]);

    const contains = (text) =>
      String(text || "").toLowerCase().includes(normalizedQuery);

    // Search notes by title, content, or preview.
    const notes = allNotes
      .filter(
        (note) =>
          contains(note.title) ||
          contains(note.content) ||
          contains(note.preview)
      )
      .map((note) => ({
        id: String(note._id),
        title: note.title,
        preview: note.preview,
        updated: note.updatedAt
          ? new Date(note.updatedAt).toLocaleString()
          : "Recently",
      }));

    // Search tasks by title or description.
    const tasks = allTasks
      .filter(
        (task) =>
          contains(task.title) ||
          contains(task.description)
      )
      .map((task) => ({
        id: String(task._id),
        title: task.title,
        description: task.description,
        due: task.dueDate
          ? new Date(task.dueDate).toLocaleDateString()
          : "No Due Date",
        priority: task.priority || "Normal",
      }));

    // Search the text of every persisted chat message.
    const chats = allChats
      .filter((chat) =>
        Array.isArray(chat.messages) &&
        chat.messages.some((message) =>
          contains(message.content)
        )
      )
      .map((chat) => {
        const firstUserMessage =
          chat.messages.find(
            (m) => m.role === "user"
          ) || {};

        return {
          id: String(chat._id),
          title:
            firstUserMessage.content
              ? firstUserMessage.content.substring(0, 60)
              : "Untitled Chat",
        };
      });

    renderLayout(res, {
      title: `Search results for "${query}"`,
      activeNav: "search",
      page: "search",
      pageLocals: {
        query,
        results: {
          notes,
          tasks,
          chats,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Tasks: load real tasks + stats from MongoDB.
// -----------------------------------------------------------
router.get("/tasks", async (_req, res, next) => {
  try {
    const [tasks, rail] = await Promise.all([
      TaskService.findAll("all"),
      buildTasksRail("all"),
    ]);

    renderLayout(res, {
      title: "Tasks",
      activeNav: "tasks",
      page: "task",
      rail,
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
    const rail = await buildNotesRail(notes);

    renderLayout(res, {
      title: "Notes",
      activeNav: "notes",
      page: "note",
      rail,
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
    const rail = await buildCalendarRail(events);

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
      rail,
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
router.get("/auth/login", (req, res) => {
  // Already signed in: skip the login page entirely.
  if (res.locals.isLoggedIn) {
    return res.redirect("/chat");
  }

  const nextUrl = typeof req.query.next === "string" ? req.query.next : "/chat";

  res.render("auth/login", {
    title: "Sign in — Butler",
    lang: "en",
    theme: "retro",
    nextUrl,
  });
});

// -----------------------------------------------------------
// Logout: destroy the server-side Session doc and clear the cookie.
// A POST (not GET) so it can't be triggered by a stray link/prefetch.
// -----------------------------------------------------------
router.post("/logout", async (req, res, next) => {
  try {
    const token = readSessionCookie(req);
    await AuthService.destroySession(token);
    clearSessionCookie(res);
    res.redirect("/auth/login");
  } catch (err) {
    next(err);
  }
});

router.get("/preferences", (_req, res) => {
  res.render("preferences", {
    title: "Preferences — Butler",
    lang: "en",
  });
});

// -----------------------------------------------------------
// Billing / Pricing (simulated).
// No payment gateway is wired up yet — see BillingService.js for
// what is mocked and what a future real-gateway phase should replace.
// -----------------------------------------------------------
router.get("/billing", (req, res) => {
  res.render("billing", {
    title: "Billing — Butler",
    lang: "en",
    account: BillingService.getAccountSnapshot(),
    upgraded: req.query.upgraded === "1",
  });
});

router.get("/pricing", (_req, res) => {
  const account = BillingService.getAccountSnapshot();
  res.render("pricing", {
    title: "Upgrade — Butler",
    lang: "en",
    plans: BillingService.getPlans(),
    currentPlanId: account.plan.id,
  });
});

router.post("/pricing/upgrade", (req, res) => {
  const planId = String(req.body.planId || "").trim();
  const validIds = BillingService.getPlans().map((p) => p.id);

  if (!validIds.includes(planId)) {
    return res.redirect("/pricing");
  }

  BillingService.simulateUpgrade(planId);
  res.redirect("/billing?upgraded=1");
});

// -----------------------------------------------------------
// Achievements: badges computed live from real Task/Note/Calendar/
// ChatSession counts. No separate achievements collection.
// -----------------------------------------------------------
router.get("/achievements", async (_req, res, next) => {
  try {
    const summary = await AchievementService.getBadges();
    res.render("achievements", {
      title: "Achievements — Butler",
      lang: "en",
      summary,
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
