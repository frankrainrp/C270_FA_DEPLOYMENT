// Owner: Chong Khen - Trivy Security and Quality Testing
const assert = require("node:assert/strict");
const test = require("node:test");

const CalendarService = require("../src/services/CalendarService");
const TaskService = require("../src/services/TaskService");

function routeHandler(router, method, routePath) {
  const layer = router.stack.find(
    (candidate) =>
      candidate.route &&
      candidate.route.path === routePath &&
      candidate.route.methods[method.toLowerCase()]
  );
  assert.ok(layer, `expected ${method.toUpperCase()} ${routePath} to be registered`);
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

function invokeJsonHandler(handler, req) {
  return new Promise((resolve, reject) => {
    const response = {
      statusCode: 200,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(body) {
        resolve({ statusCode: this.statusCode, body });
        return this;
      },
    };
    const returned = handler(req, response, reject);
    if (returned && typeof returned.catch === "function") returned.catch(reject);
  });
}

test("/calendar/new performs a real fallback redirect that preserves create intent", () => {
  const pages = require("../src/routes/pages");
  const handler = routeHandler(pages, "get", "/calendar/new");
  let destination = "";

  handler({}, {
    redirect(url) {
      destination = url;
    },
  });

  assert.match(destination, /^\/calendar\?year=\d{4}&month=(?:[0-9]|1[01])&create=event$/);
});

test("calendar create action sends an account-scoped event payload to CalendarService", async () => {
  const calendarRouter = require("../src/routes/api/calendar");
  const handler = routeHandler(calendarRouter, "post", "/");
  const originalCreate = CalendarService.create;
  let captured = null;

  CalendarService.create = async (...args) => {
    captured = args;
    return { _id: "event-created", ...args[0] };
  };

  try {
    const result = await invokeJsonHandler(handler, {
      body: {
        title: "Design review",
        date: "2026-07-31",
        description: "Review the final UI",
        color: "purple",
        tag: "Coursework",
        allDay: true,
      },
      sessionUser: { email: "student@example.com" },
      get(name) {
        return name === "Idempotency-Key" ? "calendar-create-key" : undefined;
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.data.event._id, "event-created");
    assert.deepEqual(captured, [
      {
        title: "Design review",
        date: "2026-07-31",
        description: "Review the final UI",
        color: "purple",
        tag: "Coursework",
        allDay: true,
      },
      "student@example.com",
      "calendar-create-key",
    ]);
  } finally {
    CalendarService.create = originalCreate;
  }
});

test("calendar create action rejects missing title or date before persistence", async () => {
  const calendarRouter = require("../src/routes/api/calendar");
  const handler = routeHandler(calendarRouter, "post", "/");
  const originalCreate = CalendarService.create;
  let createCalls = 0;
  CalendarService.create = async () => {
    createCalls += 1;
    return {};
  };

  const request = (body) =>
    invokeJsonHandler(handler, {
      body,
      sessionUser: { email: "student@example.com" },
      get() {
        return undefined;
      },
    });

  try {
    const missingTitle = await request({ date: "2026-07-31" });
    const missingDate = await request({ title: "No date" });

    assert.equal(missingTitle.statusCode, 400);
    assert.equal(missingTitle.body.ok, false);
    assert.match(missingTitle.body.error, /Title is required/);
    assert.equal(missingDate.statusCode, 400);
    assert.equal(missingDate.body.ok, false);
    assert.match(missingDate.body.error, /Date is required/);
    assert.equal(createCalls, 0);
  } finally {
    CalendarService.create = originalCreate;
  }
});

test("task create action sends the form payload, owner, and idempotency key to TaskService", async () => {
  const tasksRouter = require("../src/routes/api/tasks");
  const handler = routeHandler(tasksRouter, "post", "/");
  const originalCreate = TaskService.create;
  let captured = null;

  TaskService.create = async (...args) => {
    captured = args;
    return { _id: "task-created", ...args[0] };
  };

  try {
    const result = await invokeJsonHandler(handler, {
      body: {
        title: "Write report",
        description: "Finish section four",
        dueDate: "2026-08-01",
        priority: "high",
        status: "active",
      },
      sessionUser: { email: "student@example.com" },
      get(name) {
        return name === "Idempotency-Key" ? "task-create-key" : undefined;
      },
    });

    assert.equal(result.statusCode, 201);
    assert.equal(result.body.ok, true);
    assert.equal(result.body.data.task._id, "task-created");
    assert.deepEqual(captured, [
      {
        title: "Write report",
        description: "Finish section four",
        dueDate: "2026-08-01",
        priority: "high",
        status: "active",
      },
      "student@example.com",
      "task-create-key",
    ]);
  } finally {
    TaskService.create = originalCreate;
  }
});
