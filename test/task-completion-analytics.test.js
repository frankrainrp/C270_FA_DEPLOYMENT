// Owner: HeinThuNyiNyi - Automated Testing
const assert = require("node:assert/strict");
const test = require("node:test");

const Task = require("../src/models/Task");
const TaskService = require("../src/services/TaskService");

test("direct task updates keep durable completion analytics in sync", async (t) => {
  const originalFindOne = Task.findOne;
  const originalAdjust = TaskService._adjustDailyStat;
  const adjustments = [];
  const task = {
    _id: "task-1",
    ownerEmail: "student@example.test",
    title: "Prepare demo",
    status: "active",
    completed: false,
    completedAt: null,
    updatedAt: new Date("2026-07-20T10:00:00.000Z"),
    async save() { return this; },
  };

  Task.findOne = async (query) => {
    assert.equal(query.ownerEmail, "student@example.test");
    return task;
  };
  TaskService._adjustDailyStat = async (ownerEmail, date, delta) => {
    adjustments.push({ ownerEmail, date: new Date(date), delta });
  };

  t.after(() => {
    Task.findOne = originalFindOne;
    TaskService._adjustDailyStat = originalAdjust;
  });

  await TaskService.update("task-1", { status: "completed" }, "student@example.test");
  assert.equal(task.status, "completed");
  assert.equal(task.completed, true);
  assert.ok(task.completedAt instanceof Date);
  assert.equal(adjustments.length, 1);
  assert.equal(adjustments[0].delta, 1);

  const originalCompletionDate = task.completedAt;
  await TaskService.update("task-1", { priority: "high" }, "student@example.test");
  assert.equal(task.completedAt, originalCompletionDate);
  assert.equal(adjustments.length, 1, "editing a completed task must not double-count it");

  await TaskService.update("task-1", { completed: false }, "student@example.test");
  assert.equal(task.status, "active");
  assert.equal(task.completed, false);
  assert.equal(task.completedAt, null);
  assert.equal(adjustments.length, 2);
  assert.equal(adjustments[1].delta, -1);
  assert.equal(adjustments[1].date.getTime(), originalCompletionDate.getTime());
});
