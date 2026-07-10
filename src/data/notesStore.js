// ============================================================
// src/data/notesStore.js
// Notes store backed by MongoDB (Mongoose). Same public API the
// routes/client already use — now async (each returns a Promise).
// ============================================================

const mongoose = require("mongoose");
const Note = require("../models/Note");

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

// Shape sent to the template / browser. Maps a Mongo document to the
// exact fields the EJS + client JS expect (note: string id, not _id).
function toClient(doc) {
  const updatedAt = doc.updatedAt ? doc.updatedAt.getTime() : Date.now();
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    preview: makePreview(doc.body),
    updated: relativeTime(updatedAt),
    updatedAt,
  };
}

// Guard so a malformed id (e.g. old "n1") doesn't throw a CastError.
const isValidId = (id) => mongoose.Types.ObjectId.isValid(id);

// ---------- Public API (unchanged names, now async) ----------
async function listNotes() {
  const docs = await Note.find().sort({ updatedAt: -1 }); // newest first
  return docs.map(toClient);
}

async function getNote(id) {
  if (!isValidId(id)) return null;
  const doc = await Note.findById(id);
  return doc ? toClient(doc) : null;
}

async function createNote(input = {}) {
  const doc = await Note.create({
    title: (input.title || "").trim() || "Untitled note",
    body: input.body || "",
  });
  return toClient(doc);
}

async function updateNote(id, input = {}) {
  if (!isValidId(id)) return null;
  const update = {};
  if (typeof input.title === "string") update.title = input.title.trim() || "Untitled note";
  if (typeof input.body === "string") update.body = input.body;
  const doc = await Note.findByIdAndUpdate(id, update, { new: true });
  return doc ? toClient(doc) : null;
}

async function deleteNote(id) {
  if (!isValidId(id)) return false;
  return Boolean(await Note.findByIdAndDelete(id));
}

async function countNotes() {
  return Note.countDocuments();
}

// Seed the three demo notes ONLY when the collection is empty, so a
// server restart doesn't keep duplicating them.
async function seedIfEmpty() {
  if ((await Note.countDocuments()) > 0) return;
  await Note.create([
    { title: "DevOps CA2 spec", body: "# DevOps CA2 spec\n\n- Bring tasks, calendar, notes, and AI chat together.\n- Keep the experience calm and visually clear.\n- Record the final reflection for the hand-in." },
    { title: "React → EJS mapping", body: "# React → EJS mapping\n\n- Use the current layout shell for the main app chrome.\n- Reuse the chat stream logic and the existing state container.\n- Keep the styling system consistent across the workspace." },
    { title: "Ideas for the data panel", body: "# Ideas for the data panel\n\n- Generate a tiny insight card for task completion.\n- Highlight the daily focus trend.\n- Save the best view as a custom panel." },
  ]);
  console.log("[db] seeded 3 demo notes into butlernotes");
}

module.exports = { listNotes, getNote, createNote, updateNote, deleteNote, countNotes, seedIfEmpty };
