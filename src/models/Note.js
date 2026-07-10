// ============================================================
// src/models/Note.js
// Mongoose model for a note.
//   - timestamps:true auto-manages createdAt / updatedAt
//   - the 3rd arg "butlernotes" forces the collection name so it
//     reads/writes your existing collection instead of "notes".
// ============================================================

const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    title: { type: String, default: "Untitled note", trim: true },
    body: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Note", noteSchema, "butlernotes");
