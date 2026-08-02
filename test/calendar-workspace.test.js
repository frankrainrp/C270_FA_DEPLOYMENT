// Owner: Chong Khen - Trivy Security and Quality Testing
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const ejs = require("ejs");

const root = path.join(__dirname, "..");
const calendarView = path.join(root, "src/views/pages/calendar.ejs");
const calendarUi = path.join(root, "src/public/js/calendar-ui.js");
const calendarStyles = path.join(root, "src/public/css/style.css");
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

test("renders today and the selected calendar date as separate states", async () => {
  const html = await ejs.renderFile(calendarView, {
    events: [],
    calendarYear: 2030,
    calendarMonth: 0,
    calendarSelectedDate: "2030-01-12",
  });
  const selectedCell = html.match(/<button(?=[^>]*data-day="12")[\s\S]*?>/)?.[0] || "";

  assert.match(selectedCell, /class="[^"]*\bis-selected\b/);
  assert.match(selectedCell, /data-iso="2030-01-12"/);
  assert.match(selectedCell, /aria-pressed="true"/);
  assert.doesNotMatch(selectedCell, /\btoday\b/);
});

test("calendar clicks move selection while today keeps a distinct colour", () => {
  const source = fs.readFileSync(calendarUi, "utf8");
  const styles = fs.readFileSync(calendarStyles, "utf8");
  const sidebar = fs.readFileSync(sidebarView, "utf8");
  const routes = fs.readFileSync(pagesRouter, "utf8");

  assert.match(source, /prev\.classList\.remove\("is-selected"\)/);
  assert.match(source, /dayElement\.classList\.add\("is-selected"\)/);
  assert.match(source, /syncMiniCalendar\(isoDate\)/);
  assert.match(source, /mini-calendar-day\[data-date\][\s\S]*?selectDay\(selectedButton\)/);
  assert.match(styles, /\.calendar-day\.today\s*\{[\s\S]*?var\(--color-primary\)/);
  assert.match(styles, /\.calendar-day\.is-selected\s*\{[\s\S]*?var\(--color-info\)/);
  assert.match(styles, /\.mini-calendar-day\.today\s*\{[\s\S]*?var\(--color-primary\)/);
  assert.match(styles, /\.mini-calendar-day\.selected\s*\{[\s\S]*?var\(--color-info\)/);
  assert.match(sidebar, /day\.today[\s\S]*?day\.selected/);
  assert.match(routes, /req\.query\.date\.match[\s\S]*?calendarSelectedDate/);
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
  assert.match(client, /ButlerApi\.createOperation\("event"\)/);
  assert.match(client, /createEvent\("\/calendar",\s*\{/);
  assert.match(client, /date:\s*dateInput\.value/);
  assert.doesNotMatch(client, /createTask\("\/tasks"/);
});
