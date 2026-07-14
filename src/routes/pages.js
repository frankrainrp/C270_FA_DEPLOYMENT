// ============================================================
// src/routes/pages.js
// HTML page routes.  Every route renders an EJS template and
// returns text/html.  Data is pulled from the Mongoose services
// server-side (SSR) so the page arrives with real data already
// in the DOM.  Client-side JS on each page handles subsequent
// CRUD (toggle, delete, save) and reloads on agent writes.
//
// Tasks, Notes, Calendar, Chat, and Search all require a logged-in
// session (see requireAuthPage below) and are scoped to that
// account's own data via req.sessionUser.email.
// ============================================================

const express = require("express");

const { renderLayout } = require("../lib/renderLayout");
const TaskService = require("../services/TaskService");
const NoteService = require("../services/NoteService");
const CalendarService = require("../services/CalendarService");
const ChatSessionService = require("../services/ChatSessionService");
const UserProfileService = require("../services/UserProfileService");
const AchievementService = require("../services/AchievementService");
const AuthService = require("../services/AuthService");
const { requireAuthPage } = require("../middleware/requireAuth");
const { readSessionCookie, clearSessionCookie } = require("../lib/cookies");
const { serializeForInlineScript } = require("../lib/safeJson");
const {
  buildTasksRail,
  buildNotesRail,
  buildCalendarRail,
  buildChatRail,
} = require("../services/RailService");

const router = express.Router();

// -----------------------------------------------------------
// Shared auth/plan context for every page rendered through the
// full layout shell (topbar user menu + plan badge in layout.ejs).
// When a real login session exists, the topbar shows THAT
// person's actual name/email; otherwise it falls back to the
// shared Task 6 demo profile (avatar/plan/credits stay on the
// demo profile either way — those aren't per-account yet).
// Falls back to renderLayout's own defaults if MongoDB is
// unreachable so pages still render during local dev without a DB.
// -----------------------------------------------------------
async function loadAuthContext(req) {
  const sessionUser = req.sessionUser;
  if (!sessionUser) return { isLoggedIn: false };

  try {
    const profile = await UserProfileService.getOrCreate(sessionUser.email);
    return {
      authProfile: {
        name: (sessionUser && sessionUser.name) || profile.name,
        email: (sessionUser && sessionUser.email) || profile.email,
        imageUrl: profile.avatarUrl || "",
      },
      plan: profile.plan,
      planName: profile.plan === "max" ? "Max" : profile.plan === "pro" ? "Pro" : "Free",
      isLoggedIn: Boolean(sessionUser),
    };
  } catch (err) {
    console.warn("[pages] profile unavailable, using layout defaults:", err.message);
    if (sessionUser) {
      return {
        authProfile: { name: sessionUser.name, email: sessionUser.email, imageUrl: "" },
        isLoggedIn: true,
      };
    }
    return {};
  }
}

// -----------------------------------------------------------
// Root: redirect to the default tab.
// -----------------------------------------------------------
router.get("/", (_req, res) => {
  res.redirect("/chat");
});

// -----------------------------------------------------------
// Chat: load the CURRENT USER's latest ChatSession from MongoDB and
// hydrate ButlerState in the browser so history survives reloads.
// The sidebar rail also lists that user's real recent sessions from
// the DB (derived title = first user message, truncated).
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

async function loadSessionsList(ownerEmail) {
  try {
    const all = await ChatSessionService.findAll(ownerEmail);
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

async function renderChatPage(req, res, session, sessions) {
  const activeSessionId = session ? String(session._id) : null;
  const initialMessages = session && Array.isArray(session.messages)
    ? session.messages.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: Array.isArray(m.attachments) ? m.attachments : undefined,
    }))
    : [];
  const authContext = await loadAuthContext(req);
  const initialChatStateJson = serializeForInlineScript({
    messages: initialMessages,
    activeSessionId,
  });

  renderLayout(res, {
    title: "Chat",
    activeNav: "chat",
    page: "chat",
    rail: { sessions, activeSessionId },
    pageLocals: { initialMessages, activeSessionId, initialChatStateJson },
    ...authContext,
  });
}

// GET /chat  -> redirect to the latest (or newly-created) session's URL.
// Every chat lives at its own /chat/:id so refreshes and sidebar clicks
// map to a specific isolated conversation.
router.get("/chat", requireAuthPage, async (req, res, _next) => {
  const ownerEmail = req.sessionUser.email;
  try {
    let session = await ChatSessionService.getLatestSession(ownerEmail);
    if (!session) session = await ChatSessionService.create(ownerEmail);
    res.redirect("/chat/" + String(session._id));
  } catch (err) {
    console.warn("[pages] chat redirect failed:", err.message);
    // MongoDB unavailable — render an empty chat page so the UI still works.
    await renderChatPage(req, res, null, []);
  }
});

// GET /chat/:id  -> load a specific session (must belong to this user)
// and render its history. The literal "/chat/new" URL is treated as
// "create a new session and redirect to it". This keeps the existing
// sidebar <a href="/chat/new"> button working without any client-side
// change.
router.get("/chat/:id", requireAuthPage, async (req, res, next) => {
  const ownerEmail = req.sessionUser.email;
  try {
    if (req.params.id === "new") {
      const created = await ChatSessionService.create(ownerEmail);
      return res.redirect("/chat/" + String(created._id));
    }

    let session = null;
    try {
      session = await ChatSessionService.findById(req.params.id, ownerEmail);
    } catch (_) { /* invalid ObjectId, treat as not found */ }

    // Not found also covers "exists but belongs to someone else" —
    // both fall back to /chat rather than leaking which case it was.
    if (!session) return res.redirect("/chat");

    const sessions = await loadSessionsList(ownerEmail);
    await renderChatPage(req, res, session, sessions);
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Global Search
// Searches across the CURRENT USER's own Notes, Tasks and Chat
// Sessions stored in MongoDB — never another account's data.
// -----------------------------------------------------------
router.get("/search", requireAuthPage, async (req, res, next) => {
  const ownerEmail = req.sessionUser.email;
  try {
    const query = String(req.query.q || "").trim().slice(0, 200);
    const normalizedQuery = query.toLowerCase();

    // Empty search
    if (!normalizedQuery) {
      const authContext = await loadAuthContext(req);
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
        ...authContext,
      });
    }

    // Load data from MongoDB, scoped to this account
    const [allNotes, allTasks, allChats] = await Promise.all([
      NoteService.findAll("all", ownerEmail),
      TaskService.findAll("all", ownerEmail),
      ChatSessionService.findAll(ownerEmail),
    ]);

    // Helper
    const contains = (text) =>
      String(text || "").toLowerCase().includes(normalizedQuery);

    // ----------------------------
    // Search Notes
    // ----------------------------
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

    // ----------------------------
    // Search Tasks
    // ----------------------------
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

    // ----------------------------
    // Search Chats
    // ----------------------------
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

    const authContext = await loadAuthContext(req);
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
      ...authContext,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Tasks: load the CURRENT USER's real tasks + stats from MongoDB.
// -----------------------------------------------------------
router.get("/tasks", requireAuthPage, async (req, res, next) => {
  const ownerEmail = req.sessionUser.email;
  try {
    const requestedView = (() => {
      const raw = String(req.query.view || "active").toLowerCase();
      if (raw === "active" || raw === "in_progress" || raw === "completed" || raw === "upcoming" || raw === "all") return raw;
      return "active";
    })();
    const filterView = requestedView === "in_progress" ? "active" : requestedView;

    const [tasks, stats] = await Promise.all([
      TaskService.findAll(filterView, ownerEmail),
      TaskService.getStats(ownerEmail),
    ]);
    const [rail, authContext] = await Promise.all([
      buildTasksRail(requestedView, ownerEmail, stats),
      loadAuthContext(req),
    ]);

    renderLayout(res, {
      title: "Tasks",
      activeNav: "tasks",
      page: "task",
      rail,
      pageLocals: { tasks: tasks.map((t) => t.toObject()), taskView: requestedView },
      ...authContext,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Notes: render only the current account's notes while supporting
// pinned filtering and direct links to a selected note.
// -----------------------------------------------------------
async function renderNotesPage(req, res, { onlyPinned = false, activeId = null } = {}) {
  const ownerEmail = req.sessionUser.email;
  const allNotes = await NoteService.findAll("all", ownerEmail);
  const visibleNotes = onlyPinned ? allNotes.filter((note) => note.pinned) : allNotes;
  const plain = visibleNotes.map((note) => note.toObject());
  const activeNote = activeId
    ? plain.find((note) => String(note._id) === String(activeId)) || plain[0] || null
    : plain[0] || null;
  const [rail, authContext] = await Promise.all([
    buildNotesRail(ownerEmail, allNotes),
    loadAuthContext(req),
  ]);

  renderLayout(res, {
    title: "Notes",
    activeNav: "notes",
    page: "note",
    rail,
    pageLocals: { notes: plain, activeNote },
    ...authContext,
  });
}

router.get("/notes", requireAuthPage, (req, res, next) => {
  renderNotesPage(req, res, { onlyPinned: req.query.pinned === "1" }).catch(next);
});

router.get("/notes/new", requireAuthPage, async (req, res, next) => {
  try {
    const note = await NoteService.create(
      { title: "Untitled note", content: "" },
      req.sessionUser.email
    );
    res.redirect(`/notes/${note._id}`);
  } catch (err) {
    next(err);
  }
});

router.get("/notes/:id", requireAuthPage, (req, res, next) => {
  renderNotesPage(req, res, { activeId: req.params.id }).catch(next);
});

// -----------------------------------------------------------
// Calendar: load the CURRENT USER's real events + tasks with dueDate,
// overlay both onto the month grid.
// -----------------------------------------------------------
router.get("/calendar", requireAuthPage, async (req, res, next) => {
  const ownerEmail = req.sessionUser.email;
  try {
    const now = new Date();
    const requestedYear = Number.parseInt(req.query.year, 10);
    const requestedMonth = Number.parseInt(req.query.month, 10);
    const calendarYear = Number.isInteger(requestedYear) ? requestedYear : now.getFullYear();
    const calendarMonth = Number.isInteger(requestedMonth) ? requestedMonth : now.getMonth();

    if (!Number.isInteger(requestedYear) && !Number.isInteger(requestedMonth) && !req.query.date) {
      return res.redirect(`/calendar?year=${calendarYear}&month=${calendarMonth}`);
    }

    const [events, tasks] = await Promise.all([
      CalendarService.findAll(ownerEmail),
      TaskService.findAll("all", ownerEmail),
    ]);
    const [rail, authContext] = await Promise.all([
      buildCalendarRail(ownerEmail, events, calendarYear, calendarMonth),
      loadAuthContext(req),
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
      rail,
      pageLocals: {
        events: combined,
        calendarYear,
        calendarMonth,
      },
      ...authContext,
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
  if (res.locals.isLoggedIn) return res.redirect("/chat");

  res.render("auth/login", {
    title: "Sign in — Butler",
    lang: "en",
    theme: "retro",
    nextUrl: typeof req.query.next === "string" ? req.query.next : "/chat",
  });
});

router.get("/preferences", (_req, res) => {
  res.render("preferences", {
    title: "Preferences — Butler",
    lang: "en",
  });
});

// -----------------------------------------------------------
// Task 6: Settings (user profile), Billing & Credits, Pricing.
// Standalone pages (own <head>, no layout shell) — same pattern
// as /preferences above. Falls back to safe defaults if MongoDB
// is unreachable so these still render during local dev.
//
// /settings is login-aware: if there's a valid session, the name
// and email fields reflect the real logged-in account and email
// is shown read-only (it's the verified login identity). Without
// a session it falls back to the original Task 6 shared demo
// profile, fully editable, so existing local testing still works.
// -----------------------------------------------------------
router.get("/settings", requireAuthPage, async (req, res) => {
  const sessionUser = req.sessionUser;
  let profile = null;
  try {
    profile = await UserProfileService.getOrCreate(sessionUser.email);
  } catch (err) {
    console.warn("[pages] /settings profile unavailable:", err.message);
  }

  const fallbackProfile = {
    name: "Student User",
    email: "student@example.com",
    avatarUrl: "",
  };
  const baseProfile = profile ? profile.toObject() : fallbackProfile;

  res.render("settings", {
    title: "Settings — Butler",
    lang: "en",
    profile: sessionUser
      ? { name: sessionUser.name, email: sessionUser.email, avatarUrl: baseProfile.avatarUrl }
      : baseProfile,
    dbUnavailable: !profile,
    loggedIn: Boolean(sessionUser),
  });
});

router.get("/billing", requireAuthPage, async (req, res) => {
  let profile = null;
  try {
    profile = await UserProfileService.getOrCreate(req.sessionUser.email);
  } catch (err) {
    console.warn("[pages] /billing profile unavailable:", err.message);
  }

  res.render("billing", {
    title: "Billing & Credits — Butler",
    lang: "en",
    profile: profile ? profile.toObject() : {
      plan: "free",
      credits: 0,
      creditsUsed: 0,
      history: [],
    },
    dbUnavailable: !profile,
  });
});

router.get("/pricing", requireAuthPage, async (req, res) => {
  let profile = null;
  try {
    profile = await UserProfileService.getOrCreate(req.sessionUser.email);
  } catch (err) {
    console.warn("[pages] /pricing profile unavailable:", err.message);
  }

  res.render("pricing", {
    title: "Pricing — Butler",
    lang: "en",
    currentPlan: profile ? profile.plan : "free",
    dbUnavailable: !profile,
  });
});

// Account-scoped achievement progress derived from persisted workspace data.
router.get("/achievements", requireAuthPage, async (req, res, next) => {
  try {
    const summary = await AchievementService.getBadges(req.sessionUser.email);
    res.render("achievements", {
      title: "Achievements — Butler",
      lang: "en",
      summary,
    });
  } catch (err) {
    next(err);
  }
});

// -----------------------------------------------------------
// Logout. Destroys the MongoDB Session before clearing its opaque cookie.
// -----------------------------------------------------------
router.post("/logout", async (req, res, next) => {
  try {
    const token = req.sessionToken || readSessionCookie(req);
    await AuthService.destroySession(token);
    clearSessionCookie(res);
    res.redirect("/auth/login");
  } catch (err) {
    next(err);
  }
});

module.exports = router;
