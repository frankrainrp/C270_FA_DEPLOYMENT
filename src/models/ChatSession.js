const mongoose = require("mongoose");

const ChatSessionSchema = new mongoose.Schema(
  {
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
