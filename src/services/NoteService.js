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
  async create(noteData, ownerEmail) {
    const note = new Note({ ...normalizeNoteInput(noteData), ownerEmail });
    return await note.save();
  }

  async findAll(filter = "all", ownerEmail) {
    const query = filter === "pinned" ? { ownerEmail, pinned: true } : { ownerEmail };
    return await Note.find(query).sort({ pinned: -1, createdAt: -1 });
  }

  async findById(noteId, ownerEmail) {
    return await Note.findOne({ _id: noteId, ownerEmail });
  }

  async update(noteId, updateData, ownerEmail) {
    return await Note.findOneAndUpdate(
      { _id: noteId, ownerEmail },
      normalizeNoteInput(updateData),
      { new: true, runValidators: true }
    );
  }

  async delete(noteId, ownerEmail) {
    return await Note.findOneAndDelete({ _id: noteId, ownerEmail });
  }

  async togglePin(noteId, ownerEmail) {
    const note = await Note.findOne({ _id: noteId, ownerEmail });
    if (!note) return null;
    note.pinned = !note.pinned;
    return await note.save();
  }

  async getPinned(ownerEmail) {
    return await Note.find({ ownerEmail, pinned: true }).sort({ createdAt: -1 }).limit(5);
  }

  async getCount(ownerEmail) {
    return await Note.countDocuments({ ownerEmail });
  }
}

module.exports = new NoteService();
