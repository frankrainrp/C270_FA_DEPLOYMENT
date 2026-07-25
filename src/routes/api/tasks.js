// ============================================================
// src/routes/api/tasks.js
// ============================================================
const express = require("express");
const TaskService = require("../../services/TaskService");
const CalendarService = require("../../services/CalendarService");
const { makeOk, makeFail, runSafe } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();
router.use(requireAuthApi);

/**
 * POST /api/tasks
 * Create a new task.
 */
router.post("/", runSafe(async (req, res) => {
  const { title, description, dueDate, priority, status } = req.body;
  const ownerEmail = req.sessionUser.email;
  const idempotencyKey = req.get("Idempotency-Key"); 
  
  if (!title || !title.trim()) {
    return res.status(400).json(makeFail("Title is required."));
  }
  
  const taskData = { title, description, dueDate, priority, status };
  const task = await TaskService.create(taskData, ownerEmail, idempotencyKey);
  res.status(201).json(makeOk({ task }));
}));

/**
 * GET /api/tasks/stats
 * Get task statistics for the current user.
 */
router.get("/stats", runSafe(async (req, res) => {
  const stats = await TaskService.getStats(req.sessionUser.email);
  res.json(makeOk({ stats }));
}));

/**
 * GET /api/tasks/weekly-stats?weeks=6
 * Get tasks-completed-per-week counts for the current user.
 */
router.get("/weekly-stats", runSafe(async (req, res) => {
  const weeksBack = parseInt(req.query.weeks, 10) || 6;
  const weeklyStats = await TaskService.getWeeklyCompletionCounts(req.sessionUser.email, weeksBack);
  res.json(makeOk({ weeklyStats }));
}));

/**
 * GET /api/tasks/:id
 * Get a single task by ID.
 */
router.get("/:id", runSafe(async (req, res) => {
  const task = await TaskService.findById(req.params.id, req.sessionUser.email);
  if (!task) {
    return res.status(404).json(makeFail("Task not found."));
  }
  res.json(makeOk({ task }));
}));

/**
 * GET /api/tasks
 * Get all tasks and events for the current user.
 */
router.get("/", runSafe(async (req, res) => {
  const view = req.query.view || "all";
  const ownerEmail = req.sessionUser.email;
  
  const [tasks, events] = await Promise.all([
    TaskService.findAll(view, ownerEmail),
    CalendarService.findAll(ownerEmail)
  ]);

  const eventTasks = events.map(e => {
    const plain = e.toObject ? e.toObject() : e;
    return {
      _id: plain._id,
      title: `🗓️ ${plain.title}`,
      dueDate: plain.date,
      description: plain.description || "",
      status: "active",
      priority: "medium",
      completed: false,
      isEvent: true
    };
  });

  const combined = [...tasks, ...eventTasks];
  res.json(makeOk({ tasks: combined }));
}));

/**
 * PUT /api/tasks/:id
 * Update an existing task (or Event fallback).
 */
/**
 * PUT /api/tasks/:id
 * Update an existing task (or Event fallback). Allows partial updates!
 */
router.put("/:id", runSafe(async (req, res) => {
  const { title, description, dueDate, priority, status, completed } = req.body;
  
  // Only throw an error if the title is explicitly being set to empty
  if (title !== undefined && (!title || !title.trim())) {
    return res.status(400).json(makeFail("Title is required."));
  }

  // Build an object containing ONLY the fields the frontend actually sent
  const updateData = {};
  if (title !== undefined) updateData.title = title;
  if (description !== undefined) updateData.description = description;
  if (dueDate !== undefined) updateData.dueDate = dueDate;
  if (priority !== undefined) updateData.priority = priority;
  if (status !== undefined) updateData.status = status;
  if (completed !== undefined) updateData.completed = completed;

  // 1. Try to update it as a Task
  let task = await TaskService.update(req.params.id, updateData, req.sessionUser.email);
  
  // 2. Fallback: Try to update it as an Event
  if (!task) {
    const eventUpdate = {};
    if (title !== undefined) eventUpdate.title = title.replace('🗓️ ', ''); 
    if (description !== undefined) eventUpdate.description = description;
    if (dueDate !== undefined) eventUpdate.date = dueDate;

    const event = await CalendarService.update(req.params.id, eventUpdate, req.sessionUser.email);
    
    if (!event) return res.status(404).json(makeFail("Item not found."));
    return res.json(makeOk({ task: event }));
  }

  res.json(makeOk({ task }));
}));

/**
 * DELETE /api/tasks/:id
 * Delete a task (or Event fallback).
 */
router.delete("/:id", runSafe(async (req, res) => {
  // 1. Try deleting as Task
  let task = await TaskService.delete(req.params.id, req.sessionUser.email);
  
  // 2. Fallback: Try deleting as Event
  if (!task) {
    const event = await CalendarService.delete(req.params.id, req.sessionUser.email);
    if (!event) return res.status(404).json(makeFail("Item not found."));
    return res.json(makeOk({ task: event }));
  }
  
  res.json(makeOk({ task }));
}));

/**
 * PATCH /api/tasks/:id/toggle
 */
router.patch("/:id/toggle", runSafe(async (req, res) => {
  const task = await TaskService.toggleComplete(req.params.id, req.sessionUser.email);
  
  if (!task) {
    return res.json(makeOk({})); 
  }
  
  res.json(makeOk({ task }));
}));

module.exports = router;