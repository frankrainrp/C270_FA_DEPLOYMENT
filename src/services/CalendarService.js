const CalendarEvent = require("../models/CalendarEvent");

class CalendarService {
  /**
   * Create a new calendar event
   */
  async create(eventData) {
    const event = new CalendarEvent(eventData);
    return await event.save();
  }

  /**
   * Get all calendar events
   */
  async findAll() {
    return await CalendarEvent.find().sort({ date: 1 });
  }

  /**
   * Get events for a specific date or date range
   */
  async findByDateRange(startDate, endDate) {
    return await CalendarEvent.find({
      date: { $gte: startDate, $lte: endDate },
    }).sort({ date: 1 });
  }

  /**
   * Get a single event by ID
   */
  async findById(eventId) {
    return await CalendarEvent.findById(eventId);
  }

  /**
   * Update an event
   */
  async update(eventId, updateData) {
    return await CalendarEvent.findByIdAndUpdate(eventId, updateData, {
      new: true,
      runValidators: true,
    });
  }

  /**
   * Delete an event
   */
  async delete(eventId) {
    return await CalendarEvent.findByIdAndDelete(eventId);
  }

  /**
   * Get events for a specific month (for calendar view)
   */
  async findByMonth(year, month) {
    const startDate = new Date(year, month, 1);
    const endDate = new Date(year, month + 1, 0);
    return await this.findByDateRange(startDate, endDate);
  }

  /**
   * Get upcoming events (next 7 days)
   */
  async getUpcoming() {
    const now = new Date();
    const sevenDaysLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    return await this.findByDateRange(now, sevenDaysLater);
  }

  /**
   * Get calendar tags summary
   */
  async getTagsSummary() {
    return await CalendarEvent.aggregate([
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
