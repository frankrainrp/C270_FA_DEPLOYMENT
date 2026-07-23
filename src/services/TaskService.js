const Task = require("../models/Task");
const DailyStat = require("../models/DailyStat");

// ---- ISO week helpers (no external date library needed) ----
function getISOWeek(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

function getISOWeekYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

function formatDateKey(date) {
  const d = new Date(date);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

class TaskService {
  /**
   * Create a new task, owned by ownerEmail.
   */
  async create(taskData, ownerEmail, idempotencyKey) {
    const task = new Task({
      ...taskData,
      ownerEmail,
      status: taskData.status || "active",
      completed: taskData.completed || false,
      idempotencyKey: idempotencyKey,
    });

    return await task.save();
  }

  /**
   * Get all tasks belonging to ownerEmail.
   * Views:
   * all
   * active
   * in_progress
   * completed
   * upcoming
   */
  async findAll(view = "all", ownerEmail) {
    const query = { ownerEmail };

    switch (view) {
      case "active":
        query.status = "active";
        break;

      case "in_progress":
        query.status = "in_progress";
        break;

      case "completed":
        query.status = "completed";
        break;

      case "upcoming":
        query.status = { $ne: "completed" };
        query.dueDate = { $gte: new Date() };
        break;

      case "all":
      default:
        break;
    }

    return await Task.find(query).sort({
      dueDate: 1,
      createdAt: -1,
    });
  }

  /**
   * Find one task
   */
  async findById(taskId, ownerEmail) {
    return await Task.findOne({
      _id: taskId,
      ownerEmail,
    });
  }

  /**
   * Update task
   */
  async update(taskId, updateData, ownerEmail) {
    return await Task.findOneAndUpdate(
      {
        _id: taskId,
        ownerEmail,
      },
      updateData,
      {
        new: true,
        runValidators: true,
      }
    );
  }

  /**
   * Delete task
   */
  async delete(taskId, ownerEmail) {
    return await Task.findOneAndDelete({
      _id: taskId,
      ownerEmail,
    });
  }

  /**
   * Increment or decrement a DailyStat document for the given date.
   * Used to keep historical completion counts durable, independent
   * of whether the originating Task document still exists.
   */
  async _adjustDailyStat(ownerEmail, date, delta) {
    const dateKey = formatDateKey(date);
    const isoWeek = getISOWeek(date);
    const isoWeekYear = getISOWeekYear(date);

    const updated = await DailyStat.findOneAndUpdate(
      { ownerEmail, date: dateKey },
      {
        $inc: { completedCount: delta },
        $setOnInsert: { isoWeek, isoWeekYear },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    // Defensive clamp: never let a decrement push the count below zero
    // (can happen if data is toggled rapidly or out of order).
    if (updated.completedCount < 0) {
      updated.completedCount = 0;
      await updated.save();
    }
  }

  /**
   * Toggle complete
   */
  async toggleComplete(taskId, ownerEmail) {
    const task = await Task.findOne({
      _id: taskId,
      ownerEmail,
    });

    if (!task) return null;

    const wasCompleted = task.status === "completed";
    const previousUpdatedAt = task.updatedAt;

    task.status = wasCompleted ? "active" : "completed";
    task.completed = task.status === "completed";

    const saved = await task.save();

    if (!wasCompleted) {
      // Just marked complete right now — record it against today.
      await this._adjustDailyStat(ownerEmail, new Date(), 1);
    } else {
      // Was completed, now reverted — remove it from the day it had
      // originally been completed on (its updatedAt before this toggle).
      await this._adjustDailyStat(ownerEmail, previousUpdatedAt, -1);
    }

    return saved;
  }

  /**
   * Sidebar statistics
   */
  async getStats(ownerEmail) {
    const total = await Task.countDocuments({
      ownerEmail,
    });

    const active = await Task.countDocuments({
      ownerEmail,
      status: "active",
    });

    const in_progress = await Task.countDocuments({
      ownerEmail,
      status: "in_progress",
    });

    const completed = await Task.countDocuments({
      ownerEmail,
      status: "completed",
    });

    const upcoming = await Task.countDocuments({
      ownerEmail,
      status: { $ne: "completed" },
      dueDate: { $gte: new Date() },
    });

    // Tasks that are still open but whose due date has already passed.
    const overdue = await Task.countDocuments({
      ownerEmail,
      status: { $ne: "completed" },
      dueDate: { $lt: new Date() },
    });

    // Completion rate as a whole-number percentage (0 when there are no tasks yet).
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return {
      total,
      active,
      in_progress,
      completed,
      upcoming,
      overdue,
      completionRate,
    };
  }

  /**
   * Tasks completed per ISO week, for the last `weeksBack` weeks (default 6),
   * read from the durable DailyStat collection so historical counts survive
   * even if the underlying tasks are later deleted. Also returns a `trend`
   * comparing the current week to the previous week.
   */
  async getWeeklyCompletionCounts(ownerEmail, weeksBack = 6) {
    const now = new Date();
    const startDate = new Date(now);
    startDate.setDate(startDate.getDate() - weeksBack * 7);
    const startKey = formatDateKey(startDate);

    const results = await DailyStat.aggregate([
      {
        $match: {
          ownerEmail,
          date: { $gte: startKey },
        },
      },
      {
        $group: {
          _id: {
            isoWeek: "$isoWeek",
            isoWeekYear: "$isoWeekYear",
          },
          count: { $sum: "$completedCount" },
        },
      },
      {
        $sort: { "_id.isoWeekYear": 1, "_id.isoWeek": 1 },
      },
    ]);

    const weeks = [];
    for (let i = weeksBack - 1; i >= 0; i -= 1) {
      const d = new Date(now);
      d.setDate(d.getDate() - i * 7);
      const isoWeek = getISOWeek(d);
      const isoWeekYear = getISOWeekYear(d);
      const match = results.find(
        (r) => r._id.isoWeek === isoWeek && r._id.isoWeekYear === isoWeekYear
      );
      weeks.push({
        isoWeek,
        isoWeekYear,
        label: "W" + isoWeek,
        count: match ? match.count : 0,
      });
    }

    // Trend: compare the most recent week to the one before it.
    const currentWeekCount = weeks.length > 0 ? weeks[weeks.length - 1].count : 0;
    const previousWeekCount = weeks.length > 1 ? weeks[weeks.length - 2].count : 0;

    let percentChange = null;
    if (previousWeekCount > 0) {
      percentChange = Math.round(((currentWeekCount - previousWeekCount) / previousWeekCount) * 100);
    }

    const direction =
      currentWeekCount > previousWeekCount ? "up" :
      currentWeekCount < previousWeekCount ? "down" : "same";

    return {
      weeks,
      trend: {
        currentWeekCount,
        previousWeekCount,
        percentChange,
        direction,
      },
    };
  }
}

module.exports = new TaskService();