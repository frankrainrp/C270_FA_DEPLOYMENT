const CalendarEvent = require("../models/CalendarEvent");

class CalendarService {
  /**
   * Create a new calendar event, owned by ownerEmail.
   */
  async create(eventData, ownerEmail, idempotencyKey) {
    if (idempotencyKey) {
      const existing = await CalendarEvent.findOne({ ownerEmail, idempotencyKey });
      if (existing) return existing;
    }
    try {
      return await new CalendarEvent({
        ...eventData,
        ownerEmail,
        idempotencyKey: idempotencyKey || undefined,
      }).save();
    } catch (err) {
      if (err && err.code === 11000 && idempotencyKey) {
        return await CalendarEvent.findOne({ ownerEmail, idempotencyKey });
      }
      throw err;
    }
  }

  /**
   * Get all calendar events belonging to ownerEmail.
   */
  async findAll(ownerEmail) {
    return await CalendarEvent.find({ ownerEmail }).sort({ date: 1 });
  }

  /**
   * Get events for a specific date or date range, scoped to ownerEmail.
   */
  async findByDateRange(startDate, endDate, ownerEmail) {
    return await CalendarEvent.find({
      ownerEmail,
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });
  }

  /**
   * Get a single event by ID, scoped to ownerEmail.
   */
  async findById(eventId, ownerEmail) {
    return await CalendarEvent.findOne({ _id: eventId, ownerEmail });
  }

  /**
   * Update an event, scoped to ownerEmail.
   */
  async update(eventId, updateData, ownerEmail) {
    return await CalendarEvent.findOneAndUpdate(
      { _id: eventId, ownerEmail },
      updateData,
      { new: true, runValidators: true }
    );
  }

  /**
   * Delete an event, scoped to ownerEmail.
   */
  async delete(eventId, ownerEmail) {
    return await CalendarEvent.findOneAndDelete({ _id: eventId, ownerEmail });
  }

  /**
   * Get events for a specific month (for calendar view), scoped to ownerEmail.
   */
  async findByMonth(year, month, ownerEmail) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    return await this.findByDateRange(startDate, endDate, ownerEmail);
  }

  /**
   * Get upcoming events (next 7 days), scoped to ownerEmail.
   */
  async getUpcoming(ownerEmail) {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return await this.findByDateRange(now, sevenDaysLater, ownerEmail);
  }

  /**
   * Get calendar tags summary, scoped to ownerEmail.
   */
  async getTagsSummary(ownerEmail) {
    return await CalendarEvent.aggregate([
      { $match: { ownerEmail } },
      {
        $group: {
          _id: "$tag",
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
    ]);
  }
}

module.exports = new CalendarService();
