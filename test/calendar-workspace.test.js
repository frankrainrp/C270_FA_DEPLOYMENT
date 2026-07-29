const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ejs = require("ejs");

const root = path.join(__dirname, "..");
const calendarView = path.join(root, "src/views/pages/calendar.ejs");
const calendarUi = path.join(root, "src/public/js/calendar-ui.js");
const sidebarView = path.join(root, "src/views/partials/sidebar.ejs");
const pagesRouter = path.join(root, "src/routes/pages.js");

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

test("calendar new-event links have a fallback route and do not navigate when enhanced", () => {
  const sidebar = fs.readFileSync(sidebarView, "utf8");
  const client = fs.readFileSync(calendarUi, "utf8");
  const routes = fs.readFileSync(pagesRouter, "utf8");

  assert.match(sidebar, /href="\/calendar\/new" data-action="new-event"/);
  assert.match(routes, /router\.get\("\/calendar\/new"[\s\S]*?create=event/);
  assert.match(client, /data-action="new-event"[\s\S]*?ev\.preventDefault\(\)[\s\S]*?openEventModal\(\)/);
  assert.match(client, /get\("create"\) === "event"[\s\S]*?openEventModal\(\)/);
});

test("new-event dialog creates a calendar event rather than a task", () => {
  const client = fs.readFileSync(calendarUi, "utf8");

  assert.match(client, /Create a calendar event/);
  assert.match(client, /ButlerApi\.post\("\/calendar",\s*\{/);
  assert.match(client, /date:\s*dateInput\.value/);
  assert.doesNotMatch(client, /ButlerApi\.post\("\/tasks"/);
});
