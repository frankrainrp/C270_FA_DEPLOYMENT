// ============================================================
// src/services/RailService.js
// Builds real sidebar rail data from MongoDB, scoped to the current
// account (ownerEmail) so one user never sees another's tasks, notes,
// events, or chat sessions in the sidebar.
// ============================================================

const TaskService = require("./TaskService");
const NoteService = require("./NoteService");
const CalendarService = require("./CalendarService");
const ChatSessionService = require("./ChatSessionService");
const { buildMonthGrid } = require("../lib/panelHelpers");

const TAG_COLORS = ["#4a7c99", "#1fa39a", "#ff9500", "#8b5cf6", "#ef4444"];

async function buildTasksRail(taskView = "active", ownerEmail, existingStats) {
  const stats = existingStats || await TaskService.getStats(ownerEmail);
  return {
    taskCounts: {
    active: stats.active,
    in_progress: stats.in_progress,
    upcoming: stats.upcoming,
    all: stats.total,
    completed: stats.completed,
    },
    taskView,
  };
}

async function buildNotesRail(ownerEmail, existingNotes, noteView = "all") {
  const all = existingNotes || await NoteService.findAll("all", ownerEmail);
  const pinned = all.filter((note) => note.pinned);
  return {
    noteView: noteView === "pinned" ? "pinned" : "all",
    noteCounts: {
      all: all.length,
      pinned: pinned.length,
      linked: 0,
    },
    pinnedNotes: pinned.map((n) => ({
      id: String(n._id),
      title: n.title,
    })),
  };
}

async function buildCalendarRail(ownerEmail, existingEvents, year, month) {
  const today = new Date();
  const activeYear = Number.isInteger(year) ? year : today.getFullYear();
  const activeMonth = Number.isInteger(month) ? month : today.getMonth();
  const events = existingEvents || await CalendarService.findByMonth(activeYear, activeMonth, ownerEmail);
  const cells = buildMonthGrid(activeYear, activeMonth, events);

  const miniMonth = cells.map((cell, index) => {
    const dayNum = parseInt(cell.label, 10);
    const date =
      cell.label && !Number.isNaN(dayNum)
        ? `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
        : "";
    return {
      label: cell.label,
      date,
      active: cell.isToday,
      muted: cell.muted,
      hasEvents: cell.events.length > 0,
      key: `cell-${index}`,
    };
  });

  const tagRows = await CalendarService.getTagsSummary(ownerEmail);
  const calendarTags = tagRows.map((row, i) => ({
    label: row._id || "Untagged",
    count: row.count,
    color: TAG_COLORS[i % TAG_COLORS.length],
  }));

  return { miniMonth, calendarTags };
}

async function buildChatRail(ownerEmail, existingSessions, activeSessionId) {
  const sessions = existingSessions || await ChatSessionService.findAll(ownerEmail);
  const mapped = sessions.map((s) => {
    const firstUser = (s.messages || []).find((m) => m.role === "user");
    const title = firstUser && firstUser.content
      ? firstUser.content.slice(0, 48)
      : "Untitled chat";
    return {
      id: String(s._id),
      title,
      updatedAt: new Date(s.updatedAt || s.createdAt).getTime(),
    };
  });

  return {
    sessions: mapped.slice(0, 12),
    activeSessionId: activeSessionId || (mapped[0] ? mapped[0].id : null),
  };
}

module.exports = {
  buildTasksRail,
  buildNotesRail,
  buildCalendarRail,
  buildChatRail,
};
