const Note = require("../models/Note");

class NoteService {
  /**
   * Create a new note
   */
  async create(noteData) {
    const note = new Note(noteData);
    return await note.save();
  }

  /**
   * Get all notes, optionally filtered (all or pinned)
   */
  async findAll(filter = "all") {
    let query = {};

    if (filter === "pinned") {
      query.pinned = true;
    }

    return await Note.find(query).sort({ pinned: -1, createdAt: -1 });
  }

  /**
   * Get a single note by ID
   */
  async findById(noteId) {
    return await Note.findById(noteId);
  }

  /**
   * Update a note
   */
  async update(noteId, updateData) {
    return await Note.findByIdAndUpdate(noteId, updateData, { new: true, runValidators: true });
  }

  /**
   * Delete a note
   */
  async delete(noteId) {
    return await Note.findByIdAndDelete(noteId);
  }

  /**
   * Toggle note pinned status
   */
  async togglePin(noteId) {
    const note = await Note.findById(noteId);
    if (!note) return null;
    note.pinned = !note.pinned;
    return await note.save();
  }

  /**
   * Get pinned notes (for sidebar display)
   */
  async getPinned() {
    return await Note.find({ pinned: true }).sort({ createdAt: -1 }).limit(5);
  }

  /**
   * Get note count
   */
  async getCount() {
    return await Note.countDocuments();
  }
}

module.exports = new NoteService();
