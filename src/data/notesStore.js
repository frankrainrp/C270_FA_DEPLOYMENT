// ============================================================
// src/data/notesStore.js
// In-memory notes store — the single source of truth for Notes.
// Replaces the hardcoded demo list that used to live in note.ejs.
// A later phase can swap this for a real DB (Mongoose) without
// touching the routes or client, as long as these functions stay.
// ============================================================

let sequence = 0;
const notes = new Map();

function nextId() {
  sequence += 1;
  return "n" + sequence;
}

// First meaningful line of the body, trimmed to a short preview.
function makePreview(body) {
  const line = String(body || "")
    .split("\n")
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith("#"));
  const text = line || "Empty note.";
  return text.length > 120 ? text.slice(0, 117) + "..." : text;
}

// Turns a timestamp into "5 min ago" / "Yesterday" style text.
function relativeTime(timestamp) {
  const min = Math.floor((Date.now() - timestamp) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return min + " min ago";
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr + (hr === 1 ? " hour ago" : " hours ago");
  const day = Math.floor(hr / 24);
  return day === 1 ? "Yesterday" : day + " days ago";
}

// Shape sent to the template / browser.
function toClient(note) {
  return {
    id: note.id,
    title: note.title,
    body: note.body,
    preview: makePreview(note.body),
    updated: relativeTime(note.updatedAt),
    updatedAt: note.updatedAt,
  };
}

// ---------- Public API ----------
function listNotes() {
  return [...notes.values()]
    .sort((a, b) => b.updatedAt - a.updatedAt) // newest first
    .map(toClient);
}

function getNote(id) {
  const note = notes.get(id);
  return note ? toClient(note) : null;
}

function createNote(input = {}) {
  const now = Date.now();
  const note = {
    id: nextId(),
    title: (input.title || "").trim() || "Untitled note",
    body: input.body || "",
    createdAt: now,
    updatedAt: now,
  };
  notes.set(note.id, note);
  return toClient(note);
}

function updateNote(id, input = {}) {
  const note = notes.get(id);
  if (!note) return null;
  if (typeof input.title === "string") note.title = input.title.trim() || "Untitled note";
  if (typeof input.body === "string") note.body = input.body;
  note.updatedAt = Date.now();
  return toClient(note);
}

function deleteNote(id) {
  return notes.delete(id);
}

function countNotes() {
  return notes.size;
}

// Seed the same three demo notes the UI used to hardcode.
(function seed() {
  const now = Date.now();
  const drafts = [
    { title: "DevOps CA2 spec", updatedAt: now - 5 * 60000,
      body: "# DevOps CA2 spec\n\n- Bring tasks, calendar, notes, and AI chat together.\n- Keep the experience calm and visually clear.\n- Record the final reflection for the hand-in." },
    { title: "React → EJS mapping", updatedAt: now - 60 * 60000,
      body: "# React → EJS mapping\n\n- Use the current layout shell for the main app chrome.\n- Reuse the chat stream logic and the existing state container.\n- Keep the styling system consistent across the workspace." },
    { title: "Ideas for the data panel", updatedAt: now - 24 * 60 * 60000,
      body: "# Ideas for the data panel\n\n- Generate a tiny insight card for task completion.\n- Highlight the daily focus trend.\n- Save the best view as a custom panel." },
  ];
  drafts.forEach((d) => {
    const id = nextId();
    notes.set(id, { id, title: d.title, body: d.body, createdAt: d.updatedAt, updatedAt: d.updatedAt });
  });
})();

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote, countNotes };
