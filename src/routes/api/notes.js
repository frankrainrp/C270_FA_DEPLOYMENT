// ============================================================
// src/routes/api/notes.js
// JSON REST API for notes.  Uses the { ok, data } envelope.
//   GET    /api/notes        -> list (optional ?q= search)
//   GET    /api/notes/:id    -> one note
//   POST   /api/notes        -> create { title?, body? }
//   PUT    /api/notes/:id    -> update { title?, body? }
//   DELETE /api/notes/:id    -> delete
// ============================================================

const express = require("express");

const store = require("../../data/notesStore");
const { makeOk, makeFail, runSafe } = require("../../lib/apiResponse");

const router = express.Router();

router.get("/", runSafe(async (req, res) => {
  const q = String(req.query.q || "").trim().toLowerCase();
  let notes = await store.listNotes();
  if (q) {
    notes = notes.filter((n) => (n.title + " " + n.body).toLowerCase().includes(q));
  }
  res.json(makeOk({ notes }));
}));

router.get("/:id", runSafe(async (req, res) => {
  const note = await store.getNote(req.params.id);
  if (!note) return res.status(404).json(makeFail("Note not found."));
  res.json(makeOk({ note }));
}));

router.post("/", runSafe(async (req, res) => {
  const note = await store.createNote(req.body || {});
  res.status(201).json(makeOk({ note }));
}));

router.put("/:id", runSafe(async (req, res) => {
  const note = await store.updateNote(req.params.id, req.body || {});
  if (!note) return res.status(404).json(makeFail("Note not found."));
  res.json(makeOk({ note }));
}));

router.delete("/:id", runSafe(async (req, res) => {
  const removed = await store.deleteNote(req.params.id);
  if (!removed) return res.status(404).json(makeFail("Note not found."));
  res.json(makeOk({ removed: true }));
}));

module.exports = router;
