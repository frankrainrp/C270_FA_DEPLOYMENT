// Owner: Kaiduo - DevOps Architecture and CI/CD Integration
import assert from "node:assert/strict";

const baseUrl = (process.env.BASE_URL || "http://127.0.0.1:3001").replace(/\/$/, "");
let cookie = "";
let createdTaskId = "";

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  if (cookie) headers.set("Cookie", cookie);

  const response = await fetch(`${baseUrl}${path}`, {
    redirect: "manual",
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type") || "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  return { response, body };
}

function expectStatus(actual, expected, label) {
  assert.equal(actual, expected, `${label}: expected HTTP ${expected}, received ${actual}`);
}

async function main() {
  console.log(`[smoke] Checking ${baseUrl}`);

  const live = await request("/api/live");
  expectStatus(live.response.status, 200, "liveness endpoint");
  assert.equal(live.body?.ok, true, "liveness response must be successful");
  assert.equal(live.body?.data?.status, "alive", "application process must be alive");

  const health = await request("/api/health");
  expectStatus(health.response.status, 200, "health endpoint");
  assert.equal(health.body?.ok, true, "health response must be successful");
  assert.equal(health.body?.data?.status, "ready", "application must be ready");
  assert.equal(health.body?.data?.database, "connected", "MongoDB must be connected");
  assert.equal(health.body?.data?.localDemoMode, true, "local demo mode must be enabled for CI");

  const login = await request("/api/auth/demo", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  expectStatus(login.response.status, 200, "local demo login");
  assert.equal(login.body?.ok, true, "local demo login must succeed");

  const setCookie = typeof login.response.headers.getSetCookie === "function"
    ? login.response.headers.getSetCookie()[0]
    : login.response.headers.get("set-cookie");
  assert.ok(setCookie, "local demo login must return a session cookie");
  cookie = setCookie.split(";", 1)[0];

  const me = await request("/api/auth/me");
  expectStatus(me.response.status, 200, "authenticated identity");
  assert.equal(me.body?.data?.user?.email, "demo@butler.local");

  for (const path of ["/chat", "/tasks", "/calendar", "/notes", "/search"]) {
    const page = await request(path, { redirect: "follow" });
    expectStatus(page.response.status, 200, `${path} page`);
  }

  const unique = `${Date.now()}-${process.pid}`;
  const create = await request("/api/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Idempotency-Key": `ci-smoke-${unique}`,
    },
    body: JSON.stringify({
      title: `CI smoke task ${unique}`,
      description: "Created automatically by scripts/smoke-check.mjs",
      priority: "medium",
      status: "active",
    }),
  });
  expectStatus(create.response.status, 201, "task creation");
  createdTaskId = create.body?.data?.task?._id;
  assert.ok(createdTaskId, "task creation must return an id");

  const tasks = await request("/api/tasks");
  expectStatus(tasks.response.status, 200, "task listing");
  assert.ok(
    tasks.body?.data?.tasks?.some((task) => task._id === createdTaskId),
    "created task must appear in the authenticated task list",
  );

  console.log("[smoke] Health, login, protected pages, MongoDB persistence, and task CRUD passed.");
}

try {
  await main();
} finally {
  if (createdTaskId && cookie) {
    const cleanup = await request(`/api/tasks/${createdTaskId}`, { method: "DELETE" });
    if (cleanup.response.status !== 200) {
      console.warn(`[smoke] Cleanup returned HTTP ${cleanup.response.status}.`);
    }
  }
}
