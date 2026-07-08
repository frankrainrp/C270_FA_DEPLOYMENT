const Note = require("../models/Note");
const { notePreview } = require("../lib/panelHelpers");

function normalizeNoteInput(data) {
  const out = { ...data };
  const body = out.content != null ? out.content : out.preview;
  if (body != null) {
    out.content = String(body);
    out.preview = notePreview({ content: out.content });
  }
  return out;
}

class NoteService {
  async create(noteData) {
    const note = new Note(normalizeNoteInput(noteData));
    return await note.save();
  }

  async findAll(filter = "all") {
    const query = filter === "pinned" ? { pinned: true } : {};
    return await Note.find(query).sort({ pinned: -1, createdAt: -1 });
  }

  async findById(noteId) {
    return await Note.findById(noteId);
  }

  async update(noteId, updateData) {
    return await Note.findByIdAndUpdate(
      noteId,
      normalizeNoteInput(updateData),
      { new: true, runValidators: true }
    );
  }

  async delete(noteId) {
    return await Note.findByIdAndDelete(noteId);
  }

  async togglePin(noteId) {
    const note = await Note.findById(noteId);
    if (!note) return null;
    note.pinned = !note.pinned;
    return await note.save();
  }

  async getPinned() {
    return await Note.find({ pinned: true }).sort({ createdAt: -1 }).limit(5);
  }

  async getCount() {
    return await Note.countDocuments();
  }
}

module.exports = new NoteService();
