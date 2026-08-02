// Owner: HeinThuNyiNyi - Automated Testing
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ejs = require("ejs");

const root = path.join(__dirname, "..");
const views = path.join(root, "src/views");
const calendarUi = fs.readFileSync(path.join(root, "src/public/js/calendar-ui.js"), "utf8");
const tasksUi = fs.readFileSync(path.join(root, "src/public/js/tasks-ui.js"), "utf8");

function routeContracts(router) {
  return new Set(
    router.stack
      .filter((layer) => layer.route)
      .flatMap((layer) =>
        Object.keys(layer.route.methods).map(
          (method) => `${method.toUpperCase()} ${layer.route.path}`
        )
      )
  );
}

function assertButtonContracts(html, allowedMarkers, label) {
  const buttons = html.match(/<button\b[\s\S]*?<\/button>/g) || [];
  assert.ok(buttons.length > 0, `${label} should render interactive buttons`);

  buttons.forEach((button) => {
    assert.match(button, /\btype="button"/, `${label} button must not submit implicitly: ${button}`);
    assert.ok(
      allowedMarkers.some((marker) => button.includes(marker)),
      `${label} button has no tested action marker: ${button}`
    );
  });
}

test("calendar renders only buttons with a wired action contract", async () => {
  const html = await ejs.renderFile(path.join(views, "pages/calendar.ejs"), {
    events: [],
    calendarYear: 2026,
    calendarMonth: 6,
  });

  assertButtonContracts(
    html,
    [
      "data-calendar-prev",
      "data-calendar-next",
      "data-calendar-today",
      "data-calendar-new-event",
      "data-refresh-calendar",
      "data-day=",
    ],
    "calendar"
  );

  [
    "data-calendar-prev",
    "data-calendar-next",
    "data-calendar-today",
    "data-calendar-new-event",
    "data-refresh-calendar",
  ].forEach((marker) => {
    assert.ok(calendarUi.includes(marker), `calendar controller must handle ${marker}`);
  });
  assert.match(calendarUi, /grid\.addEventListener\("click"[\s\S]*?selectDay\(btn\)/);
});

test("task workspace renders only buttons and controls with wired action contracts", async () => {
  const html = await ejs.renderFile(path.join(views, "pages/task.ejs"), {
    tasks: [
      {
        _id: "task-contract",
        title: "Contract test task",
        description: "Exercise task actions",
        status: "active",
        dueDate: "2026-07-30T00:00:00.000Z",
        priority: "medium",
      },
    ],
    taskView: "all",
    rail: { taskView: "all" },
  });

  assertButtonContracts(
    html,
    ["data-action=\"new-task\"", "data-refresh-tasks", "data-task-edit", "data-task-delete"],
    "tasks"
  );
  assert.match(html, /type="checkbox"[\s\S]*?data-task-toggle/);

  [
    "data-action='new-task'",
    "data-refresh-tasks",
    "data-task-edit",
    "data-task-delete",
    "data-task-toggle",
  ].forEach((marker) => {
    assert.ok(tasksUi.includes(marker), `tasks controller must handle ${marker}`);
  });
});

test("sidebar create controls have both JavaScript behavior and a valid fallback", async () => {
  const calendarSidebar = await ejs.renderFile(path.join(views, "partials/sidebar.ejs"), {
    activeNav: "calendar",
    activeCustomPanelId: null,
    rail: { miniMonth: [], calendarTags: [] },
  });
  const taskSidebar = await ejs.renderFile(path.join(views, "partials/sidebar.ejs"), {
    activeNav: "tasks",
    activeCustomPanelId: null,
    rail: { taskView: "all", taskCounts: {} },
  });

  assert.match(
    calendarSidebar,
    /<a\b(?=[^>]*href="\/calendar\/new")(?=[^>]*data-action="new-event")[^>]*>/
  );
  assert.match(
    taskSidebar,
    /<button\b(?=[^>]*type="button")(?=[^>]*data-action="new-task")[^>]*>/
  );
  assert.match(calendarUi, /data-action="new-event"[\s\S]*?ev\.preventDefault\(\)[\s\S]*?openEventModal\(\)/);
  assert.match(tasksUi, /data-action="new-task"[\s\S]*?openModal\(\)/);

  const pageRoutes = routeContracts(require("../src/routes/pages"));
  assert.ok(pageRoutes.has("GET /calendar/new"));
  assert.ok(pageRoutes.has("GET /calendar"));
  assert.ok(pageRoutes.has("GET /tasks"));
});

test("button effects point to registered and mounted API routes", () => {
  const taskRoutes = routeContracts(require("../src/routes/api/tasks"));
  const calendarRoutes = routeContracts(require("../src/routes/api/calendar"));

  [
    "POST /",
    "GET /",
    "PUT /:id",
    "PATCH /:id",
    "DELETE /:id",
    "PATCH /:id/toggle",
  ].forEach((contract) => {
    assert.ok(taskRoutes.has(contract), `missing tasks API route: ${contract}`);
  });
  ["POST /", "GET /month/:year/:month"].forEach((contract) => {
    assert.ok(calendarRoutes.has(contract), `missing calendar API route: ${contract}`);
  });

  assert.match(tasksUi, /ButlerApi\.createOperation\("task"\)/);
  assert.match(tasksUi, /createTask\("\/tasks"/);
  assert.match(tasksUi, /ButlerApi\.put\("\/tasks\/" \+ idInput\.value/);
  assert.match(tasksUi, /ButlerApi\.patch\("\/tasks\/" \+ id \+ "\/toggle"/);
  assert.match(tasksUi, /ButlerApi\.del\("\/tasks\/" \+ delId/);
  assert.match(calendarUi, /ButlerApi\.createOperation\("event"\)/);
  assert.match(calendarUi, /createEvent\("\/calendar"/);
  assert.match(calendarUi, /ButlerApi\.get\("\/calendar\/month\/" \+ year \+ "\/" \+ month/);

  const mounts = [];
  require("../src/routes")({
    use(...args) {
      if (typeof args[0] === "string") mounts.push(args[0]);
    },
  });
  assert.ok(mounts.includes("/api/tasks"), "tasks API router must be mounted");
  assert.ok(mounts.includes("/api/calendar"), "calendar API router must be mounted");
});
