const mongoose = require("mongoose");

const CalendarEventSchema = new mongoose.Schema(
  {
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

module.exports = mongoose.model("CalendarEvent", CalendarEventSchema);
