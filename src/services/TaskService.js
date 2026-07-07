const Task = require("../models/Task");

class TaskService {
  /**
   * Create a new task
   */
  async create(taskData) {
    const task = new Task(taskData);
    return await task.save();
  }

  /**
   * Get all tasks, optionally filtered by view (all, active, completed, upcoming)
   */
  async findAll(view = "all") {
    let query = {};

    if (view === "active") {
      query.completed = false;
    } else if (view === "completed") {
      query.completed = true;
    } else if (view === "upcoming") {
      query.dueDate = { $gte: new Date() };
      query.completed = false;
    }
    // 'all' returns everything (no filter)

    return await Task.find(query).sort({ dueDate: 1, createdAt: -1 });
  }

  /**
   * Get a single task by ID
   */
  async findById(taskId) {
    return await Task.findById(taskId);
  }

  /**
   * Update a task
   */
  async update(taskId, updateData) {
    return await Task.findByIdAndUpdate(taskId, updateData, { new: true, runValidators: true });
  }

  /**
   * Delete a task
   */
  async delete(taskId) {
    return await Task.findByIdAndDelete(taskId);
  }

  /**
   * Toggle task completion status
   */
  async toggleComplete(taskId) {
    const task = await Task.findById(taskId);
    if (!task) return null;
    task.completed = !task.completed;
    return await task.save();
  }

  /**
   * Get count of tasks by status
   */
  async getStats() {
    const total = await Task.countDocuments();
    const completed = await Task.countDocuments({ completed: true });
    const active = total - completed;
    const upcoming = await Task.countDocuments({
      dueDate: { $gte: new Date() },
      completed: false,
    });

    return { total, completed, active, upcoming };
  }
}

module.exports = new TaskService();
