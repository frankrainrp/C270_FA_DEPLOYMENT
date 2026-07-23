const mongoose = require("mongoose");

// One document per (ownerEmail, date). Written to whenever a task is
// completed or un-completed, so historical completion counts survive
// even if the underlying Task document is later deleted.
const DailyStatSchema = new mongoose.Schema(
  {
    ownerEmail: {
      type: String,
      required: [true, "ownerEmail is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    // Stored as YYYY-MM-DD for simple, unambiguous grouping/matching.
    date: {
      type: String,
      required: true,
    },
    completedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isoWeek: {
      type: Number,
      required: true,
    },
    isoWeekYear: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

DailyStatSchema.index({ ownerEmail: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("DailyStat", DailyStatSchema);