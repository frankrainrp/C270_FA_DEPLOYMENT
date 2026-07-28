# Butler

[![CI, Container Delivery, and Kubernetes Deployment](https://github.com/frankrainrp/C270_FA_DEPLOYMENT/actions/workflows/ci-cd.yml/badge.svg)](https://github.com/frankrainrp/C270_FA_DEPLOYMENT/actions/workflows/ci-cd.yml)

Butler is a single-process Node.js study workspace with server-rendered EJS
pages, MongoDB persistence, and a streaming AI agent. The agent can read current
tasks, notes, and calendar events, then propose CRUD tool calls for the user to
approve before the browser executes them.

The application supports real multi-user accounts: sign-in is via emailed
one-time codes (OTP, delivered through an n8n workflow), and every task,
note, calendar event, and chat session is scoped to the signed-in account —
one user's data is never visible to another.

## Latest update — Kaiduo

This latest project update was completed by **Kaiduo**. It addresses the CA2
feedback by connecting the workspace modules more clearly, extending the Agent
beyond note creation, improving the main user flows, and completing the
production delivery path.

| Area | Changes completed by Kaiduo |
| --- | --- |
| Tasks workspace | Moved task filters into the contextual sidebar; integrated task and calendar-event records; added clear event badges and task-only controls; redesigned the overview as a compact horizontal status row with neutral Total, amber Active, blue In Progress, red Upcoming, and green Completed states. |
| Calendar workspace | Split month navigation and event actions into two labelled toolbar levels; removed the Study rhythm card; retained a compact full-width Selected day summary; fixed month labels and event counts after navigation; prevented duplicate New event handling; kept responsive drag-and-drop scheduling. |
| Notes | Added a safe Markdown Edit/Preview experience with headings, emphasis, lists, task lists, quotes, links, inline code, and fenced code blocks while escaping raw HTML. |
| Agent Chat | Added MongoDB-grounded task summaries and a read-only seven-day Study Briefing that combines the signed-in user's tasks, pinned or recent notes, and upcoming calendar events into ranked focus items; added deterministic mock-mode support when a model API is unavailable. |
| Learning analytics and UI | Kept completion analytics in sync with direct task changes; added completion-rate and weekly metrics; refined the learning-tools drawer, themed scrollbar, responsive surfaces, profile achievement icon, and light/dark/paper presentation. |
| Security and delivery | Hardened avatar uploads, health probes, Docker and Compose runtime security; added Kubernetes staging/production overlays, TLS ingress, HPA, PDB, NetworkPolicy, resource controls, Ansible K3s provisioning/deploy/rollback, and GitHub Actions test, security, validation, container smoke-test, publish, and gated deployment jobs. |

The update is covered by **36 automated tests**, a zero-high-vulnerability
production dependency audit, real Docker Compose health and CRUD smoke tests,
Kubernetes rendering checks, Ansible syntax checks, and the remote GitHub
Actions delivery pipeline.

## Main capabilities

- Email OTP login/signup (n8n sends the code, Butler verifies it and issues
  a session)
- One-click localhost demo login when the complete Docker stack is used
- Per-account data isolation: tasks, notes, calendar events, and chat history
  are all scoped to the logged-in account
- Streaming DeepSeek chat through an OpenAI-compatible client
- Deterministic offline chat through `CHAT_MOCK_MODE`
- Multi-round agent tool calls for tasks, notes, and calendar events
- Deterministic MongoDB-grounded task summaries with completion rate, overdue
  work, weekly progress, and prioritised next actions
- Cross-module study briefings that rank focus items from live tasks, pinned or
  recent notes, and upcoming calendar events
- Explicit user confirmation before write operations
- MongoDB-backed chat history and workspace data
- In-memory document decoding for text files, PDF, and DOCX
- Search across the current account's persisted notes, tasks, and chat messages
- Account-scoped achievement badges derived from real workspace activity
- Direct note links, pinned-note filtering, in-editor pin controls, and a safe
  rendered Markdown preview
- Responsive EJS interface with paper, glass, and dark themes
- Simulated billing/credits and profile settings (Task 6)
- Docker configurations for either MongoDB alone or the complete stack
- Ansible provisioning for a cloud-hosted K3s cluster
- Kubernetes staging and production deployments with TLS, probes, HPA, PDB,
  network policy, immutable GHCR images, health verification, and rollback

## Quick start

The complete local stack is the recommended way to run Butler for development
or an on-device demonstration:

```powershell
git clone https://github.com/frankrainrp/C270_FA_DEPLOYMENT.git
Set-Location C270_FA_DEPLOYMENT
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
|   `-- ci-cd.yml             Test, publish, Ansible deploy, and verification
|-- ansible/
|   |-- inventory.example.yml Cloud VM inventory template
|   |-- requirements.*        Pinned Ansible and Kubernetes dependencies
|   |-- group_vars/all.yml    Non-secret K3s defaults
|   |-- templates/            Persistent K3s server configuration
|   `-- playbooks/
|       |-- bootstrap-k3s.yml Install a K3s server and optional agents
|       |-- export-kubeconfig.yml  Export protected cluster access
|       |-- deploy.yml        Apply secrets/manifests, verify, and auto-rollback
|       `-- rollback.yml      Operator-initiated previous-revision rollback
|-- k8s/
|   |-- base/                 Deployment, Service, Ingress, HPA, PDB, policy
|   `-- overlays/
|       |-- staging/          One-replica staging namespace and limits
|       `-- production/       Production namespace and replica settings
|-- .env.example              Documented environment-variable template
|-- .dockerignore             Docker build-context exclusions
|-- Dockerfile                Shared local and production Node.js image
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
- `api/briefing.js` combines the caller's task, note, and calendar data into a
  deterministic planning view for the Agent.
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
- `StudyBriefingService.js` ranks cross-module focus items without asking the
  language model to infer or count workspace data.
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
- `markdown-renderer.js` renders saved note Markdown while escaping raw HTML
  and restricting clickable links to HTTP(S).
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
   Task-progress questions use the deterministic `/api/tasks/summary` endpoint
   so counts, completion rate, overdue work, and priorities are calculated from
   stored records instead of estimated by the model.
   Daily and weekly planning questions use `/api/briefing`, which joins those
   task metrics with pinned/recent notes and upcoming calendar events.
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

1. In Chat, select **Task summary**, or send: `Summarize my tasks, completion
   rate, overdue work, and top priorities.`
2. Butler automatically runs the read-only `task_summary` tool. The same
   MongoDB-grounded summary remains available in mock mode if model access fails.
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

## CA2 Agent feedback improvement

CA2 feedback asked the team to extend the Agent beyond note creation and add
task summaries. The current implementation provides a demonstrable evidence
chain:

| Feedback | Implemented correction | Verification |
|---|---|---|
| Agent focused mainly on notes | Account-scoped task, note, and calendar tools with a bounded multi-round loop | `ChatToolDefinitions.js`, `tool-executor.js` |
| Generate task summaries | Deterministic `task_summary` tool with completion rate, overdue/upcoming counts, weekly completion, and top priorities | `TaskService.getSummary`, `GET /api/tasks/summary` |
| Features were not fully integrated | Task reads and writes use the same authenticated REST services and MongoDB records as the Tasks and Calendar pages | Agent/API integration test |
| Production/demo reliability | Read-only local summary fallback when the external model is unavailable; writes remain approval-gated and idempotent | `agent-task-summary.test.js` |

## Validation

```powershell
npm ci
npm run test:ci
npm run audit:ci
docker compose -f docker-compose.db.yml config -q
docker compose config -q
docker compose up -d --build --wait
Invoke-RestMethod http://localhost:3001/api/live
npm run smoke
```

`npm run test:ci` verifies required deployment files and runs the Node.js test
suite. `npm run audit:ci` fails on high-severity production dependency findings.
`npm run smoke` expects the complete stack at `http://127.0.0.1:3001`; it checks
readiness, local authentication, protected pages, MongoDB persistence, and task
CRUD, then removes the task that it created. The real DeepSeek path requires a
valid API key, and container runtime verification requires Docker Desktop.

Deployment configuration validation additionally runs in Linux/WSL:

```bash
kubectl kustomize k8s/overlays/staging >/dev/null
kubectl kustomize k8s/overlays/production >/dev/null
ansible-playbook --syntax-check -i ansible/inventory.example.yml ansible/playbooks/bootstrap-k3s.yml
ansible-playbook --syntax-check ansible/playbooks/deploy.yml
```

## Complete build, test, publish, and cloud deployment

The repository uses one delivery chain from source code to a Kubernetes cloud
runtime. Docker Compose remains the reproducible local and CI stack; Ansible
provisions Linux cloud hosts and drives deployment; K3s/Kubernetes runs the
published image. No application-platform deploy hook is required.

```text
push / pull request
  -> Node tests + npm audit + deployment-file validation
  -> Docker Compose build + authenticated end-to-end smoke test
  -> push ghcr.io/...:sha-<full-commit> with SBOM and provenance (main only)
  -> Ansible deploy to Kubernetes staging
  -> HTTPS readiness smoke test
  -> GitHub production approval
  -> Ansible deploy of the identical SHA image to production
  -> automatic rollback attempt if rollout or health verification fails
```

### Pipeline jobs

`.github/workflows/ci-cd.yml` runs on every branch push, pull requests to
`main`, and manual validation runs.

1. **Test and security gate** installs the npm lockfile, validates required
   files, runs all Node tests, blocks high-severity production dependency
   findings, and validates both Compose files.
2. **Validate Kubernetes and Ansible** renders both Kustomize overlays and runs
   syntax checks against every Ansible playbook.
3. **Build and smoke-test containers** starts Butler and MongoDB with Compose,
   checks `/api/live` and `/api/health`, authenticates, exercises protected
   pages and task CRUD, verifies UID 1000, and always uploads logs.
4. **Publish verified image** runs only for a successful push to `main`. It
   publishes `latest` and `sha-<40-character-commit>` to GHCR with OCI
   provenance and an SBOM.
5. **Deploy staging with Ansible** injects protected secrets, applies the
   staging overlay, pins the exact SHA image, waits for rollout, and checks the
   public HTTPS health endpoint.
6. **Approve and deploy production with Ansible** waits for the GitHub
   `production` Environment approval and promotes the same SHA image. A failed
   rollout or smoke test triggers an Ansible rollback attempt.

Pull requests and non-`main` branches never receive package or cluster write
access. A workflow run on those branches proves build and test only.

## Cloud architecture

The included infrastructure profile targets Linux cloud virtual machines and
installs K3s, a conformant lightweight Kubernetes distribution. The example
inventory contains three server nodes for embedded-etcd high availability and
one worker. For a small demonstration cluster, keep only one server and any
number of workers. Do not use two server nodes; use one or three.

Production application data remains in MongoDB Atlas. It is deliberately not
stored inside the Kubernetes cluster, so Pod replacement and cluster upgrades
do not own the database lifecycle.

Kubernetes provides:

- separate `butler-staging` and `butler-production` namespaces;
- a non-root Deployment with a read-only root filesystem and immutable image;
- process-only liveness at `/api/live` and database-aware readiness at
  `/api/health`;
- a ClusterIP Service and Traefik HTTPS Ingress;
- HorizontalPodAutoscaler, PodDisruptionBudget, resource requests/limits, and
  NetworkPolicy;
- TLS certificates created and renewed by cert-manager, with runtime and GHCR
  credentials created by Ansible from protected GitHub Environment secrets;
- rolling updates, revision history, public health verification, and rollback.

### 1. Cloud and service prerequisites

Prepare the following before the first public deployment:

- one Ubuntu/Debian VM for a small cluster, or three control-plane VMs plus
  optional worker VMs for high availability;
- unique hostnames, SSD storage, SSH key access, and private networking between
  nodes;
- inbound TCP 22 from the operator, TCP 80/443 from the internet, TCP 6443
  only from nodes/operators, UDP 8472 only between nodes, and TCP 10250 only
  between nodes;
- a DNS hostname for staging and another for production;
- public DNS hostnames resolving to the Traefik ingress address;
- MongoDB Atlas with backups and a least-privilege database user; allow the
  cluster's stable outbound IP in Atlas Network Access;
- a production HTTPS n8n OTP webhook and a DeepSeek API key;
- Python 3.13+, OpenSSH, Ansible, `kubectl`, and `gh` on the control machine.

Never expose UDP 8472 publicly. The cloud security group remains the outer
firewall even when an operating-system firewall is configured.

### 2. Install Ansible dependencies

Run Ansible from Linux, macOS, or WSL. From the repository root:

```bash
python3 -m venv .venv-ansible
source .venv-ansible/bin/activate
python -m pip install --requirement ansible/requirements.txt
ansible-galaxy collection install --requirements-file ansible/requirements.yml
```

The pinned files currently install Ansible Core, the Kubernetes Python client,
and `kubernetes.core`. Update them deliberately and let CI syntax-check every
playbook before merging.

### 3. Provision K3s with Ansible

Copy the inventory and replace the documentation-only IP addresses and SSH
user. Keep either one or three entries under `k3s_server`.

```bash
cp ansible/inventory.example.yml ansible/inventory.yml
${EDITOR:-vi} ansible/inventory.yml

export K3S_TOKEN="$(openssl rand -hex 32)"
ansible all -i ansible/inventory.yml -m ping
ansible-playbook -i ansible/inventory.yml ansible/playbooks/bootstrap-k3s.yml
ansible-playbook -i ansible/inventory.yml ansible/playbooks/export-kubeconfig.yml

export KUBECONFIG="$HOME/.kube/butler-k3s.yaml"
kubectl get nodes -o wide
kubectl get pods --all-namespaces
```

`K3S_TOKEN` is a cluster credential. Store it in a password manager or Ansible
Vault, never in the inventory or Git. The bootstrap playbook pins the K3s
version, enables Kubernetes Secret encryption at rest, installs the first
server, joins two additional servers when present, joins worker nodes, and
waits for all nodes to become Ready.

For a three-server cluster, place a TCP load balancer in front of port 6443 and
override `k3s_api_address` in the inventory with its stable private address.
The load balancer and DNS records are cloud-account resources and therefore
cannot be created by this provider-neutral repository.

### 4. Configure DNS and TLS

Point each public DNS record to the external address used by the K3s Traefik
Ingress. Confirm resolution before enabling CD:

```bash
dig +short staging.example.com
dig +short app.example.com
```

Install the pinned cert-manager release and the Let's Encrypt production
ClusterIssuer after DNS resolves:

```bash
export K8S_AUTH_KUBECONFIG="$HOME/.kube/butler-k3s.yaml"
ansible-playbook ansible/playbooks/install-cert-manager.yml
kubectl get pods --namespace cert-manager
kubectl get clusterissuer letsencrypt-production
```

The Butler Ingress requests its `butler-tls` Secret automatically. cert-manager
renews the certificate before expiry; certificate private keys are never
stored in GitHub or committed to the repository.

If the cluster uses an Ingress controller other than the bundled K3s Traefik,
change `ingressClassName`, its annotations, and the NetworkPolicy ingress
selector in `k8s/base/` before deployment.

### 5. Configure GitHub Environments and secrets

Register a dedicated Linux x64 self-hosted Actions runner on the K3s control
node and assign the custom label `butler-k3s`. Install it as an unprivileged
service account named `github-runner`. Copy the local K3s kubeconfig to
`/home/github-runner/.kube/config`, set its server to
`https://127.0.0.1:6443`, and restrict the file to that account with mode
`0600`. Confirm that the account can run `kubectl get nodes` before enabling
cloud deployment.

Only the two deployment jobs use this runner. CI tests, container smoke tests,
Trivy scans, and GHCR publishing remain on GitHub-hosted runners. This keeps
the Kubernetes API private and avoids opening TCP `6443` to the Internet or
storing an administrative kubeconfig in GitHub.

Create two GitHub Environments in **Settings → Environments**:

- `staging`: automatic deployment from a successful `main` push;
- `production`: add required reviewers so production waits for approval.

At repository level, create `STAGING_DEPLOY_ENABLED=true` only after the
staging Environment, DNS, cert-manager, and cluster are ready. Create
`PRODUCTION_DEPLOY_ENABLED=true` only after the protected production
Environment is complete. Until enabled, main still publishes a verified GHCR
image while the corresponding cluster deployment job stays safely skipped.

Configure these variables in each Environment:

| Variable | Example |
|---|---|
| `APP_HOST` | `staging.example.com` or `app.example.com` |
| `APP_URL` | `https://staging.example.com` or `https://app.example.com` |
| `GHCR_USERNAME` | GitHub account allowed to read the package |

Configure these secrets independently in each Environment:

| Secret | Purpose |
|---|---|
| `MONGO_URI` | Environment-specific Atlas connection string |
| `DEEPSEEK_API_KEY` | Live Agent model credential |
| `N8N_OTP_WEBHOOK_URL` | Production HTTPS OTP workflow |
| `GHCR_READ_TOKEN` | Read-only `read:packages` credential for private GHCR |

Configure the non-secret Environment variables:

```bash
gh variable set APP_HOST --env staging --body "staging.example.com"
gh variable set APP_URL --env staging --body "https://staging.example.com"
gh variable set GHCR_USERNAME --env staging --body "YOUR_GITHUB_USER"
```

Repeat the variable commands for `production`. Set the secrets interactively
with `gh secret set NAME --env ENVIRONMENT` so their values do not appear in
the command history. Do not print or echo secrets in a workflow.

Before either deployment changes the cluster, the workflow runs
`scripts/verify-ghcr-read.sh`. The script uses the environment's
`GHCR_USERNAME` and `GHCR_READ_TOKEN` to request the exact immutable SHA-tagged
image manifest from GHCR. This catches missing, expired, or incorrectly scoped
package credentials even when the K3s node already has a cached copy of the
image.

To verify one Environment without deploying or changing Kubernetes resources,
run the **Verify GHCR Environment Credential** workflow manually and select
`staging` or `production`. The production Environment's normal reviewer
approval still applies. This standalone check reads the package tag list, so
it verifies `read:packages` independently of image publication and deployment.

The local K3s admin kubeconfig is sufficient for initial setup but broader than
a mature CD identity should be. After the first deployment, replace it with a
namespace-scoped service account permitted to manage only Butler resources.

### 6. First automated deployment

The deployment workflow must exist on `main`, and the matching repository
deployment variable must be `true`; a successful run on a feature branch does
not publish or deploy. Merge through a protected pull request:

```bash
git switch main
git pull --ff-only origin main
git merge --ff-only YOUR_VERIFIED_BRANCH
git push origin main
```

Then follow **Actions → CI, Container Delivery, and Kubernetes Deployment**.
The expected sequence is:

```text
quality + deployment-validation
  -> docker-smoke
  -> publish
  -> deploy-staging
  -> production Environment approval
  -> deploy-production
```

The deployment jobs use `ansible/playbooks/deploy.yml`. They do not rebuild the
image. Staging and production both receive the exact
`ghcr.io/...:sha-${GITHUB_SHA}` image that passed CI.

### 7. Verify the cloud deployment

```bash
export KUBECONFIG="$HOME/.kube/butler-k3s.yaml"
kubectl -n butler-staging get deployment,pods,service,ingress,hpa,pdb
kubectl -n butler-production get deployment,pods,service,ingress,hpa,pdb
kubectl -n butler-production rollout history deployment/butler

curl --fail --show-error https://app.example.com/api/live
curl --fail --show-error https://app.example.com/api/health
```

`/api/live` should return `status: alive`. `/api/health` should return
`status: ready` and `database: connected`. Complete a real OTP login and one
read-only Agent request, then approve one write request and verify the saved
record.

### 8. Manual deployment and rollback

Normal releases use GitHub Actions. For an authorized operator deployment,
load the same values from a secret manager into environment variables and run:

```bash
export DEPLOY_ENV=production
export K8S_AUTH_KUBECONFIG="$HOME/.kube/butler-k3s.yaml"
export IMAGE="ghcr.io/frankrainrp/c270_fa_deployment:sha-FULL_40_CHAR_COMMIT"
export APP_HOST="app.example.com"
export APP_URL="https://app.example.com"
# Load MONGO_URI, DEEPSEEK_API_KEY, N8N_OTP_WEBHOOK_URL,
# GHCR_USERNAME and GHCR_READ_TOKEN
# from the approved secret manager without printing them.
ansible-playbook ansible/playbooks/deploy.yml
```

Roll back one Kubernetes Deployment revision and re-check health:

```bash
export DEPLOY_ENV=production
export K8S_AUTH_KUBECONFIG="$HOME/.kube/butler-k3s.yaml"
export APP_URL="https://app.example.com"
ansible-playbook ansible/playbooks/rollback.yml
```

Application rollback does not reverse destructive database migrations. Use
backward-compatible expand/contract migrations and test Atlas restore
procedures separately.

### 9. What is and is not automatic

After the cluster, DNS, cert-manager, Atlas, GitHub Environments, and secrets
are configured, every successful `main` push completes build, test, image
publication, staging deployment, production approval, production deployment,
public verification, and failure rollback logic in the cloud.

The repository cannot purchase virtual machines, register a domain, approve a
certificate, or create third-party API credentials without access to those
accounts. Until those external resources and secrets exist, CI is cloud-hosted
but the application is not yet publicly deployed.

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

1. Show the green GitHub Actions run and explain test, deployment validation,
   Docker smoke, GHCR publication, Ansible staging deployment, production
   approval, and verification gates.
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
6. For the cloud path, show the Ansible inventory/playbooks, Kubernetes
   staging/production overlays, a `sha-*` Deployment image, rollout history,
   HTTPS `/api/live` and `/api/health`, and one real OTP user flow.

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
