const mongoose = require("mongoose");

const NoteSchema = new mongoose.Schema(
  {
    // Every note belongs to exactly one account. See Task.js for the
    // same pattern — filters every read/update/delete by owner.
    ownerEmail: {
      type: String,
      required: [true, "ownerEmail is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Note title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    content: {
      type: String,
      trim: true,
      default: "",
    },
    pinned: {
      type: Boolean,
      default: false,
    },
    tags: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Note", NoteSchema);
