# Butler

Butler is a single-process Node.js study workspace with server-rendered EJS
pages, MongoDB persistence, and a streaming AI agent. The agent can read current
tasks, notes, and calendar events, then propose CRUD tool calls for the user to
approve before the browser executes them.

The current project is a single-user coursework application. It does not yet
implement login sessions, authorization, or per-user database isolation.

## Main capabilities

- Streaming DeepSeek chat through an OpenAI-compatible client
- Deterministic offline chat through `CHAT_MOCK_MODE`
- Multi-round agent tool calls for tasks, notes, and calendar events
- Explicit user confirmation before write operations
- MongoDB-backed chat history and workspace data
- In-memory document decoding for text files, PDF, and DOCX
- Search across persisted notes, tasks, and chat messages
- Responsive EJS interface with paper, glass, and dark themes
- Docker configurations for either MongoDB alone or the complete stack

## Runtime architecture

```text
Browser
  |-- GET page
  |     -> routes/pages.js
  |     -> services + MongoDB
  |     -> renderLayout.js
  |     -> layout.ejs + page partial
  |
  |-- POST /api/chat (SSE)
  |     -> ChatService
  |     -> DeepSeek or local mock stream
  |     -> optional tool calls
  |     -> browser confirmation
  |     -> REST API -> service -> MongoDB
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
|-- test/                     Node.js automated tests
`-- src/
    |-- app.js                Express bootstrap and MongoDB connection
    |-- lib/                  Stateless response, navigation, and UI helpers
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
- `renderLayout.js` supplies consistent locals to the shared EJS layout.

### `src/models/`

- `Task.js` stores task descriptions, due dates, priorities, and completion.
- `Note.js` stores Markdown note content, tags, pin state, and previews.
- `CalendarEvent.js` stores dated calendar entries.
- `ChatSession.js` stores user/assistant messages and decoded attachments.

### `src/routes/`

- `pages.js` loads persisted data and renders chat, search, task, note,
  calendar, preferences, and login pages.
- `api/chat.js` exposes the SSE chat endpoint and chat-session endpoints.
- `api/documents.js` accepts one multipart document and returns extracted text.
- `api/tasks.js`, `api/notes.js`, and `api/calendar.js` expose CRUD APIs.
- `api/health.js` provides the Docker and deployment liveness endpoint.

### `src/services/`

- `ChatService.js` validates history, injects context, streams model output,
  limits tool rounds, and persists completed messages.
- `ChatPrompt.js` builds the server-authoritative system prompt.
- `ChatToolDefinitions.js` defines the task, note, and calendar tools.
- `ChatSessionService.js` manages persisted conversations.
- `ContextService.js` builds a compact current-data snapshot for the model.
- `DocumentDecodeService.js` extracts safe text from supported documents.
- `TaskService.js`, `NoteService.js`, and `CalendarService.js` own database
  operations for their respective domains.
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
- `preferences.js` persists theme selection in local storage.

## Agent request flow

1. The browser records the user message and optional decoded attachments.
2. `chat-client.js` sends OpenAI-compatible history to `POST /api/chat`.
3. `ChatService` removes client system messages, clamps history size, loads a
   current MongoDB snapshot, and creates the authoritative system prompt.
4. DeepSeek returns SSE content and optional tool-call fragments.
5. The browser reconstructs complete tool calls and displays a confirmation
   card.
6. Approved calls go through `tool-executor.js` to the matching REST endpoint.
7. The REST route calls its service, which reads or writes MongoDB.
8. Tool results are appended as `role: "tool"` messages and sent back to the
   model for a natural-language confirmation.
9. The loop stops when no tool calls remain or after six tool rounds.
10. User and assistant messages are saved in the active chat session.

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
| `N8N_OTP_WEBHOOK_URL` | Production URL of the "send-otp" n8n workflow |
| `OTP_TTL_MINUTES` | How long an emailed code stays valid |
| `SESSION_TTL_DAYS` | How long a signed-in session lasts |
| `AUTH_REQUIRED` | When `true`, every page redirects signed-out visitors to `/auth/login` |

## Authentication

Login is email + one-time code, no password. `POST /api/auth/request-otp`
calls an external n8n workflow (webhook -> generate code -> upsert user in
an n8n data table -> email the code via SMTP). The code itself never
reaches the browser: `AuthService.js` stores it server-side in a
short-lived `PendingOtp` document and only returns `{ isNew, name }` to the
client. `POST /api/auth/verify-otp` checks the submitted code against that
document and, on a match, creates a `Session` document and sets an
httpOnly `butler_session` cookie. `authGuard.js` (`src/lib/authGuard.js`)
runs on every request, attaches the logged-in user to `res.locals`, and —
when `AUTH_REQUIRED=true` — redirects signed-out visitors to
`/auth/login`. Both `PendingOtp` and `Session` use MongoDB TTL indexes so
expired codes and sessions clean themselves up automatically.

## Validation

```powershell
npm run test:ci
docker compose -f docker-compose.db.yml config -q
docker compose config -q
```

`npm run test:ci` verifies required deployment files and runs the Node.js test
suite. The real DeepSeek path requires a valid API key, and container runtime
verification requires Docker Desktop to be running.
