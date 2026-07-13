const Task = require("../models/Task");

class TaskService {
  /**
   * Create a new task, owned by ownerEmail.
   */
  async create(taskData, ownerEmail) {
    const task = new Task({
      ...taskData,
      ownerEmail,
      status: taskData.status || "active",
      completed: taskData.completed || false,
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
   * Toggle complete
   */
  async toggleComplete(taskId, ownerEmail) {
  const task = await Task.findOne({
    _id: taskId,
    ownerEmail,
  });

  if (!task) return null;

  task.status =
    task.status === "completed"
      ? "active"
      : "completed";

  task.completed = task.status === "completed";

  return await task.save();
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

    return {
      total,
      active,
      in_progress,
      completed,
      upcoming,
    };
  }
}

module.exports = new TaskService();