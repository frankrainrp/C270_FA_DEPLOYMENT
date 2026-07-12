const express = require("express");
const router = express.Router();
const TaskService = require("../../services/TaskService");
const { makeOk, makeFail } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

// Every route below requires a logged-in session and is scoped to
// req.sessionUser.email so one account never sees another's tasks.
router.use(requireAuthApi);

/**
 * GET /api/tasks
 * Get the current user's tasks, optionally filtered by view (all, active, completed, upcoming)
 */
router.get("/", async (req, res) => {
  try {
    const view = req.query.view || "all";
    const tasks = await TaskService.findAll(view, req.sessionUser.email);
    res.json(makeOk({ tasks }));
  } catch (err) {
    console.error("[api/tasks] GET error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/tasks/stats
 * Get the current user's task statistics (total, completed, active, upcoming counts)
 */
router.get("/stats", async (req, res) => {
  try {
    const stats = await TaskService.getStats(req.sessionUser.email);
    res.json(makeOk(stats));
  } catch (err) {
    console.error("[api/tasks] GET /stats error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID (must belong to the current user)
 */
router.get("/:id", async (req, res) => {
  try {
    const task = await TaskService.findById(req.params.id, req.sessionUser.email);
    if (!task) {
      return res.status(404).json(makeFail("Task not found"));
    }
    res.json(makeOk({ task }));
  } catch (err) {
    console.error("[api/tasks] GET /:id error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * POST /api/tasks
 * Create a new task, owned by the current user
 */
router.post("/", async (req, res) => {
  try {
    const { title, description, dueDate, priority } = req.body;

    if (!title) {
      return res.status(400).json(makeFail("Title is required"));
    }

    const task = await TaskService.create({
      title,
      description,
      dueDate,
      priority,
    }, req.sessionUser.email);

    res.status(201).json(makeOk({ task }));
  } catch (err) {
    console.error("[api/tasks] POST error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * PUT /api/tasks/:id
 * Update a task (must belong to the current user)
 */
router.put("/:id", async (req, res) => {
  try {
    const { title, description, dueDate, priority, completed } = req.body;

    const task = await TaskService.update(req.params.id, {
      title,
      description,
      dueDate,
      priority,
      completed,
    }, req.sessionUser.email);

    if (!task) {
      return res.status(404).json(makeFail("Task not found"));
    }

    res.json(makeOk({ task }));
  } catch (err) {
    console.error("[api/tasks] PUT error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * DELETE /api/tasks/:id
 * Delete a task (must belong to the current user)
 */
router.delete("/:id", async (req, res) => {
  try {
    const task = await TaskService.delete(req.params.id, req.sessionUser.email);

    if (!task) {
      return res.status(404).json(makeFail("Task not found"));
    }

    res.json(makeOk({}));
  } catch (err) {
    console.error("[api/tasks] DELETE error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * PATCH /api/tasks/:id/toggle
 * Toggle task completion status (must belong to the current user)
 */
router.patch("/:id/toggle", async (req, res) => {
  try {
    const task = await TaskService.toggleComplete(req.params.id, req.sessionUser.email);

    if (!task) {
      return res.status(404).json(makeFail("Task not found"));
    }

    res.json(makeOk({ task }));
  } catch (err) {
    console.error("[api/tasks] PATCH /toggle error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

module.exports = router;
