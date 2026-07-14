// ============================================================
// src/services/AchievementService.js
// Computes achievement badges from real MongoDB usage data
// (tasks, notes, calendar events, chat messages). No separate
// "achievements" collection exists yet: everything here is derived
// on read from the same collections the rest of the app already
// writes to, so a badge unlocking always reflects real activity.
// ============================================================

const mongoose = require("mongoose");
const Task = require("../models/Task");
const Note = require("../models/Note");
const CalendarEvent = require("../models/CalendarEvent");
const ChatSession = require("../models/ChatSession");

// Each definition maps a metric key (computed below) to a badge.
// `target` is the value needed to fully unlock; `progress` is filled
// in at read time as min(value / target, 1).
const BADGE_DEFINITIONS = [
  {
    id: "first-task",
    metric: "tasksTotal",
    target: 1,
    label: "First Steps",
    description: "Create your first task.",
    icon: "🌱",
  },
  {
    id: "task-crusher",
    metric: "tasksCompleted",
    target: 10,
    label: "Task Crusher",
    description: "Complete 10 tasks.",
    icon: "✅",
  },
  {
    id: "deadline-slayer",
    metric: "tasksCompleted",
    target: 25,
    label: "Deadline Slayer",
    description: "Complete 25 tasks.",
    icon: "🗡️",
  },
  {
    id: "note-taker",
    metric: "notesTotal",
    target: 5,
    label: "Note Taker",
    description: "Write 5 notes.",
    icon: "📝",
  },
  {
    id: "bookworm",
    metric: "notesTotal",
    target: 20,
    label: "Bookworm",
    description: "Write 20 notes.",
    icon: "📚",
  },
  {
    id: "pin-it",
    metric: "notesPinned",
    target: 3,
    label: "Pin It",
    description: "Pin 3 important notes.",
    icon: "📌",
  },
  {
    id: "planner",
    metric: "eventsTotal",
    target: 5,
    label: "Planner",
    description: "Add 5 calendar events.",
    icon: "🗓️",
  },
  {
    id: "time-lord",
    metric: "eventsTotal",
    target: 20,
    label: "Time Lord",
    description: "Add 20 calendar events.",
    icon: "⏳",
  },
  {
    id: "chatty-scholar",
    metric: "chatMessagesSent",
    target: 20,
    label: "Chatty Scholar",
    description: "Send 20 messages to Butler.",
    icon: "💬",
  },
  {
    id: "deep-thinker",
    metric: "chatMessagesSent",
    target: 100,
    label: "Deep Thinker",
    description: "Send 100 messages to Butler.",
    icon: "🧠",
  },
];

// Counts user-authored messages in sessions owned by one account.
async function countUserChatMessages(ownerEmail) {
  const result = await ChatSession.aggregate([
    { $match: { ownerEmail } },
    { $unwind: "$messages" },
    { $match: { "messages.role": "user" } },
    { $count: "total" },
  ]);
  return result.length ? result[0].total : 0;
}

async function computeMetrics(ownerEmail) {
  // mongoose.set("bufferCommands", false) means queries throw right
  // away instead of hanging when there is no active connection, so a
  // simple readyState check lets us fail fast and cleanly.
  if (mongoose.connection.readyState !== 1) {
    return { available: false, metrics: {} };
  }

  const [tasksTotal, tasksCompleted, notesTotal, notesPinned, eventsTotal, chatMessagesSent] =
    await Promise.all([
      Task.countDocuments({ ownerEmail }),
      Task.countDocuments({ ownerEmail, completed: true }),
      Note.countDocuments({ ownerEmail }),
      Note.countDocuments({ ownerEmail, pinned: true }),
      CalendarEvent.countDocuments({ ownerEmail }),
      countUserChatMessages(ownerEmail),
    ]);

  return {
    available: true,
    metrics: { tasksTotal, tasksCompleted, notesTotal, notesPinned, eventsTotal, chatMessagesSent },
  };
}

async function getBadges(ownerEmail) {
  const { available, metrics } = await computeMetrics(ownerEmail);

  const badges = BADGE_DEFINITIONS.map((def) => {
    const value = available ? Number(metrics[def.metric] || 0) : 0;
    const progress = def.target > 0 ? Math.min(value / def.target, 1) : 0;
    return {
      id: def.id,
      label: def.label,
      description: def.description,
      icon: def.icon,
      value,
      target: def.target,
      progress,
      unlocked: value >= def.target,
    };
  });

  const unlockedCount = badges.filter((b) => b.unlocked).length;

  return {
    available,
    badges,
    unlockedCount,
    totalCount: badges.length,
  };
}

module.exports = { getBadges };
