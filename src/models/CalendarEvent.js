const mongoose = require("mongoose");

const CalendarEventSchema = new mongoose.Schema(
  {
    // Every event belongs to exactly one account. See Task.js for the
    // same pattern — filters every read/update/delete by owner.
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
      required: [true, "Event title is required"],
      trim: true,
      maxlength: [200, "Title cannot exceed 200 characters"],
    },
    date: {
      type: Date,
      required: [true, "Event date is required"],
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    color: {
      type: String,
      enum: ["red", "orange", "yellow", "green", "blue", "purple", "gray"],
      default: "blue",
    },
    tag: {
      type: String,
      trim: true,
      default: "",
    },
    allDay: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Index on date for efficient calendar queries
CalendarEventSchema.index({ date: 1 });
CalendarEventSchema.index({ ownerEmail: 1, idempotencyKey: 1 }, { unique: true, sparse: true });

module.exports = mongoose.model("CalendarEvent", CalendarEventSchema);
