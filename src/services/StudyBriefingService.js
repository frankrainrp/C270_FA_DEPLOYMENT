const TaskService = require("./TaskService");
const NoteService = require("./NoteService");
const CalendarService = require("./CalendarService");

const DAY_MS = 24 * 60 * 60 * 1000;

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function plain(record) {
  return record && typeof record.toObject === "function" ? record.toObject() : record || {};
}

function clampDays(value) {
  return Math.min(30, Math.max(1, Number(value) || 7));
}

function buildStudyBriefing({ taskSummary, notes, events }, now = new Date(), windowDays = 7) {
  const reference = validDate(now) || new Date();
  const days = clampDays(windowDays);
  const end = new Date(reference.getTime() + days * DAY_MS);

  const noteHighlights = (Array.isArray(notes) ? notes : [])
    .map(plain)
    .sort((left, right) => {
      if (Boolean(left.pinned) !== Boolean(right.pinned)) return left.pinned ? -1 : 1;
      return (validDate(right.updatedAt || right.createdAt)?.getTime() || 0)
        - (validDate(left.updatedAt || left.createdAt)?.getTime() || 0);
    })
    .slice(0, 3)
    .map((note) => ({
      id: String(note._id || note.id || ""),
      title: note.title || "Untitled note",
      pinned: Boolean(note.pinned),
      updatedAt: validDate(note.updatedAt || note.createdAt)?.toISOString() || null,
    }));

  const upcomingEvents = (Array.isArray(events) ? events : [])
    .map(plain)
    .filter((event) => {
      const date = validDate(event.date);
      return date && date >= reference && date <= end;
    })
    .sort((left, right) => validDate(left.date) - validDate(right.date))
    .slice(0, 5)
    .map((event) => ({
      id: String(event._id || event.id || ""),
      title: event.title || "Untitled event",
      date: validDate(event.date).toISOString(),
      tag: event.tag || "default",
      allDay: Boolean(event.allDay),
    }));

  const safeSummary = taskSummary || {
    total: 0,
    open: 0,
    overdue: 0,
    upcoming: 0,
    completionRate: 0,
    priorityTasks: [],
  };
  const focusItems = [];

  (Array.isArray(safeSummary.priorityTasks) ? safeSummary.priorityTasks : [])
    .slice(0, 3)
    .forEach((task) => {
      focusItems.push({
        type: "task",
        id: String(task.id || ""),
        title: task.title || "Untitled task",
        reason: task.reason || "next_open_task",
        dueDate: task.dueDate || null,
      });
    });

  upcomingEvents.slice(0, 2).forEach((event) => {
    focusItems.push({
      type: "event",
      id: event.id,
      title: event.title,
      reason: "upcoming_event",
      dueDate: event.date,
    });
  });

  if (focusItems.length < 3) {
    noteHighlights.slice(0, 3 - focusItems.length).forEach((note) => {
      focusItems.push({
        type: "note",
        id: note.id,
        title: note.title,
        reason: note.pinned ? "review_pinned_note" : "review_recent_note",
        dueDate: null,
      });
    });
  }

  const headline = safeSummary.open || upcomingEvents.length
    ? `${safeSummary.open || 0} open task${safeSummary.open === 1 ? "" : "s"} and ${upcomingEvents.length} upcoming event${upcomingEvents.length === 1 ? "" : "s"} in the next ${days} days.`
    : "Your next study window is clear; review a recent note or add a new goal.";

  return {
    generatedAt: reference.toISOString(),
    windowDays: days,
    headline,
    taskSummary: safeSummary,
    noteHighlights,
    upcomingEvents,
    focusItems: focusItems.slice(0, 5),
  };
}

function formatStudyBriefing(briefing) {
  const lines = [
    `## Study briefing — next ${briefing.windowDays} days`,
    briefing.headline,
    "",
    `Tasks: ${briefing.taskSummary.completed || 0}/${briefing.taskSummary.total || 0} completed (${briefing.taskSummary.completionRate || 0}%), ${briefing.taskSummary.overdue || 0} overdue.`,
  ];

  if (briefing.focusItems.length) {
    lines.push("", "### Focus next");
    briefing.focusItems.forEach((item) => {
      const due = item.dueDate ? ` — ${item.dueDate.slice(0, 10)}` : "";
      lines.push(`- **${item.title}** (${item.type.replace("_", " ")}, ${item.reason.replace(/_/g, " ")})${due}`);
    });
  }

  if (briefing.noteHighlights.length) {
    lines.push("", "### Notes to revisit");
    briefing.noteHighlights.forEach((note) => {
      lines.push(`- ${note.pinned ? "Pinned: " : ""}${note.title}`);
    });
  }

  return lines.join("\n");
}

class StudyBriefingService {
  async getBriefing(ownerEmail, windowDays = 7) {
    const days = clampDays(windowDays);
    const [taskSummary, notes, events] = await Promise.all([
      TaskService.getSummary(ownerEmail, days),
      NoteService.findAll("all", ownerEmail),
      CalendarService.findAll(ownerEmail),
    ]);
    return buildStudyBriefing({ taskSummary, notes, events }, new Date(), days);
  }

  build(input, now, windowDays) {
    return buildStudyBriefing(input, now, windowDays);
  }

  format(briefing) {
    return formatStudyBriefing(briefing);
  }
}

module.exports = new StudyBriefingService();
module.exports.buildStudyBriefing = buildStudyBriefing;
module.exports.formatStudyBriefing = formatStudyBriefing;
