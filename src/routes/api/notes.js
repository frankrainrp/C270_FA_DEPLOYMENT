const express = require("express");
const router = express.Router();
const NoteService = require("../../services/NoteService");
const { makeOk, makeFail } = require("../../lib/apiResponse");

/**
 * GET /api/notes
 * Get all notes, optionally filtered (all or pinned)
 */
router.get("/", async (req, res) => {
  try {
    const filter = req.query.filter || "all";
    const notes = await NoteService.findAll(filter);
    res.json(makeOk({ notes }));
  } catch (err) {
    console.error("[api/notes] GET error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/notes/pinned
 * Get pinned notes only
 */
router.get("/pinned", async (req, res) => {
  try {
    const notes = await NoteService.getPinned();
    res.json(makeOk({ notes }));
  } catch (err) {
    console.error("[api/notes] GET /pinned error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/notes/:id
 * Get a single note by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const note = await NoteService.findById(req.params.id);
    if (!note) {
      return res.status(404).json(makeFail("Note not found"));
    }
    res.json(makeOk({ note }));
  } catch (err) {
    console.error("[api/notes] GET /:id error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * POST /api/notes
 * Create a new note
 */
router.post("/", async (req, res) => {
  try {
    const { title, content, tags, pinned } = req.body;

    if (!title) {
      return res.status(400).json(makeFail("Title is required"));
    }

    const note = await NoteService.create({
      title,
      content,
      tags,
      pinned,
    });

    res.status(201).json(makeOk({ note }));
  } catch (err) {
    console.error("[api/notes] POST error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * PUT /api/notes/:id
 * Update a note
 */
router.put("/:id", async (req, res) => {
  try {
    const { title, content, tags, pinned } = req.body;

    const note = await NoteService.update(req.params.id, {
      title,
      content,
      tags,
      pinned,
    });

    if (!note) {
      return res.status(404).json(makeFail("Note not found"));
    }

    res.json(makeOk({ note }));
  } catch (err) {
    console.error("[api/notes] PUT error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
router.delete("/:id", async (req, res) => {
  try {
    const note = await NoteService.delete(req.params.id);

    if (!note) {
      return res.status(404).json(makeFail("Note not found"));
    }

    res.json(makeOk({}));
  } catch (err) {
    console.error("[api/notes] DELETE error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * PATCH /api/notes/:id/toggle
 * Toggle note pinned status
 */
router.patch("/:id/toggle", async (req, res) => {
  try {
    const note = await NoteService.togglePin(req.params.id);

    if (!note) {
      return res.status(404).json(makeFail("Note not found"));
    }

    res.json(makeOk({ note }));
  } catch (err) {
    console.error("[api/notes] PATCH /toggle error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

module.exports = router;
