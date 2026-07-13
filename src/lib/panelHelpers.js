// ============================================================
// src/lib/panelHelpers.js
// Shared helpers for tasks / notes / calendar page rendering.
// ============================================================

function formatDueDate(dueDate) {
  if (!dueDate) return "No due date";
  const due = new Date(dueDate);
  if (Number.isNaN(due.getTime())) return "No due date";

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  const diff = Math.round((day - today) / (1000 * 60 * 60 * 24));

  if (diff === 0) return "Today";
  if (diff === 1) return "Tomorrow";
  if (diff === -1) return "Yesterday";
  if (diff > 1 && diff < 7) return `In ${diff} days`;
  return due.toISOString().slice(0, 10);
}

function notePreview(note) {
  const text = (note && (note.content || note.preview)) || "";
  const flat = String(text).replace(/\s+/g, " ").trim();
  if (flat.length <= 120) return flat;
  return flat.slice(0, 120) + "...";
}

function buildMonthGrid(year, month, events) {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const startPad = (first.getDay() + 6) % 7; // Monday-first grid
  const today = new Date();

  const eventsByDay = {};
  (events || []).forEach((event) => {
    const d = new Date(event.date);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const key = d.getDate();
      if (!eventsByDay[key]) eventsByDay[key] = [];
      eventsByDay[key].push(event);
    }
  });

  const cells = [];
  for (let i = 0; i < startPad; i += 1) {
    cells.push({ label: "", muted: true, isToday: false, events: [] });
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({
      label: String(day),
      muted: false,
      isToday:
        today.getFullYear() === year &&
        today.getMonth() === month &&
        today.getDate() === day,
      events: eventsByDay[day] || [],
    });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ label: "", muted: true, isToday: false, events: [] });
  }
  return cells;
}

module.exports = {
  formatDueDate,
  notePreview,
  buildMonthGrid,
};
