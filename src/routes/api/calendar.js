const express = require("express");
const router = express.Router();
const CalendarService = require("../../services/CalendarService");
const { makeOk, makeFail } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

// Every route below requires a logged-in session and is scoped to
// req.sessionUser.email so one account never sees another's events.
router.use(requireAuthApi);

/**
 * GET /api/calendar
 * Get the current user's calendar events
 */
router.get("/", async (req, res) => {
  try {
    const events = await CalendarService.findAll(req.sessionUser.email);
    res.json(makeOk({ events }));
  } catch (err) {
    console.error("[api/calendar] GET error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/month/:year/:month
 * Get the current user's events for a specific month (month is 0-indexed: 0=Jan, 11=Dec)
 */
router.get("/month/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    const events = await CalendarService.findByMonth(parseInt(year), parseInt(month), req.sessionUser.email);
    res.json(makeOk({ events }));
  } catch (err) {
    console.error("[api/calendar] GET /month error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/upcoming
 * Get the current user's upcoming events (next 7 days)
 */
router.get("/upcoming", async (req, res) => {
  try {
    const events = await CalendarService.getUpcoming(req.sessionUser.email);
    res.json(makeOk({ events }));
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
