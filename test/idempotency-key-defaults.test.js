const test = require("node:test");
const assert = require("node:assert/strict");

const Task = require("../src/models/Task");
const Note = require("../src/models/Note");
const CalendarEvent = require("../src/models/CalendarEvent");

const modelInputs = [
  [Task, { ownerEmail: "student@example.test", title: "Task" }],
  [Note, { ownerEmail: "student@example.test", title: "Note" }],
  [
    CalendarEvent,
    {
      ownerEmail: "student@example.test",
      title: "Event",
      date: new Date("2026-07-30T00:00:00.000Z"),
    },
  ],
];

test("ordinary creates receive distinct server-generated idempotency keys", () => {
  for (const [Model, input] of modelInputs) {
    const first = new Model(input);
    const second = new Model(input);

    assert.match(first.idempotencyKey, /^[0-9a-f-]{36}$/i);
    assert.match(second.idempotencyKey, /^[0-9a-f-]{36}$/i);
    assert.notEqual(first.idempotencyKey, second.idempotencyKey);
  }
});

test("caller-provided idempotency keys are preserved for retry deduplication", () => {
  for (const [Model, input] of modelInputs) {
    const document = new Model({ ...input, idempotencyKey: "request-123" });
    assert.equal(document.idempotencyKey, "request-123");
  }
});
