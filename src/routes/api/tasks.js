const express = require("express");
const TaskService = require("../../services/TaskService");
const { makeOk, makeFail, runSafe } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();
router.use(requireAuthApi);

const TASK_UPDATE_FIELDS = ["title", "description", "dueDate", "priority", "status", "completed"];

function taskUpdateFromBody(body) {
  return TASK_UPDATE_FIELDS.reduce((update, field) => {
    if (body && body[field] !== undefined) update[field] = body[field];
    return update;
  }, {});
}

async function updateTask(req, res) {
  const updateData = taskUpdateFromBody(req.body);
  if (Object.keys(updateData).length === 0) {
    return res.status(400).json(makeFail("Provide at least one task field to update."));
  }
  if (updateData.title !== undefined && !String(updateData.title).trim()) {
    return res.status(400).json(makeFail("Title cannot be empty."));
  }

  const task = await TaskService.update(req.params.id, updateData, req.sessionUser.email);
  if (!task) return res.status(404).json(makeFail("Task not found."));
  return res.json(makeOk({ task }));
}

/**
 * POST /api/tasks
 * Create a new task.
 */
router.post("/", runSafe(async (req, res) => {
  const { title, description, dueDate, priority, status } = req.body;
  const ownerEmail = req.sessionUser.email;
  const idempotencyKey = req.get("Idempotency-Key"); // Extract from header

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
 *
 * IMPORTANT: this must be declared BEFORE GET /:id. Express matches
 * routes in registration order, and "/:id" would otherwise swallow
 * requests to "/stats" (treating "stats" as the :id param), which is
 * exactly what was breaking the 7-day completion trend widget.
 */
router.get("/stats", runSafe(async (req, res) => {
  const stats = await TaskService.getStats(req.sessionUser.email);
  res.json(makeOk({ stats }));
}));

/**
 * GET /api/tasks/summary
 * Deterministic account-scoped progress summary used by the AI agent.
 */
router.get("/summary", runSafe(async (req, res) => {
  const requestedDays = Number(req.query.days);
  const windowDays = Number.isFinite(requestedDays) ? requestedDays : 7;
  const summary = await TaskService.getSummary(req.sessionUser.email, windowDays);
  res.json(makeOk({ summary }));
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
 * Get all tasks for the current user, with optional filtering by view.
 */
router.get("/", runSafe(async (req, res) => {
  const view = req.query.view || "all";
  const tasks = await TaskService.findAll(view, req.sessionUser.email);
  res.json(makeOk({ tasks }));
}));

/**
 * PUT /api/tasks/:id
 * Update an existing task.
 */
router.put("/:id", runSafe(updateTask));
router.patch("/:id", runSafe(updateTask));

/**
 * DELETE /api/tasks/:id
 * Delete a task.
 */
router.delete("/:id", runSafe(async (req, res) => {
  const task = await TaskService.delete(req.params.id, req.sessionUser.email);
  if (!task) {
    return res.status(404).json(makeFail("Task not found."));
  }
  res.json(makeOk({ task }));
}));

/**
 * PATCH /api/tasks/:id/toggle
 * Toggle the completed status of a task.
 */
router.patch("/:id/toggle", runSafe(async (req, res) => {
  const task = await TaskService.toggleComplete(req.params.id, req.sessionUser.email);
  if (!task) {
    return res.status(404).json(makeFail("Task not found."));
  }
  res.json(makeOk({ task }));
}));

module.exports = router;
