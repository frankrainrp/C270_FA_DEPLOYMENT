const express = require("express");
const router = express.Router();
const CalendarService = require("../../services/CalendarService");
const Task = require("../../models/Task"); // Imported Task model for the merge logic
const { makeOk, makeFail } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

// Every route below requires a logged-in session and is scoped to
// req.sessionUser.email so one account never sees another's events.
router.use(requireAuthApi);

/**
 * GET /api/calendar
 * Get the current user's calendar events AND tasks with due dates
 */
router.get("/", async (req, res) => {
  try {
    const ownerEmail = req.sessionUser.email;

    // Fetch both Events and Tasks concurrently
    const [events, tasks] = await Promise.all([
      CalendarService.findAll(ownerEmail),
      Task.find({ ownerEmail, dueDate: { $exists: true, $ne: null } })
    ]);

    // Transform Tasks into "Event-like" objects
    const taskEvents = tasks.map(task => ({
      _id: task._id,
      title: `[Task] ${task.title}`,
      date: task.dueDate,
      color: task.status === 'completed' ? 'gray' : 'green',
      isTask: true,
      status: task.status
    }));

    // Merge them together
    const combinedData = [...events, ...taskEvents];
    res.json(makeOk({ events: combinedData }));
  } catch (err) {
    console.error("[api/calendar] GET error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/month/:year/:month
 * Get the current user's events AND tasks for a specific month (month is 0-indexed: 0=Jan, 11=Dec)
 */
router.get("/month/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    const y = parseInt(year);
    const m = parseInt(month);
    const ownerEmail = req.sessionUser.email;

    // Calculate the start and end dates of the requested month for the Task query
    const startDate = new Date(y, m, 1);
    const endDate = new Date(y, m + 1, 0, 23, 59, 59, 999);

    // Fetch events and tasks for this specific month concurrently
    const [events, tasks] = await Promise.all([
      CalendarService.findByMonth(y, m, ownerEmail),
      Task.find({
        ownerEmail,
        dueDate: { $gte: startDate, $lte: endDate }
      })
    ]);

    // Transform Tasks into "Event-like" objects
    const taskEvents = tasks.map(task => ({
      _id: task._id,
      title: `[Task] ${task.title}`,
      date: task.dueDate,
      color: task.status === 'completed' ? 'gray' : 'green',
      isTask: true,
      status: task.status
    }));

    // Merge them together
    const combinedData = [...events, ...taskEvents];
    res.json(makeOk({ events: combinedData }));
  } catch (err) {
    console.error("[api/calendar] GET /month error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/upcoming
 * Get the current user's upcoming events AND tasks (next 7 days)
 */
router.get("/upcoming", async (req, res) => {
  try {
    const ownerEmail = req.sessionUser.email;
    
    // Calculate date range for the next 7 days for the Task query
    const startDate = new Date();
    const endDate = new Date();
    endDate.setDate(endDate.getDate() + 7);

    // Fetch upcoming events and tasks concurrently
    const [events, tasks] = await Promise.all([
      CalendarService.getUpcoming(ownerEmail),
      Task.find({
        ownerEmail,
        dueDate: { $gte: startDate, $lte: endDate },
        status: { $ne: 'completed' } // Optional: Exclude completed tasks from "upcoming"
      })
    ]);

    // Transform Tasks into "Event-like" objects
    const taskEvents = tasks.map(task => ({
      _id: task._id,
      title: `[Task] ${task.title}`,
      date: task.dueDate,
      color: 'green', // Upcoming tasks are active
      isTask: true,
      status: task.status
    }));

    // Merge them together
    const combinedData = [...events, ...taskEvents];
    res.json(makeOk({ events: combinedData }));
  } catch (err) {
    console.error("[api/calendar] GET /upcoming error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/tags
 * Get the current user's calendar tags summary
 */
router.get("/tags", async (req, res) => {
  try {
    const tags = await CalendarService.getTagsSummary(req.sessionUser.email);
    res.json(makeOk({ tags }));
  } catch (err) {
    console.error("[api/calendar] GET /tags error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/:id
 * Get a single event by ID (must belong to the current user)
 */
router.get("/:id", async (req, res) => {
  try {
    const event = await CalendarService.findById(req.params.id, req.sessionUser.email);
    if (!event) {
      return res.status(404).json(makeFail("Event not found"));
    }
    res.json(makeOk({ event }));
  } catch (err) {
    console.error("[api/calendar] GET /:id error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * POST /api/calendar
 * Create a new calendar event, owned by the current user
 */
router.post("/", async (req, res) => {
  try {
    const { title, date, description, color, tag, allDay } = req.body;

    if (!title) {
      return res.status(400).json(makeFail("Title is required"));
    }
    if (!date) {
      return res.status(400).json(makeFail("Date is required"));
    }

    const event = await CalendarService.create({
      title,
      date,
      description,
      color,
      tag,
      allDay,
    }, req.sessionUser.email, req.get("Idempotency-Key"));

    res.status(201).json(makeOk({ event }));
  } catch (err) {
    console.error("[api/calendar] POST error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * PUT /api/calendar/:id
 * Update an event (must belong to the current user)
 */
router.put("/:id", async (req, res) => {
  try {
    const { title, date, description, color, tag, allDay } = req.body;

    const event = await CalendarService.update(req.params.id, {
      title,
      date,
      description,
      color,
      tag,
      allDay,
    }, req.sessionUser.email);

    if (!event) {
      return res.status(404).json(makeFail("Event not found"));
    }

    res.json(makeOk({ event }));
  } catch (err) {
    console.error("[api/calendar] PUT error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * DELETE /api/calendar/:id
 * Delete an event (must belong to the current user)
 */
router.delete("/:id", async (req, res) => {
  try {
    const event = await CalendarService.delete(req.params.id, req.sessionUser.email);

    if (!event) {
      return res.status(404).json(makeFail("Event not found"));
    }

    res.json(makeOk({}));
  } catch (err) {
    console.error("[api/calendar] DELETE error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

module.exports = router;