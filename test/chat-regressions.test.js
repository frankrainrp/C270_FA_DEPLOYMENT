const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const test = require("node:test");

const { serializeForInlineScript } = require("../src/lib/safeJson");
const AuthService = require("../src/services/AuthService");

const root = path.join(__dirname, "..");
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), "utf8");

test("serializes persisted chat state without closing the script element", () => {
  const value = { message: "</script><script>alert('xss')</script>", separator: "\u2028" };
  const serialized = serializeForInlineScript(value);

  assert.equal(serialized.includes("</script>"), false);
  assert.equal(serialized.includes("<script>"), false);
  assert.deepEqual(JSON.parse(serialized), value);
});

test("chat UI prevents concurrent sends and auto-runs read-only tools", () => {
  const source = read("src/public/js/chat-ui.js");

  assert.match(source, /if \(ButlerState\.get\(\)\.isStreaming\) return;/);
  assert.match(source, /function requiresConfirmation/);
  assert.match(source, /var writeCalls = toolCalls\.filter\(requiresConfirmation\)/);
  assert.match(source, /role", "alert"/);
});

test("chat CSS retains responsive, confirmation, focus, and reduced-motion rules", () => {
  const css = read("src/public/css/style.css");

  assert.match(css, /\.tool-confirm-card\s*\{/);
  assert.match(css, /@media \(max-width: 920px\)/);
  assert.match(css, /@media \(max-width: 560px\)/);
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(css, /:focus-visible/);
  assert.match(css, /\[hidden\]\s*\{\s*display: none !important;/);
  assert.doesNotMatch(css, /\.bubble-wrap:hover \.msg-too\s*$/m);
  assert.equal((css.match(/\{/g) || []).length, (css.match(/\}/g) || []).length);
});

test("chat bootstrap uses the server-generated safe state payload", () => {
  const template = read("src/views/pages/chat.ejs");
  const pages = read("src/routes/pages.js");

  assert.match(template, /window\.__BUTLER_INIT__ = <%- initialChatStateJson %>/);
  assert.doesNotMatch(template, /<%- JSON\.stringify\(initialMessagesList\) %>/);
  assert.match(pages, /serializeForInlineScript/);
});

test("create tools carry idempotency keys into the API layer", () => {
  const executor = read("src/public/js/tool-executor.js");
  const taskModel = read("src/models/Task.js");

  assert.match(executor, /Idempotency-Key/);
  assert.match(taskModel, /ownerEmail: 1, idempotencyKey: 1/);
});

test("production refuses the default JWT secret", () => {
  const previousMode = process.env.NODE_ENV;
  const previousSecret = process.env.JWT_SECRET;
  process.env.NODE_ENV = "production";
  process.env.JWT_SECRET = "change-me";
  try {
    assert.throws(
      () => AuthService.assertProductionConfig(),
      /JWT_SECRET must be set/
    );
  } finally {
    if (previousMode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = previousMode;
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  }
});
