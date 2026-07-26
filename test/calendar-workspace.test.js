const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ejs = require("ejs");

const root = path.join(__dirname, "..");
const calendarView = path.join(root, "src/views/pages/calendar.ejs");
const calendarUi = path.join(root, "src/public/js/calendar-ui.js");

test("separates calendar navigation from event actions and keeps selected day", async () => {
  const html = await ejs.renderFile(calendarView, {
    events: [],
    calendarYear: 2026,
    calendarMonth: 6,
  });

  assert.match(html, /calendar-toolbar-navigation/);
  assert.match(html, /Previous/);
  assert.match(html, /July 2026/);
  assert.match(html, /Next/);
  assert.match(html, /calendar-toolbar-events/);
  assert.match(html, /New event/);
  assert.match(html, /Refresh events/);
  assert.match(html, /Selected day/);
  assert.doesNotMatch(html, /Study rhythm/);
});

test("month navigation refreshes its visible label and event count", () => {
  const source = fs.readFileSync(calendarUi, "utf8");

  assert.match(source, /monthLabel\.textContent = new Date\(year, month, 1\)/);
  assert.match(source, /eventCount\.textContent = String\(calendarState\.events\.length\)/);
  assert.match(source, /data-calendar-new-event[\s\S]*?ev\.stopPropagation\(\)/);
});
