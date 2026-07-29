const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ejs = require("ejs");

const views = path.join(__dirname, "../src/views");
const publicDir = path.join(__dirname, "../src/public");

test("renders task filters in the contextual sidebar", async () => {
  const html = await ejs.renderFile(path.join(views, "partials/sidebar.ejs"), {
    activeNav: "tasks",
    activeCustomPanelId: null,
    rail: {
      taskView: "all",
      taskCounts: { active: 2, in_progress: 1, upcoming: 1, all: 4, completed: 1 },
    },
  });

  assert.match(html, />New Task</);
  assert.match(html, /href="\/tasks\?view=all"/);
  assert.match(html, /href="\/tasks\?view=completed"/);
  assert.doesNotMatch(html, /Configure Panel/);
});

test("renders integrated calendar events without a task completion checkbox", async () => {
  const html = await ejs.renderFile(path.join(views, "pages/task.ejs"), {
    tasks: [
      {
        _id: "task-1",
        title: "Future task",
        status: "active",
        dueDate: "2026-08-01T00:00:00.000Z",
        priority: "high",
      },
      {
        _id: "event-1",
        title: "Project demo",
        status: "active",
        dueDate: "2026-08-02T00:00:00.000Z",
        isEvent: true,
      },
    ],
    taskView: "all",
    rail: { taskView: "all" },
  });

  const eventCard = html.match(/<article(?=[^>]*data-task-id="event-1")[\s\S]*?<\/article>/)?.[0] || "";
  assert.match(eventCard, /data-item-type="event"/);
  assert.match(eventCard, /Calendar event/);
  assert.doesNotMatch(eventCard, /data-task-toggle/);
  assert.match(html, /data-task-id="task-1"/);
  assert.equal((html.match(/data-task-id="task-1"/g) || []).length, 1);
  assert.equal((html.match(/data-task-id="event-1"/g) || []).length, 1);
  assert.doesNotMatch(html, /data-task-group=/);
});

test("renders one empty state instead of repeated status groups", async () => {
  const html = await ejs.renderFile(path.join(views, "pages/task.ejs"), {
    tasks: [],
    taskView: "all",
    rail: { taskView: "all" },
  });

  assert.equal((html.match(/No tasks yet\./g) || []).length, 1);
  assert.doesNotMatch(html, /No active tasks\./);
  assert.doesNotMatch(html, /No tasks in progress\./);
  assert.doesNotMatch(html, /No upcoming tasks\./);
  assert.doesNotMatch(html, /No completed tasks yet\./);
  assert.doesNotMatch(html, /data-task-group=/);
});

test("focused task views render a flat filtered list without duplicate headings", async () => {
  const html = await ejs.renderFile(path.join(views, "pages/task.ejs"), {
    tasks: [
      { _id: "active-1", title: "Active", status: "active", priority: "medium" },
      { _id: "progress-1", title: "Progress", status: "in_progress", priority: "medium" },
      { _id: "done-1", title: "Done", status: "completed", completed: true, priority: "medium" },
    ],
    taskView: "completed",
    rail: { taskView: "completed" },
  });

  assert.match(html, /data-task-id="done-1"/);
  assert.doesNotMatch(html, /data-task-id="active-1"/);
  assert.doesNotMatch(html, /data-task-id="progress-1"/);
  assert.doesNotMatch(html, /task-group-title/);
});

test("task creation dialog has shared styles on the tasks page", () => {
  const taskUi = fs.readFileSync(path.join(publicDir, "js/tasks-ui.js"), "utf8");
  const styles = fs.readFileSync(path.join(publicDir, "css/style.css"), "utf8");

  assert.match(taskUi, /data-action='new-task'[\s\S]*?openModal\(\)/);
  assert.match(styles, /\.calendar-event-modal-overlay\s*\{/);
  assert.match(styles, /\.calendar-event-modal-overlay\[hidden\]\s*\{[\s\S]*?display:\s*none/);
  assert.match(styles, /\.calendar-event-modal\s*\{/);
});
