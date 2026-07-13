// ============================================================
// src/models/UserProfile.js
// Single-tenant demo profile (Task 6: Platform / Billing / QA).
// There is no multi-user auth yet (see Task 2 / routes/auth), so
// the whole app operates on one "current user" document — the
// same simplification Task/Note/CalendarEvent already use.
//
// Also stores the simulated billing/credits state: plan tier,
// credit balance, and a short append-only history of simulated
// top-ups / plan changes so the Billing page has something real
// to render instead of static mock numbers.
// ============================================================

const mongoose = require("mongoose");

const CreditEventSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["topup", "usage", "plan_change"],
      required: true,
    },
    amount: {
      type: Number,
      default: 0,
    },
    note: {
      type: String,
      trim: true,
      maxlength: [140, "Note cannot exceed 140 characters"],
      default: "",
    },
  },
  { timestamps: true, _id: false }
);

const UserProfileSchema = new mongoose.Schema(
  {
    ownerEmail: {
      type: String,
      required: [true, "ownerEmail is required"],
      trim: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [1, "Name cannot be empty"],
      maxlength: [80, "Name cannot exceed 80 characters"],
      default: "Student User",
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      maxlength: [200, "Email cannot exceed 200 characters"],
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, "Enter a valid email address"],
      default: "student@example.com",
    },
    avatarUrl: {
      type: String,
      trim: true,
      default: "",
    },
    plan: {
      type: String,
      enum: ["free", "pro", "max"],
      default: "free",
    },
    credits: {
      type: Number,
      min: [0, "Credits cannot go negative"],
      default: 20,
    },
    creditsUsed: {
      type: Number,
      min: 0,
      default: 0,
    },
    history: {
      type: [CreditEventSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("UserProfile", UserProfileSchema);
