const mongoose = require("mongoose");

const TaskSchema = new mongoose.Schema(
  {
    // Every task belongs to exactly one account. Set from the logged-in
    // session on create and used to filter every read/update/delete so
    // one user's tasks never show up for another.
    ownerEmail: {
      type: String,
      required: [true, "ownerEmail is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    idempotencyKey: { type: String, trim: true, default: undefined },
    title: {
      type: String,
      required: [true, "Task title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    dueDate: {
      type: Date,
      default: null,
    },
    status: {
    type: String,
    enum: ["active", "in_progress", "completed"],
    default: "active",
    },
    completed: {
      type: Boolean,
      default: false,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

TaskSchema.index({ ownerEmail: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Task", TaskSchema);
