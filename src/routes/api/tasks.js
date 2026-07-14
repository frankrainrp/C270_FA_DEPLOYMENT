const express = require("express");
const TaskService = require("../../services/TaskService");
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
router.put("/:id", runSafe(async (req, res) => {
  const { title, description, dueDate, priority, status, completed } = req.body;
  const updateData = { title, description, dueDate, priority, status, completed };

  if (!title || !title.trim()) {
    return res.status(400).json(makeFail("Title is required."));
  }

  const task = await TaskService.update(req.params.id, updateData, req.sessionUser.email);
  if (!task) {
    return res.status(404).json(makeFail("Task not found."));
  }
  res.json(makeOk({ task }));
}));

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