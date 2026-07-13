// ============================================================
// src/services/RailService.js
// Builds sidebar rail data from persisted application records.
// ============================================================

const TaskService = require("./TaskService");
const NoteService = require("./NoteService");
const CalendarService = require("./CalendarService");
const ChatSessionService = require("./ChatSessionService");
const { buildMonthGrid } = require("../lib/panelHelpers");

const TAG_COLORS = ["#4a7c99", "#1fa39a", "#ff9500", "#8b5cf6", "#ef4444"];

async function buildTasksRail(taskView = "active", existingStats) {
  const stats = existingStats || await TaskService.getStats();
  return {
    taskCounts: {
      active: stats.active,
      in_progress: stats.active,
      upcoming: stats.upcoming,
      all: stats.total,
      completed: stats.completed,
    },
    taskView,
  };
}

async function buildNotesRail(existingNotes) {
  const all = existingNotes || await NoteService.findAll("all");
  const pinned = all.filter((note) => note.pinned);
  return {
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

async function buildCalendarRail(existingEvents) {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  const events = existingEvents || await CalendarService.findByMonth(year, month);
  const cells = buildMonthGrid(year, month, events);

  const miniMonth = cells.map((cell, index) => {
    const dayNum = parseInt(cell.label, 10);
    const date =
      cell.label && !Number.isNaN(dayNum)
        ? `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`
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

  const tagRows = await CalendarService.getTagsSummary();
  const calendarTags = tagRows.map((row, i) => ({
    label: row._id || "Untagged",
    count: row.count,
    color: TAG_COLORS[i % TAG_COLORS.length],
  }));

  return { miniMonth, calendarTags };
}

async function buildChatRail(existingSessions, activeSessionId) {
  const sessions = existingSessions || await ChatSessionService.findAll();
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
