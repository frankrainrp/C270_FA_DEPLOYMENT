# Butler

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
- Per-account data isolation: tasks, notes, calendar events, and chat history
  are all scoped to the logged-in account
- Streaming DeepSeek chat through an OpenAI-compatible client
- Deterministic offline chat through `CHAT_MOCK_MODE`
- Multi-round agent tool calls for tasks, notes, and calendar events
- Explicit user confirmation before write operations
- MongoDB-backed chat history and workspace data
- In-memory document decoding for text files, PDF, and DOCX
- Search across the current account's persisted notes, tasks, and chat messages
- Responsive EJS interface with paper, glass, and dark themes
- Simulated billing/credits and profile settings (Task 6)
- Docker configurations for either MongoDB alone or the complete stack

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
  |-- POST /api/auth/request-otp | verify-otp
  |     -> AuthService -> n8n webhook (sends code) -> MongoDB (OtpChallenge/User)
  |     -> session cookie (JWT) issued on success
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
|-- .env.example              Documented environment-variable template
|-- .dockerignore             Docker build-context exclusions
|-- Dockerfile                Production Node.js image
|-- docker-compose.yml        Node.js application and MongoDB
|-- docker-compose.db.yml     MongoDB-only local development stack
|-- ci-validate.mjs           Required-file validation
|-- package.json              Dependencies and npm scripts
|-- scripts/
|   `-- migrate-owner-email.js  One-time: assigns pre-login data to an account
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

### `src/middleware/`

- `requireAuth.js` reads the `butler_session` cookie via `AuthService`.
  `requireAuthPage` redirects unauthenticated page requests to
  `/auth/login?next=...`; `requireAuthApi` returns a 401 JSON response for
  unauthenticated API requests. Both attach `req.sessionUser`.

### `src/models/`

- `Task.js`, `Note.js`, `CalendarEvent.js`, `ChatSession.js` each carry an
  `ownerEmail` field and store their respective domain data, scoped per
  account.
- `User.js` stores the verified login identity (email, name, last login).
- `OtpChallenge.js` holds a pending emailed code server-side (with expiry
  and attempt tracking) until it's verified or expires.
- `UserProfile.js` is the still-shared (not yet per-account) Task 6 demo
  profile: avatar, plan, and simulated credits.

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

- `AuthService.js` calls the n8n OTP webhook, stores/verifies the code
  server-side, and issues the session JWT.
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
- `UserProfileService.js` manages the shared Task 6 demo profile/billing.
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
5. The browser reconstructs complete tool calls and displays a confirmation
   card.
6. Approved calls go through `tool-executor.js` to the matching REST endpoint,
   which is only reachable while logged in.
7. The REST route calls its service, which reads or writes MongoDB filtered
   by `ownerEmail`.
8. Tool results are appended as `role: "tool"` messages and sent back to the
   model for a natural-language confirmation.
9. The loop stops when no tool calls remain or after six tool rounds.
10. User and assistant messages are saved in the active chat session, owned
    by the current account.

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
3. The code is stored server-side (`OtpChallenge`, with an expiry and a
   max-attempts counter) and the browser is told only whether the account is
   new.
4. The user submits the code; `AuthService.verifyOtp` checks it against the
   stored challenge, upserts the `User` record, and issues a signed JWT
   session cookie (`butler_session`).
5. Every subsequent request to tasks/notes/calendar/chat/search is gated by
   `middleware/requireAuth.js`, which decodes that cookie and filters every
   database read/write by the resulting email (`ownerEmail`).
6. Data created before this system existed has no owner; run
   `npm run migrate:owner -- you@example.com` once to assign it to a real
   account (see Validation below).

## Local setup

```powershell
Copy-Item .env.example .env
npm install
docker compose -f docker-compose.db.yml up -d
npm start
```

Open `http://localhost:3000`.

The database-only Compose file uses the credentials documented in
`.env.example`. Ensure the local `MONGO_URI` uses the same username, password,
database, and `authSource=admin` values.

## Complete Docker stack

```powershell
docker compose up -d --build
docker compose ps
```

MongoDB data is stored in the named `butler_data` volume. Do not use
`docker compose down -v` unless deleting the local database is intentional.

## Important environment variables

| Variable | Purpose |
|---|---|
| `PORT` | Express HTTP port |
| `MONGO_URI` | MongoDB connection used by local Node.js |
| `MONGO_CONNECT_TIMEOUT_MS` | Database connection timeout |
| `DEEPSEEK_API_KEY` | Enables the real model path |
| `DEEPSEEK_BASE_URL` | OpenAI-compatible DeepSeek endpoint |
| `CHAT_MOCK_MODE` | Forces deterministic offline chat |
| `DOCUMENT_MAX_MB` | Maximum uploaded file size |
| `DOCUMENT_TEXT_LIMIT` | Maximum extracted characters per document |
| `JWT_SECRET` | Signs the login session cookie — change for any real deployment |
| `N8N_OTP_WEBHOOK_URL` | n8n workflow that emails the login code |
| `OTP_EXPIRY_MINUTES` | How long an emailed code stays valid |
| `OTP_MAX_ATTEMPTS` | Wrong-attempt limit before a code is invalidated |

## Validation

```powershell
npm run test:ci
docker compose -f docker-compose.db.yml config -q
docker compose config -q
```

`npm run test:ci` verifies required deployment files and runs the Node.js test
suite. The real DeepSeek path requires a valid API key, and container runtime
verification requires Docker Desktop to be running.

```powershell
npm run migrate:owner -- you@example.com
```

One-time migration: assigns every task/note/calendar event/chat session that
predates the login system to the given (already logged-in) account. Safe to
re-run — it only touches records with no owner yet.

---

*Built for DevOps CA2 — Republic Polytechnic.*
