const mongoose = require("mongoose");
const { generateIdempotencyKey } = require("../lib/idempotencyKey");

const TaskSchema = new mongoose.Schema(
  {
    ownerEmail: {
      type: String,
      required: [true, "ownerEmail is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    // ownerEmail is always present, so MongoDB's compound sparse index also
    // indexes documents whose idempotencyKey would otherwise be missing as
    // null. Give ordinary UI creates a unique key to prevent the second
    // document for an owner from colliding, while preserving caller-provided
    // keys for retry deduplication.
    idempotencyKey: { type: String, trim: true, default: generateIdempotencyKey },
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
    completedAt: {
      type: Date,
      default: null,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high"],
      default: "medium",
    },
    // Internal housekeeping flag, set once by scripts/repairTaskStats.js
    // so the migration is safe to re-run without double-counting stats.
    statsBackfilled: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // Adds createdAt and updatedAt
  }
);

TaskSchema.index({ ownerEmail: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("Task", TaskSchema);
