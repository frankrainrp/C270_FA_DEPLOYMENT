// ============================================================
// scripts/migrate-owner-email.js
// One-time migration: assigns ownerEmail to every existing
// Task / Note / CalendarEvent / ChatSession document that doesn't
// have one yet (i.e. everything created before per-account data
// existed). Safe to re-run — it only ever touches documents where
// ownerEmail is missing.
//
// Usage:
//   node scripts/migrate-owner-email.js you@example.com
//
// Reads MONGO_URI from .env, same as the app itself.
// ============================================================

require("dotenv").config();
const mongoose = require("mongoose");

const Task = require("../src/models/Task");
const Note = require("../src/models/Note");
const CalendarEvent = require("../src/models/CalendarEvent");
const ChatSession = require("../src/models/ChatSession");
const User = require("../src/models/User");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function main() {
  const targetEmail = String(process.argv[2] || "").trim().toLowerCase();

  if (!EMAIL_RE.test(targetEmail)) {
    console.error("Usage: node scripts/migrate-owner-email.js you@example.com");
    process.exit(1);
  }

  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/butler";
  console.log(`[migrate] Connecting to ${mongoUri} ...`);
  await mongoose.connect(mongoUri, { useNewUrlParser: true, useUnifiedTopology: true });

  const user = await User.findOne({ email: targetEmail });
  if (!user) {
    console.error(
      `[migrate] No User account found for "${targetEmail}". ` +
      `Log in with that email at least once first (so the account exists), then re-run this script.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  console.log(`[migrate] Assigning all ownerless data to ${targetEmail} ...`);

  const results = {};
  for (const [label, Model] of [
    ["tasks", Task],
    ["notes", Note],
    ["calendar events", CalendarEvent],
    ["chat sessions", ChatSession],
  ]) {
    const res = await Model.updateMany(
      { $or: [{ ownerEmail: { $exists: false } }, { ownerEmail: null }, { ownerEmail: "" }] },
      { $set: { ownerEmail: targetEmail } }
    );
    results[label] = res.modifiedCount ?? res.nModified ?? 0;
    console.log(`[migrate] ${label}: ${results[label]} document(s) updated`);
  }

  console.log("[migrate] Done.", results);
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("[migrate] Failed:", err);
  process.exit(1);
});
