// Owner: HeinThuNyiNyi - Automated Testing
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");
const express = require("express");

const TaskService = require("../src/services/TaskService");
const ChatSessionService = require("../src/services/ChatSessionService");
const { CHAT_TOOLS } = require("../src/services/ChatToolDefinitions");
const { buildSystemPrompt } = require("../src/services/ChatPrompt");
const { streamChat } = require("../src/services/ChatService");
const taskRouter = require("../src/routes/api/tasks");

const root = path.join(__dirname, "..");

function listen(app) {
  return new Promise((resolve, reject) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
    server.once("error", reject);
  });
}

function close(server) {
  return new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

test("builds deterministic task summary metrics and top priorities", () => {
  const now = new Date("2026-07-22T12:00:00.000Z");
  const summary = TaskService.buildSummary([
    {
      _id: "done-1",
      title: "Finished report",
      status: "completed",
      completed: true,
      completedAt: new Date("2026-07-21T09:00:00.000Z"),
      priority: "medium",
    },
    {
      _id: "late-1",
      title: "Overdue lab",
      status: "active",
      completed: false,
      dueDate: new Date("2026-07-19T00:00:00.000Z"),
      priority: "medium",
    },
    {
      _id: "high-1",
      title: "Prepare demo",
      status: "active",
      dueDate: new Date("2026-07-24T00:00:00.000Z"),
      priority: "high",
    },
    {
      _id: "progress-1",
      title: "Record walkthrough",
      status: "in_progress",
      dueDate: new Date("2026-07-26T00:00:00.000Z"),
      priority: "low",
    },
    {
      _id: "later-1",
      title: "Future revision",
      status: "active",
      dueDate: new Date("2026-08-10T00:00:00.000Z"),
      priority: "medium",
    },
  ], now, 7);

  assert.equal(summary.total, 5);
  assert.equal(summary.completed, 1);
  assert.equal(summary.open, 4);
  assert.equal(summary.inProgress, 1);
  assert.equal(summary.completionRate, 20);
  assert.equal(summary.completedThisWeek, 1);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.upcoming, 2);
  assert.equal(summary.upcomingTotal, 3);
  assert.equal(summary.highPriorityOpen, 1);
  assert.equal(summary.priorityTasks[0].title, "Overdue lab");
  assert.match(TaskService.formatSummary(summary), /Top priorities:/);
});

test("normalizes partial task updates without requiring a title", () => {
  const priorityOnly = TaskService.normalizeUpdate({ priority: "high" });
  assert.deepEqual(priorityOnly, { priority: "high" });

  const completedAt = new Date("2026-07-22T10:00:00.000Z");
  const completed = TaskService.normalizeUpdate({ completed: true }, completedAt);
  assert.equal(completed.status, "completed");
  assert.equal(completed.completed, true);
  assert.equal(completed.completedAt, completedAt);

  const reopened = TaskService.normalizeUpdate({ completed: false }, completedAt);
  assert.equal(reopened.status, "active");
  assert.equal(reopened.completedAt, null);
});

test("registers task_summary as a read-only, server-grounded Agent capability", () => {
  const summaryTool = CHAT_TOOLS.find((tool) => tool.function.name === "task_summary");
  assert.ok(summaryTool, "task_summary tool must be registered");
  assert.match(summaryTool.function.description, /completion rate/i);

  const prompt = buildSystemPrompt({ userName: "Student", contextSummary: "Tasks (0):\n  (none)" });
  assert.match(prompt, /ALWAYS call task_summary first/);
  assert.match(prompt, /Never invent task counts/);

  const chatView = fs.readFileSync(path.join(root, "src/views/pages/chat.ejs"), "utf8");
  assert.match(chatView, /Summarize my tasks, completion rate, overdue work, and top priorities/);
});

test("executes task summary and priority-only update through the browser tool and authenticated API", async (t) => {
  const originalGetSummary = TaskService.getSummary;
  const originalUpdate = TaskService.update;
  let summaryOwner = "";
  let summaryDays = 0;
  let capturedUpdate = null;

  TaskService.getSummary = async (ownerEmail, days) => {
    summaryOwner = ownerEmail;
    summaryDays = days;
    return {
      total: 4,
      open: 3,
      active: 3,
      inProgress: 0,
      completed: 1,
      completedThisWeek: 1,
      completionRate: 25,
      overdue: 1,
      upcoming: 2,
      upcomingTotal: 2,
      highPriorityOpen: 1,
      windowDays: days,
      priorityTasks: [],
      generatedAt: new Date().toISOString(),
    };
  };
  TaskService.update = async (id, updateData, ownerEmail) => {
    capturedUpdate = { id, updateData, ownerEmail };
    return { _id: id, title: "Existing title", ...updateData };
  };

  t.after(() => {
    TaskService.getSummary = originalGetSummary;
    TaskService.update = originalUpdate;
  });

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.sessionUser = { email: "student@example.test", name: "Student" };
    next();
  });
  app.use("/api/tasks", taskRouter);
  const server = await listen(app);
  t.after(() => close(server));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}/api`;

  async function apiRequest(method, requestPath, body) {
    const response = await fetch(baseUrl + requestPath, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const payload = await response.json();
    if (!response.ok || payload.ok === false) throw new Error(payload.error || `HTTP ${response.status}`);
    return payload.data;
  }

  const ButlerApi = {
    get: (requestPath) => apiRequest("GET", requestPath),
    post: (requestPath, body) => apiRequest("POST", requestPath, body),
    put: (requestPath, body) => apiRequest("PUT", requestPath, body),
    patch: (requestPath, body) => apiRequest("PATCH", requestPath, body),
    del: (requestPath) => apiRequest("DELETE", requestPath),
  };
  const context = vm.createContext({
    window: { ButlerApi },
    ButlerApi,
    console,
  });
  const executorSource = fs.readFileSync(path.join(root, "src/public/js/tool-executor.js"), "utf8");
  vm.runInContext(executorSource, context);

  const summaryResult = JSON.parse(await context.window.ButlerToolExecutor.execute({
    id: "summary-call",
    type: "function",
    function: { name: "task_summary", arguments: JSON.stringify({ days: 14 }) },
  }));
  assert.equal(summaryResult.ok, true);
  assert.equal(summaryResult.data.summary.completionRate, 25);
  assert.equal(summaryOwner, "student@example.test");
  assert.equal(summaryDays, 14);

  const updateResult = JSON.parse(await context.window.ButlerToolExecutor.execute({
    id: "update-call",
    type: "function",
    function: { name: "task_update", arguments: JSON.stringify({ id: "task-1", priority: "high" }) },
  }));
  assert.equal(updateResult.ok, true);
  assert.deepEqual(capturedUpdate, {
    id: "task-1",
    updateData: { priority: "high" },
    ownerEmail: "student@example.test",
  });
});

test("mock mode generates a MongoDB-grounded task summary without model access", async (t) => {
  const previousMock = process.env.CHAT_MOCK_MODE;
  const originalGetSummary = TaskService.getSummary;
  const originalGetLatestSession = ChatSessionService.getLatestSession;

  process.env.CHAT_MOCK_MODE = "true";
  TaskService.getSummary = async () => ({
    total: 2,
    open: 1,
    active: 1,
    inProgress: 0,
    completed: 1,
    completedThisWeek: 1,
    completionRate: 50,
    overdue: 0,
    upcoming: 1,
    upcomingTotal: 1,
    highPriorityOpen: 1,
    windowDays: 7,
    priorityTasks: [],
  });
  ChatSessionService.getLatestSession = async () => null;

  t.after(() => {
    if (previousMock === undefined) delete process.env.CHAT_MOCK_MODE;
    else process.env.CHAT_MOCK_MODE = previousMock;
    TaskService.getSummary = originalGetSummary;
    ChatSessionService.getLatestSession = originalGetLatestSession;
  });

  const chunks = [];
  const response = {
    destroyed: false,
    writableEnded: false,
    status() { return this; },
    setHeader() {},
    flushHeaders() {},
    write(chunk) { chunks.push(String(chunk)); return true; },
    end() { this.writableEnded = true; },
  };

  await streamChat({
    ownerEmail: "student@example.test",
    messages: [{ role: "user", content: "请生成任务摘要和完成率" }],
    mockChunkDelayMs: 0,
  }, response);

  const rendered = chunks.join("").split("\n\n").map((frame) => {
    const data = frame.startsWith("data: ") ? frame.slice(6) : "";
    if (!data || data === "[DONE]") return "";
    const payload = JSON.parse(data);
    return payload.choices?.[0]?.delta?.content || "";
  }).join("");
  assert.match(rendered, /Task summary: 1\/2 completed \(50%\)/);
  assert.match(rendered, /Generated locally from your current MongoDB tasks/);
});
