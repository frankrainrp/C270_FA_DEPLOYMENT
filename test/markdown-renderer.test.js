const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");
const vm = require("node:vm");

const source = fs.readFileSync(
  path.join(__dirname, "../src/public/js/markdown-renderer.js"),
  "utf8"
);

function renderer() {
  const context = vm.createContext({ window: {} });
  vm.runInContext(source, context);
  return context.window.ButlerMarkdown;
}

test("renders common note Markdown into structured HTML", () => {
  const markdown = [
    "# CPU",
    "",
    "The **central processing unit** runs `instructions`.",
    "",
    "- Fetch",
    "- [x] Decode",
    "",
    "> Review before the exam.",
  ].join("\n");
  const html = renderer().render(markdown);

  assert.match(html, /<h1>CPU<\/h1>/);
  assert.match(html, /<strong>central processing unit<\/strong>/);
  assert.match(html, /<code>instructions<\/code>/);
  assert.match(html, /<ul>[\s\S]*<li>Fetch<\/li>/);
  assert.match(html, /type="checkbox" disabled checked/);
  assert.match(html, /<blockquote>/);
});

test("escapes raw HTML and only turns http(s) Markdown links into anchors", () => {
  const html = renderer().render([
    "<script>alert('xss')</script>",
    "",
    "[safe](https://example.com)",
    "[unsafe](javascript:alert(1))",
  ].join("\n"));

  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
  assert.match(html, /href="https:\/\/example\.com"/);
  assert.doesNotMatch(html, /href="javascript:/);
});

test("renders agent-style Markdown tables with safe inline formatting", () => {
  const html = renderer().render([
    "Here's your current task snapshot:",
    "",
    "| Metric | Value |",
    "|:---|---:|",
    "| **Total tasks** | 3 |",
    "| Unsafe | <img src=x onerror=alert(1)> |",
    "",
    "Top priorities: `Revision`",
  ].join("\n"));

  assert.match(html, /<div class="markdown-table-wrap"><table>/);
  assert.match(html, /<th style="text-align:left">Metric<\/th>/);
  assert.match(html, /<th style="text-align:right">Value<\/th>/);
  assert.match(html, /<td style="text-align:left"><strong>Total tasks<\/strong><\/td>/);
  assert.match(html, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.doesNotMatch(html, /<img/);
  assert.match(html, /<code>Revision<\/code>/);
});

test("notes UI targets the editor preview instead of note-list search snippets", () => {
  const notesUi = fs.readFileSync(
    path.join(__dirname, "../src/public/js/notes-ui.js"),
    "utf8"
  );
  assert.match(
    notesUi,
    /querySelector\("\.note-markdown-preview\[data-note-preview\]"\)/
  );
});
