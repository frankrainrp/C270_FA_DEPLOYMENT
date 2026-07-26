const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const StudyBriefingService = require("../src/services/StudyBriefingService");
const TaskService = require("../src/services/TaskService");
const NoteService = require("../src/services/NoteService");
const CalendarService = require("../src/services/CalendarService");
const { CHAT_TOOLS } = require("../src/services/ChatToolDefinitions");
const { buildSystemPrompt } = require("../src/services/ChatPrompt");

const root = path.join(__dirname, "..");

test("builds a cross-module briefing from tasks, notes, and calendar events", () => {
  const now = new Date("2026-07-26T09:00:00.000Z");
  const briefing = StudyBriefingService.build({
    taskSummary: {
      total: 4,
      open: 3,
      completed: 1,
      completionRate: 25,
      overdue: 1,
      priorityTasks: [{
        id: "task-1",
        title: "Finish DevOps report",
        reason: "overdue",
        dueDate: "2026-07-25T00:00:00.000Z",
      }],
    },
    notes: [
      { _id: "note-1", title: "Kubernetes review", pinned: true, updatedAt: now },
      { _id: "note-2", title: "Old note", pinned: false, updatedAt: "2026-01-01" },
    ],
    events: [
      { _id: "event-1", title: "Demo", date: "2026-07-28T10:00:00.000Z", tag: "assessment" },
      { _id: "event-old", title: "Past", date: "2026-07-20T10:00:00.000Z" },
    ],
  }, now, 7);

  assert.equal(briefing.taskSummary.completionRate, 25);
  assert.equal(briefing.noteHighlights[0].title, "Kubernetes review");
  assert.equal(briefing.upcomingEvents.length, 1);
  assert.equal(briefing.upcomingEvents[0].title, "Demo");
  assert.deepEqual(
    briefing.focusItems.map((item) => item.type),
    ["task", "event", "note"]
  );
  assert.match(StudyBriefingService.format(briefing), /Study briefing/);
});

test("registers and executes study_briefing as a read-only Agent capability", async () => {
  const tool = CHAT_TOOLS.find((item) => item.function.name === "study_briefing");
  assert.ok(tool);
  assert.match(tool.function.description, /tasks, recent or pinned notes, and upcoming calendar events/i);

  const prompt = buildSystemPrompt({ userName: "Student" });
  assert.match(prompt, /ALWAYS call study_briefing first/);

  const calls = [];
  const ButlerApi = {
    get(requestPath) {
      calls.push(requestPath);
      return Promise.resolve({ briefing: { headline: "Ready" } });
    },
  };
  const context = vm.createContext({
    window: { ButlerApi },
    ButlerApi,
    console,
  });
  const executorSource = fs.readFileSync(
    path.join(root, "src/public/js/tool-executor.js"),
    "utf8"
  );
  vm.runInContext(executorSource, context);

  const result = JSON.parse(await context.window.ButlerToolExecutor.execute({
    id: "briefing-call",
    type: "function",
    function: { name: "study_briefing", arguments: JSON.stringify({ days: 14 }) },
  }));

  assert.equal(result.ok, true);
  assert.deepEqual(calls, ["/briefing?days=14"]);
});

test("loads every briefing module with the same signed-in account scope", async (t) => {
  const originals = {
    summary: TaskService.getSummary,
    notes: NoteService.findAll,
    events: CalendarService.findAll,
  };
  const owners = [];

  TaskService.getSummary = async (ownerEmail, days) => {
    owners.push(["tasks", ownerEmail, days]);
    return { total: 0, open: 0, completed: 0, completionRate: 0, overdue: 0, priorityTasks: [] };
  };
  NoteService.findAll = async (filter, ownerEmail) => {
    owners.push(["notes", ownerEmail, filter]);
    return [];
  };
  CalendarService.findAll = async (ownerEmail) => {
    owners.push(["events", ownerEmail]);
    return [];
  };

  t.after(() => {
    TaskService.getSummary = originals.summary;
    NoteService.findAll = originals.notes;
    CalendarService.findAll = originals.events;
  });

  await StudyBriefingService.getBriefing("student@example.test", 10);
  assert.deepEqual(owners, [
    ["tasks", "student@example.test", 10],
    ["notes", "student@example.test", "all"],
    ["events", "student@example.test"],
  ]);
});
