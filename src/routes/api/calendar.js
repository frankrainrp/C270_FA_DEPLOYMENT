const express = require("express");
const router = express.Router();
const CalendarService = require("../../services/CalendarService");
const { makeOk, makeFail } = require("../../lib/apiResponse");

/**
 * GET /api/calendar
 * Get all calendar events
 */
router.get("/", async (req, res) => {
  try {
    const events = await CalendarService.findAll();
    res.json(makeOk({ events }));
  } catch (err) {
    console.error("[api/calendar] GET error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/month/:year/:month
 * Get events for a specific month (month is 0-indexed: 0=Jan, 11=Dec)
 */
router.get("/month/:year/:month", async (req, res) => {
  try {
    const { year, month } = req.params;
    const events = await CalendarService.findByMonth(parseInt(year), parseInt(month));
    res.json(makeOk({ events }));
  } catch (err) {
    console.error("[api/calendar] GET /month error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/upcoming
 * Get upcoming events (next 7 days)
 */
router.get("/upcoming", async (req, res) => {
  try {
    const events = await CalendarService.getUpcoming();
    res.json(makeOk({ events }));
  } catch (err) {
    console.error("[api/calendar] GET /upcoming error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/tags
 * Get calendar tags summary
 */
router.get("/tags", async (req, res) => {
  try {
    const tags = await CalendarService.getTagsSummary();
    res.json(makeOk({ tags }));
  } catch (err) {
    console.error("[api/calendar] GET /tags error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * GET /api/calendar/:id
 * Get a single event by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const event = await CalendarService.findById(req.params.id);
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
 * Create a new calendar event
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
    });

    res.status(201).json(makeOk({ event }));
  } catch (err) {
    console.error("[api/calendar] POST error:", err);
    res.status(500).json(makeFail(err.message));
  }
});

/**
 * PUT /api/calendar/:id
 * Update an event
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
    });

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
 * Delete an event
 */
router.delete("/:id", async (req, res) => {
  try {
    const event = await CalendarService.delete(req.params.id);

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
