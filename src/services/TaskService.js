const Task = require("../models/Task");

class TaskService {
  /**
   * Create a new task, owned by ownerEmail.
   */
  async create(taskData, ownerEmail) {
    const task = new Task({ ...taskData, ownerEmail });
    return await task.save();
  }

  /**
   * Get all tasks belonging to ownerEmail, optionally filtered by view
   * (all, active, completed, upcoming)
   */
  async findAll(view = "all", ownerEmail) {
    let query = { ownerEmail };

    if (view === "active") {
      query.completed = false;
    } else if (view === "completed") {
      query.completed = true;
    } else if (view === "upcoming") {
      query.dueDate = { $gte: new Date() };
      query.completed = false;
    }
    // 'all' returns everything owned by this user (no extra filter)

    return await Task.find(query).sort({ dueDate: 1, createdAt: -1 });
  }

  /**
   * Get a single task by ID, scoped to ownerEmail.
   */
  async findById(taskId, ownerEmail) {
    return await Task.findOne({ _id: taskId, ownerEmail });
  }

  /**
   * Update a task, scoped to ownerEmail (returns null if the task
   * doesn't exist OR belongs to someone else — same 404 either way).
   */
  async update(taskId, updateData, ownerEmail) {
    return await Task.findOneAndUpdate(
      { _id: taskId, ownerEmail },
      updateData,
      { new: true, runValidators: true }
    );
  }

  /**
   * Delete a task, scoped to ownerEmail.
   */
  async delete(taskId, ownerEmail) {
    return await Task.findOneAndDelete({ _id: taskId, ownerEmail });
  }

  /**
   * Toggle task completion status, scoped to ownerEmail.
   */
  async toggleComplete(taskId, ownerEmail) {
    const task = await Task.findOne({ _id: taskId, ownerEmail });
    if (!task) return null;
    task.completed = !task.completed;
    return await task.save();
  }

  /**
   * Get count of tasks by status, scoped to ownerEmail.
   */
  async getStats(ownerEmail) {
    const total = await Task.countDocuments({ ownerEmail });
    const completed = await Task.countDocuments({ ownerEmail, completed: true });
    const active = total - completed;
    const upcoming = await Task.countDocuments({
      ownerEmail,
      dueDate: { $gte: new Date() },
      completed: false,
    });

    return { total, completed, active, upcoming };
  }
}

module.exports = new TaskService();
