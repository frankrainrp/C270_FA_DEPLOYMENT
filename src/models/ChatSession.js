const mongoose = require("mongoose");

const ChatSessionSchema = new mongoose.Schema(
  {
    // Every chat session belongs to exactly one account. See Task.js for
    // the same pattern — filters every read/update/delete by owner.
    ownerEmail: {
      type: String,
      required: [true, "ownerEmail is required"],
      trim: true,
      lowercase: true,
      index: true,
    },
    messages: {
      type: [
        {
          role: {
            type: String,
            enum: ["user", "assistant"],
            required: true,
          },
          content: {
            type: String,
            required: [true, "Message content is required"],
          },
          timestamp: {
            type: Date,
            default: () => new Date(),
          },
        },
      ],
      default: [],
    },
    active: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("ChatSession", ChatSessionSchema);
