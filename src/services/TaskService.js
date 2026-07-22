const Task = require("../models/Task");

const DAY_MS = 24 * 60 * 60 * 1000;
const EDITABLE_FIELDS = ["title", "description", "dueDate", "priority", "status", "completed"];

function definedFields(input, allowedFields) {
  const source = input && typeof input === "object" ? input : {};
  return allowedFields.reduce((out, field) => {
    if (source[field] !== undefined) out[field] = source[field];
    return out;
  }, {});
}

function validDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfUtcDay(value) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function startOfUtcWeek(value) {
  const start = startOfUtcDay(value);
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function taskIsCompleted(task) {
  return task && (task.completed === true || task.status === "completed");
}

function normalizeTaskUpdate(input, now = new Date()) {
  const update = definedFields(input, EDITABLE_FIELDS);

  if (update.completed !== undefined) {
    update.completed = Boolean(update.completed);
    if (update.completed) {
      update.status = "completed";
      update.completedAt = now;
    } else {
      if (!update.status || update.status === "completed") update.status = "active";
      update.completedAt = null;
    }
  } else if (update.status !== undefined) {
    update.completed = update.status === "completed";
    update.completedAt = update.completed ? now : null;
  }

  return update;
}

function buildTaskSummary(tasks, now = new Date(), windowDays = 7) {
  const reference = validDate(now) || new Date();
  const days = Math.min(30, Math.max(1, Number(windowDays) || 7));
  const today = startOfUtcDay(reference);
  const windowEnd = new Date(today.getTime() + days * DAY_MS);
  const weekStart = startOfUtcWeek(reference);
  const list = Array.isArray(tasks) ? tasks : [];
  const completedTasks = list.filter(taskIsCompleted);
  const openTasks = list.filter((task) => !taskIsCompleted(task));
  const overdueTasks = openTasks.filter((task) => {
    const due = validDate(task.dueDate);
    return due && due < today;
  });
  const upcomingTasks = openTasks.filter((task) => {
    const due = validDate(task.dueDate);
    return due && due >= today && due < windowEnd;
  });
  const futureTasks = openTasks.filter((task) => {
    const due = validDate(task.dueDate);
    return due && due >= today;
  });
  const completedThisWeek = completedTasks.filter((task) => {
    // Older records created before completedAt existed fall back to their
    // last update time; all new completion transitions set completedAt.
    const completedAt = validDate(task.completedAt || task.updatedAt);
    return completedAt && completedAt >= weekStart && completedAt <= reference;
  }).length;
  const priorityWeight = { high: 0, medium: 1, low: 2 };
  const priorityTasks = [...openTasks]
    .sort((left, right) => {
      const leftDue = validDate(left.dueDate);
      const rightDue = validDate(right.dueDate);
      const leftOverdue = leftDue && leftDue < today ? 0 : 1;
      const rightOverdue = rightDue && rightDue < today ? 0 : 1;
      if (leftOverdue !== rightOverdue) return leftOverdue - rightOverdue;
      const priorityDiff = (priorityWeight[left.priority] ?? 1) - (priorityWeight[right.priority] ?? 1);
      if (priorityDiff !== 0) return priorityDiff;
      return (leftDue ? leftDue.getTime() : Number.MAX_SAFE_INTEGER)
        - (rightDue ? rightDue.getTime() : Number.MAX_SAFE_INTEGER);
    })
    .slice(0, 3)
    .map((task) => {
      const due = validDate(task.dueDate);
      return {
        id: String(task._id || task.id || ""),
        title: task.title,
        priority: task.priority || "medium",
        status: task.status || "active",
        dueDate: due ? due.toISOString() : null,
        reason: due && due < today
          ? "overdue"
          : task.priority === "high"
            ? "high_priority"
            : due && due < windowEnd
              ? "due_soon"
              : "next_open_task",
      };
    });

  return {
    total: list.length,
    open: openTasks.length,
    active: openTasks.filter((task) => task.status !== "in_progress").length,
    inProgress: openTasks.filter((task) => task.status === "in_progress").length,
    completed: completedTasks.length,
    completedThisWeek,
    completionRate: list.length ? Number(((completedTasks.length / list.length) * 100).toFixed(1)) : 0,
    overdue: overdueTasks.length,
    upcoming: upcomingTasks.length,
    upcomingTotal: futureTasks.length,
    highPriorityOpen: openTasks.filter((task) => task.priority === "high").length,
    windowDays: days,
    priorityTasks,
    generatedAt: reference.toISOString(),
  };
}

function formatTaskSummary(summary) {
  if (!summary || summary.total === 0) {
    return "Task summary: you have no tasks yet.";
  }

  const lines = [
    `Task summary: ${summary.completed}/${summary.total} completed (${summary.completionRate}%).`,
    `Open: ${summary.open}; overdue: ${summary.overdue}; due in the next ${summary.windowDays} days: ${summary.upcoming}; high priority: ${summary.highPriorityOpen}.`,
    `Completed this week: ${summary.completedThisWeek}.`,
  ];
  if (Array.isArray(summary.priorityTasks) && summary.priorityTasks.length) {
    lines.push("Top priorities:");
    summary.priorityTasks.forEach((task) => {
      const due = task.dueDate ? `, due ${task.dueDate.slice(0, 10)}` : "";
      lines.push(`- ${task.title} (${task.priority}${due}; ${task.reason.replace(/_/g, " ")})`);
    });
  }
  return lines.join("\n");
}

class TaskService {
  /**
   * Create a new task, owned by ownerEmail.
   */
  async create(taskData, ownerEmail, idempotencyKey) {
    if (idempotencyKey) {
      const existing = await Task.findOne({ ownerEmail, idempotencyKey });
      if (existing) return existing;
    }

    const startsCompleted = taskData.completed === true || taskData.status === "completed";
    try {
      return await new Task({
        ...taskData,
        ownerEmail,
        status: startsCompleted ? "completed" : taskData.status || "active",
        completed: startsCompleted,
        completedAt: startsCompleted ? new Date() : null,
        idempotencyKey: idempotencyKey || undefined,
      }).save();
    } catch (err) {
      if (err && err.code === 11000 && idempotencyKey) {
        return await Task.findOne({ ownerEmail, idempotencyKey });
      }
      throw err;
    }
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
    const normalized = normalizeTaskUpdate(updateData);
    if (Object.keys(normalized).length === 0) return await this.findById(taskId, ownerEmail);
    return await Task.findOneAndUpdate(
      {
        _id: taskId,
        ownerEmail,
      },
      { $set: normalized },
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
   * Toggle complete
   */
  async toggleComplete(taskId, ownerEmail) {
    const task = await Task.findOne({
      _id: taskId,
      ownerEmail,
    });

    if (!task) return null;

    const completed = !taskIsCompleted(task);
    task.status = completed ? "completed" : "active";
    task.completed = completed;
    task.completedAt = completed ? new Date() : null;

    return await task.save();
  }

  /** Builds deterministic task progress and prioritisation data for the AI agent. */
  async getSummary(ownerEmail, windowDays = 7) {
    const tasks = await Task.find({ ownerEmail }).sort({ dueDate: 1, createdAt: -1 });
    return buildTaskSummary(tasks, new Date(), windowDays);
  }

  /** Exposes the pure summary builder for deterministic tests and offline rendering. */
  buildSummary(tasks, now, windowDays) {
    return buildTaskSummary(tasks, now, windowDays);
  }

  /** Formats structured task statistics for the no-model fallback path. */
  formatSummary(summary) {
    return formatTaskSummary(summary);
  }

  /** Exposes update normalisation for contract tests. */
  normalizeUpdate(updateData, now) {
    return normalizeTaskUpdate(updateData, now);
  }
  /**
   * Sidebar statistics
   */
  async getStats(ownerEmail) {
    const summary = await this.getSummary(ownerEmail);
    return {
      total: summary.total,
      active: summary.active,
      in_progress: summary.inProgress,
      completed: summary.completed,
      upcoming: summary.upcomingTotal,
    };
  }
}

module.exports = new TaskService();
