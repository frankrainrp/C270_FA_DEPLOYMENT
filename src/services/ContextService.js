// ============================================================
// src/services/ContextService.js
// Builds a compact snapshot of the user's current tasks, notes, and
// calendar events.  This snapshot is injected into the system prompt
// so the AI can reference existing MongoDB _id values when the user
// asks it to update, toggle, or delete something.
//
// The snapshot is intentionally short — a bullet list, not JSON — so
// it stays cheap in tokens even when the DB grows.
// ============================================================

const TaskService = require("./TaskService");
const NoteService = require("./NoteService");
const CalendarService = require("./CalendarService");

const MAX_TASKS = 20;
const MAX_NOTES = 10;
const MAX_EVENTS = 15;

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toISOString().slice(0, 10);
  } catch (_) {
    return "";
  }
}

async function buildSnapshot() {
  const lines = [];

  // ----- Tasks -----
  try {
    const tasks = await TaskService.findAll("all");
    lines.push(`Tasks (${tasks.length}):`);
    if (tasks.length === 0) {
      lines.push("  (none)");
    } else {
      tasks.slice(0, MAX_TASKS).forEach((t) => {
        const due = t.dueDate ? ` due=${fmtDate(t.dueDate)}` : "";
        const done = t.completed ? " [done]" : "";
        lines.push(`  - id=${t._id} title="${t.title}" priority=${t.priority}${due}${done}`);
      });
      if (tasks.length > MAX_TASKS) {
        lines.push(`  ... and ${tasks.length - MAX_TASKS} more`);
      }
    }
  } catch (err) {
    lines.push(`Tasks: (unavailable: ${err.message})`);
  }

  lines.push("");

  // ----- Notes -----
  try {
    const notes = await NoteService.findAll("all");
    lines.push(`Notes (${notes.length}):`);
    if (notes.length === 0) {
      lines.push("  (none)");
    } else {
      notes.slice(0, MAX_NOTES).forEach((n) => {
        const pin = n.pinned ? " [pinned]" : "";
        lines.push(`  - id=${n._id} title="${n.title}"${pin}`);
      });
      if (notes.length > MAX_NOTES) {
        lines.push(`  ... and ${notes.length - MAX_NOTES} more`);
      }
    }
  } catch (err) {
    lines.push(`Notes: (unavailable: ${err.message})`);
  }

  lines.push("");

  // ----- Calendar events -----
  try {
    const events = await CalendarService.findAll();
    lines.push(`Calendar events (${events.length}):`);
    if (events.length === 0) {
      lines.push("  (none)");
    } else {
      events.slice(0, MAX_EVENTS).forEach((e) => {
        lines.push(`  - id=${e._id} title="${e.title}" date=${fmtDate(e.date)} tag=${e.tag || ""}`);
      });
      if (events.length > MAX_EVENTS) {
        lines.push(`  ... and ${events.length - MAX_EVENTS} more`);
      }
    }
  } catch (err) {
    lines.push(`Calendar: (unavailable: ${err.message})`);
  }

  return lines.join("\n");
}

module.exports = { buildSnapshot };
