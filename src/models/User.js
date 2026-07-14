// ============================================================
// src/models/User.js
// Real login identity (email + OTP verified via n8n).
//
// Kept deliberately separate from models/UserProfile.js: User stores
// login identity and verification state, while UserProfile stores the
// account-scoped settings, plan, credits, and billing presentation data.
// ============================================================

const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      unique: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
    },
    name: {
      type: String,
      trim: true,
      maxlength: [80, "Name cannot exceed 80 characters"],
      default: "",
    },
    verified: {
      type: Boolean,
      default: false,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("User", UserSchema);
