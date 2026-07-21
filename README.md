# Butler

[![CI and Container Delivery](https://github.com/HeinThuNyiNyi/butler-devops-CA2/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/HeinThuNyiNyi/butler-devops-CA2/actions/workflows/ci-cd.yml)

Butler is a single-process Node.js study workspace with server-rendered EJS
pages, MongoDB persistence, and a streaming AI agent. The agent can read current
tasks, notes, and calendar events, then propose CRUD tool calls for the user to
approve before the browser executes them.

The application supports real multi-user accounts: sign-in is via emailed
one-time codes (OTP, delivered through an n8n workflow), and every task,
note, calendar event, and chat session is scoped to the signed-in account —
one user's data is never visible to another.

## Main capabilities

- Email OTP login/signup (n8n sends the code, Butler verifies it and issues
  a session)
- One-click localhost demo login when the complete Docker stack is used
- Per-account data isolation: tasks, notes, calendar events, and chat history
  are all scoped to the logged-in account
- Streaming DeepSeek chat through an OpenAI-compatible client
- Deterministic offline chat through `CHAT_MOCK_MODE`
- Multi-round agent tool calls for tasks, notes, and calendar events
- Explicit user confirmation before write operations
- MongoDB-backed chat history and workspace data
- In-memory document decoding for text files, PDF, and DOCX
- Search across the current account's persisted notes, tasks, and chat messages
- Account-scoped achievement badges derived from real workspace activity
- Direct note links, pinned-note filtering, and in-editor pin controls
- Responsive EJS interface with paper, glass, and dark themes
- Simulated billing/credits and profile settings (Task 6)
- Docker configurations for either MongoDB alone or the complete stack

## Quick start

The complete local stack is the recommended way to run Butler for development
or an on-device demonstration:

```powershell
git clone https://github.com/HeinThuNyiNyi/butler-devops-CA2.git
Set-Location butler-devops-CA2
Copy-Item .env.example .env
docker compose up -d --build --wait
docker compose ps
Invoke-RestMethod http://localhost:3001/api/health
```

Open `http://localhost:3001`, select **Enter local demo**, and use the Chat,
Tasks, Calendar, Notes, Search, and Achievements pages. A DeepSeek key is not
required for the workspace; without one, Chat uses deterministic mock mode.
Add a key to `.env` and keep `CHAT_MOCK_MODE=false` to demonstrate live agent
tool calls.

Stop the stack without deleting the MongoDB volume:

```powershell
docker compose down
```

## Runtime architecture

```text
Browser
  |-- GET page (tasks/notes/calendar/chat/search)
  |     -> middleware/requireAuth.js (redirects to /auth/login if not signed in)
  |     -> routes/pages.js
  |     -> services + MongoDB, filtered by ownerEmail
  |     -> renderLayout.js
  |     -> layout.ejs + page partial
  |
  |-- POST /api/auth/request-otp | verify-otp | demo
  |     -> AuthService -> optional n8n webhook -> MongoDB (PendingOtp/Session)
  |     -> opaque server-side session cookie issued on success
  |
  |-- POST /api/chat (SSE)
  |     -> middleware/requireAuth.js
  |     -> ChatService (scoped to req.sessionUser.email)
  |     -> DeepSeek or local mock stream
  |     -> optional tool calls
  |     -> browser confirmation
  |     -> REST API -> service -> MongoDB (scoped to ownerEmail)
  |
  `-- POST /api/documents/decode (multipart)
        -> multer memory storage
        -> DocumentDecodeService
        -> extracted text attached to the next user message
```

## Project structure

```text
.
|-- .github/workflows/
|   `-- ci-cd.yml             Test, Docker smoke test, and GHCR delivery
|-- .env.example              Documented environment-variable template
|-- .dockerignore             Docker build-context exclusions
|-- Dockerfile                Local-demo Node.js image
|-- docker-compose.yml        Node.js application and MongoDB
|-- docker-compose.db.yml     MongoDB-only local development stack
|-- ci-validate.mjs           Required-file validation
|-- package.json              Dependencies and npm scripts
|-- scripts/
|   |-- migrate-owner-email.js  One-time: assigns pre-login data to an account
|   `-- smoke-check.mjs         Health, auth, page, and task CRUD smoke test
|-- test/                     Node.js automated tests
`-- src/
    |-- app.js                Express bootstrap and MongoDB connection
    |-- lib/                  Stateless response, navigation, and UI helpers
    |-- middleware/
    |   `-- requireAuth.js    Login gate (page redirect + API 401) shared by
    |                         tasks/notes/calendar/chat/search
    |-- models/               Mongoose document schemas
    |-- routes/
    |   |-- index.js          Central route registration
    |   |-- pages.js          Server-rendered HTML routes
    |   `-- api/              JSON, multipart, and SSE endpoints
    |-- services/             Business logic and external integrations
    |-- views/                EJS layouts, partials, and page templates
    `-- public/
        |-- css/              Shared themes and responsive styling
        `-- js/               Browser state, API, agent, and page controllers
```

### `src/lib/`

- `apiResponse.js` creates the shared `{ ok, data }` and `{ ok, error }`
  response envelopes.
- `nav.js` defines navigation items and the EJS page whitelist.
- `panelHelpers.js` contains date, note-preview, and calendar-grid helpers.
- `renderLayout.js` supplies consistent locals to the shared EJS layout,
  including the logged-in user's name/email and login state.
- `cookies.js` reads and writes the opaque `butler_session` cookie.
- `authGuard.js` resolves the MongoDB Session before routes run.
- `db.js` owns the application's Mongoose connection.

### `src/middleware/`

- `requireAuth.js` resolves the `butler_session` token via `AuthService`.
  `requireAuthPage` redirects unauthenticated page requests to
  `/auth/login?next=...`; `requireAuthApi` returns a 401 JSON response for
  unauthenticated API requests. Both attach `req.sessionUser`.

### `src/models/`

- `Task.js`, `Note.js`, `CalendarEvent.js`, `ChatSession.js` each carry an
  `ownerEmail` field and store their respective domain data, scoped per
  account.
- `PendingOtp.js` holds a pending emailed code server-side, including expiry
  and wrong-attempt tracking.
- `Session.js` stores opaque login tokens and their server-side identity with
  a MongoDB TTL expiry. The browser cookie contains only the random token.
- `User.js` and `OtpChallenge.js` are retained for data compatibility with the
  earlier JWT implementation but are not used by the active login flow.
- `UserProfile.js` stores each account's avatar, plan, and simulated credits.

### `src/routes/`

- `pages.js` loads persisted data and renders chat, search, task, note,
  calendar, preferences, settings, billing, pricing, and login pages.
  Tasks/notes/calendar/chat/search require login via `requireAuthPage`.
- `api/auth.js` exposes `request-otp`, `verify-otp`, and `me`.
- `api/chat.js` exposes the SSE chat endpoint and chat-session endpoints
  (requires login).
- `api/documents.js` accepts one multipart document and returns extracted text.
- `api/tasks.js`, `api/notes.js`, and `api/calendar.js` expose CRUD APIs,
  each requiring login and scoped to the caller's account.
- `api/profile.js` and `api/billing.js` back the Task 6 settings/billing UI.
- `api/health.js` provides the Docker and deployment liveness endpoint.

### `src/services/`

- `AuthService.js` calls the n8n OTP webhook, stores/verifies `PendingOtp`,
  and creates or destroys server-side MongoDB `Session` records.
- `ChatService.js` validates history, injects an account-scoped context
  snapshot, streams model output, limits tool rounds, and persists
  completed messages against the caller's `ownerEmail`.
- `ChatPrompt.js` builds the server-authoritative system prompt.
- `ChatToolDefinitions.js` defines the task, note, and calendar tools.
- `ChatSessionService.js` manages persisted conversations, scoped by
  `ownerEmail`.
- `ContextService.js` builds a compact current-data snapshot for the model,
  scoped to the current account.
- `DocumentDecodeService.js` extracts safe text from supported documents.
- `TaskService.js`, `NoteService.js`, and `CalendarService.js` own database
  operations for their respective domains, scoped by `ownerEmail`.
- `UserProfileService.js` manages account-scoped profile and billing data.
- `AchievementService.js` derives per-account badge progress from persisted
  tasks, notes, calendar events, and chat messages.
- `RailService.js` builds real sidebar data from persisted records.

### `src/public/js/`

- `api.js` is the browser JSON API client.
- `app-state.js` holds the active chat session and message history.
- `chat-client.js` parses SSE content and reconstructs streamed tool calls.
- `chat-ui.js` controls composing, attachments, streaming, confirmations, and
  the multi-round agent loop.
- `tool-executor.js` maps approved tool calls to REST endpoints.
- `tasks-ui.js`, `notes-ui.js`, and `calendar-ui.js` control their pages.
- `shell.js` controls global navigation, search, learning tools, and menus.
- `auth-login.js` drives the two-step email OTP login/signup flow and
  honors a `?next=` redirect back to whatever page requested login.
- `preferences.js` persists theme selection in local storage.

## Agent request flow

1. The browser records the user message and optional decoded attachments.
2. `chat-client.js` sends OpenAI-compatible history to `POST /api/chat`.
3. `ChatService` removes client system messages, clamps history size, loads a
   current MongoDB snapshot scoped to the caller's account, and creates the
   authoritative system prompt.
4. DeepSeek returns SSE content and optional tool-call fragments.
5. The browser reconstructs complete tool calls. Read-only tools run directly;
   write tools display a confirmation card.
6. Approved writes go through `tool-executor.js` with an idempotency key to the
   matching authenticated REST endpoint.
7. The REST route calls its service, which reads or writes MongoDB filtered
   by `ownerEmail`.
8. Tool results are appended as `role: "tool"` messages and sent back to the
   model for a natural-language confirmation.
9. The loop stops when no tool calls remain or after six tool rounds.
10. User and assistant messages are saved in the active chat session, owned
    by the current account. Stored history and attachment text are bounded so
    a single MongoDB session document cannot grow indefinitely.

## Document decoding flow

1. The user selects up to three documents in the chat composer.
2. Each file is posted to `/api/documents/decode` using `multipart/form-data`.
3. Multer holds the upload in memory; raw files are not written to disk.
4. Plain text is decoded as UTF-8 or BOM-detected UTF-16. `pdf-parse` extracts
   PDF text, and Mammoth extracts DOCX text.
5. Empty or unsupported files return a structured error.
6. Extracted text is length-limited and attached to the user message.
7. `ChatService` marks the document boundaries and treats its content as
   untrusted data in the model prompt.

Image-only or scanned PDFs require a future OCR fallback. Version 1 extracts
embedded text and does not claim optical character recognition of images.

## Login and per-account data

1. The user enters their email (and name, if new) on `/auth/login`.
2. `AuthService.requestOtp` calls the n8n webhook, which generates a code,
   emails it via SMTP, and returns it in the response. Only Butler's backend
   ever sees this response — the code is never sent to the browser.
3. The code is stored server-side (`PendingOtp`, with an expiry and a
   max-attempts counter) and the browser is told only whether the account is
   new.
4. The user submits the code; `AuthService.verifyOtp` checks it against the
   stored challenge and issues an opaque `butler_session` cookie. The token's
   identity and expiry are stored in MongoDB rather than inside the cookie.
5. Every subsequent request to tasks/notes/calendar/chat/search is gated by
   `middleware/requireAuth.js`, which resolves that cookie and filters every
   database read/write by the resulting email (`ownerEmail`).
6. When `LOCAL_DEMO_MODE=true`, `/auth/login` also offers a localhost demo
   entry that creates the same kind of MongoDB-backed session without email.
7. Data created before this system existed has no owner; run
   `npm run migrate:owner -- you@example.com` once to assign it to a real
   account (see Validation below).

## Local Docker usage tutorial

### 1. Prerequisites

Install Docker Desktop and make sure its Linux container engine is running.
Git and Node.js are only required when developing outside the complete Docker
stack. The default demo URL is `http://localhost:3001` because port 3000 is
commonly used by other local applications.

Verify Docker before continuing:

```powershell
docker --version
docker compose version
docker info
```

### 2. Create the local environment file

From the repository root, copy the documented template:

```powershell
Copy-Item .env.example .env
```

For a full AI-agent demonstration, open `.env` and set:

```dotenv
DEEPSEEK_API_KEY=your-real-api-key
CHAT_MOCK_MODE=false
```

Keep `LOCAL_DEMO_MODE=true` for the one-click local account. The `.env` file is
ignored by both Git and the Docker build context, so API keys are not committed
or copied into the image. Without a DeepSeek key, Butler uses deterministic mock
chat; the rest of the workspace works, but mock chat does not issue tool calls.

### 3. Build and start the complete stack

```powershell
docker compose up -d --build --wait
docker compose ps
```

Both `butler-app` and `mongo` should report `healthy`. Confirm application,
database, login, and chat readiness with:

```powershell
Invoke-RestMethod http://localhost:3001/api/health
```

Expected fields include `status: ready`, `database: connected`, and either
`chatMode: live` or `chatMode: mock`.

### 4. Sign in to the local demo

1. Open `http://localhost:3001`.
2. Select **Enter local demo** on the login page.
3. Butler creates an opaque server-side session for `demo@butler.local`.
4. All tasks, notes, events, and chat history are stored in the local MongoDB
   volume and scoped to that demo account.

To demonstrate the real email flow instead, configure `N8N_OTP_WEBHOOK_URL`,
enter an email address, and use the verification code delivered by the workflow.

### 5. Demonstrate the Agent

The following sequence shows the complete read/approval/write loop:

1. In Chat, send: `List my current tasks and summarize them briefly.`
2. Butler automatically runs the read-only `task_list` tool.
3. Send: `Create a high priority task titled Finish the Docker demo tomorrow.`
4. Review the proposed title, date, and priority in the confirmation card.
5. Choose **Accept** to write it to MongoDB, or **Decline** to reject it.
6. Open Tasks to confirm accepted changes appear in the workspace.

Read-only tools run automatically. Create, update, toggle, pin, and delete tools
always require confirmation.

### 6. Explore the remaining demo

- **Tasks:** create, filter, complete, and delete account-scoped tasks.
- **Calendar:** manage dated events and view task deadlines.
- **Notes:** create Markdown notes, tags, and pinned notes.
- **Chat:** attach up to three text, PDF, or DOCX files for extraction.
- **Search:** search the signed-in account's persisted workspace data.
- **Achievements:** view progress derived from real stored activity.

### 7. Logs, restart, and shutdown

```powershell
# Follow application logs
docker compose logs -f butler-app

# Restart only the Node.js application
docker compose restart butler-app

# Stop and remove containers while preserving MongoDB data
docker compose down

# Start the existing build again
docker compose up -d --wait
```

MongoDB data is stored in the named `butler_data` volume. Do not run
`docker compose down -v` unless permanently deleting all local demo data is
intentional.

### 8. Reset the demo database

Only use this when a clean demonstration is required and existing local data is
no longer needed:

```powershell
docker compose down -v
docker compose up -d --build --wait
```

The first command permanently removes the Compose MongoDB volume.

### 9. Troubleshooting

- **Port 3001 is already in use:** set `APP_PORT=3002` in `.env`, restart the
  stack, and open `http://localhost:3002`.
- **The application is unhealthy:** run `docker compose logs --tail 100
  butler-app` and verify that MongoDB is healthy.
- **Chat reports mock mode:** set a valid `DEEPSEEK_API_KEY`, ensure
  `CHAT_MOCK_MODE=false`, and recreate the app with `docker compose up -d
  --force-recreate butler-app`.
- **Demo login is unavailable:** confirm `LOCAL_DEMO_MODE=true` and recreate the
  app container.
- **A changed MongoDB password does not work:** initialization variables apply
  only to a new volume. Either restore the original local credentials or reset
  the demo database intentionally.

### 10. Database-only development

Run MongoDB in Docker while running Node.js directly on the host:

```powershell
Copy-Item .env.example .env
npm install
docker compose -f docker-compose.db.yml up -d --wait
npm start
```

Open `http://localhost:3000`. The database-only Compose file uses the
credentials documented in `.env.example`; `MONGO_URI` must use the same
username, password, database, and `authSource=admin` values. MongoDB is bound
only to `127.0.0.1` in this development mode.

## Important environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Express port for a direct `npm start` process |
| `APP_PORT` | Host port for the complete Docker demo; defaults to `3001` |
| `MONGO_URI` | MongoDB connection used by local Node.js |
| `MONGO_CONNECT_TIMEOUT_MS` | Database connection timeout |
| `DEEPSEEK_API_KEY` | Enables the real model path |
| `DEEPSEEK_BASE_URL` | OpenAI-compatible DeepSeek endpoint |
| `CHAT_MOCK_MODE` | Forces deterministic offline chat |
| `DOCUMENT_MAX_MB` | Maximum uploaded file size |
| `DOCUMENT_TEXT_LIMIT` | Maximum extracted characters per document |
| `N8N_OTP_WEBHOOK_URL` | n8n workflow that emails the login code |
| `OTP_TTL_MINUTES` | How long an emailed code stays valid |
| `OTP_MAX_ATTEMPTS` | Wrong-attempt limit before a code is invalidated |
| `SESSION_TTL_DAYS` | Lifetime of a server-side MongoDB session |
| `SESSION_COOKIE_NAME` | Name of the httpOnly opaque-token cookie |
| `AUTH_REQUIRED` | Enables the global login gate; defaults to `true` |
| `LOCAL_DEMO_MODE` | Enables one-click local demo login; never expose publicly |
| `LOCAL_DEMO_EMAIL` | Account identity used by the local demo |
| `LOCAL_DEMO_NAME` | Display name used by the local demo |

## Validation

```powershell
npm ci
npm run test:ci
npm run audit:ci
docker compose -f docker-compose.db.yml config -q
docker compose config -q
docker compose up -d --build --wait
npm run smoke
```

`npm run test:ci` verifies required deployment files and runs the Node.js test
suite. `npm run audit:ci` fails on high-severity production dependency findings.
`npm run smoke` expects the complete stack at `http://127.0.0.1:3001`; it checks
readiness, local authentication, protected pages, MongoDB persistence, and task
CRUD, then removes the task that it created. The real DeepSeek path requires a
valid API key, and container runtime verification requires Docker Desktop.

## CI/CD and container delivery

`.github/workflows/ci-cd.yml` runs on every branch push, pull requests to
`main`, and manual `workflow_dispatch` runs. It implements three dependent jobs:

1. **Test and security gate:** installs the lockfile, runs all validation and
   tests, blocks high-severity npm audit findings, and validates both Compose
   files.
2. **Docker smoke test:** builds an isolated application/MongoDB stack, waits
   for both services to become healthy, runs the authenticated smoke test,
   verifies that the application uses UID 1000 instead of root, and uploads
   Docker logs even when a step fails.
3. **Container delivery:** after a successful push to `main`, rebuilds the
   verified revision and publishes `latest` and immutable `sha-*` tags to
   `ghcr.io/heinthunyinyi/butler-devops-ca2`, including OCI provenance and an
   SBOM. Pull requests never receive package write permission.

GitHub automatically supplies the short-lived `GITHUB_TOKEN`; no personal
registry password belongs in repository secrets. The first GHCR package is
private by default. Change its package visibility in GitHub if an external
host must pull it anonymously.

To run the pipeline manually, open the repository's **Actions** tab, select
**CI and Container Delivery**, choose **Run workflow**, and wait for every job
to turn green. A successful workflow run and its Docker log artifact are the
primary CI/CD demonstration evidence.

Publishing an image is continuous delivery, not a public application runtime.
The local Compose stack remains the supported on-device deployment.

## Public deployment requirements

The current repository deliberately binds the complete demo to `127.0.0.1`.
That is safe for a local presentation but is not a public cloud deployment.
Before deploying the published image to Render, Railway, a VPS, or another
public platform, configure all of the following:

- a production MongoDB service and a secret `MONGO_URI`;
- `NODE_ENV=production`, `AUTH_REQUIRED=true`, and `LOCAL_DEMO_MODE=false`;
- a reachable n8n OTP webhook in `N8N_OTP_WEBHOOK_URL`;
- a secret `DEEPSEEK_API_KEY` if live agent calls are required;
- TLS/HTTPS, platform health checks against `/api/health`, persistent database
  backups, and a rollback target using an immutable `sha-*` image tag;
- a final deploy job or provider deploy hook that runs only after the test and
  Docker smoke jobs pass.

A public URL cannot be produced from repository code alone: it requires a
chosen hosting account, database, domain or platform URL, and deployment
credentials. Never expose the one-click local demo endpoint publicly.

## Final-assessment demonstration checklist

Prepare from a clean checkout of the actual `main` branch rather than an older
local branch or image:

```powershell
git checkout main
git pull --ff-only origin main
git status --short
git log -1 --oneline
Copy-Item .env.example .env
docker compose up -d --build --wait
docker compose ps
Invoke-RestMethod http://localhost:3001/api/health
npm run smoke
```

During the demonstration:

1. Show the green GitHub Actions run and explain build, test, security, smoke,
   and delivery gates.
2. Show both Compose services as healthy and explain application readiness,
   MongoDB readiness, the non-root user, loopback port binding, and the named
   data volume.
3. Enter the local demo, ask the agent to list tasks, then ask it to create a
   task. Explain why reads can run automatically while writes require explicit
   confirmation.
4. Accept the tool call, verify the task on the Tasks page, restart only the
   application container, and show that MongoDB retained the task.
5. Show one declined write operation, Docker logs, and the `/api/health`
   response so both success and safe failure behaviour are visible.
6. If a public deployment has been configured, repeat the health check and one
   user flow through its external URL.

Keep a mock-mode fallback ready for unreliable model connectivity. Mock mode
proves streaming UI behaviour but does not emit agent tool calls, so test the
live key and network before the presentation.

## Post-CA2 improvement evidence

Use application reliability improvements here rather than double-counting the
core Docker and pipeline requirements:

| Identified issue | Implemented correction | Evidence |
|---|---|---|
| API modules could be imported but never mounted, causing silent 404s | Central route registration plus an automated unmounted-route guard | `src/routes/index.js`, `ci-validate.mjs`, `npm run test:ci` |
| Concurrent chat sends and repeated create calls could duplicate work | Send locking, bounded tool rounds, confirmation, and idempotency keys | `src/public/js/chat-ui.js`, `src/public/js/tool-executor.js`, `test/chat-regressions.test.js` |
| Client-provided identity or context could cross account boundaries | Server-side sessions, route guards, and `ownerEmail`-scoped services | `src/lib/authGuard.js`, `src/middleware/requireAuth.js`, auth and chat regression tests |
| Document uploads needed bounded and testable extraction | Memory-only decoding, type checks, and text limits | `src/services/DocumentDecodeService.js`, `test/document-decode.test.js` |

For individual-contribution evidence, prepare the relevant commits and be able
to explain how each component connects to the full DevOps workflow:

```powershell
git log --oneline --author="Your Name"
git show --stat <commit>
```

```powershell
npm run migrate:owner -- you@example.com
```

One-time migration: assigns every task/note/calendar event/chat session that
predates the login system to the given (already logged-in) account. Safe to
re-run — it only touches records with no owner yet.

---

*Built for DevOps CA2 — Republic Polytechnic.*
