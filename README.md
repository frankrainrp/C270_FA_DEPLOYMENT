<!--
  README.md
  Structural reference for the Butler codebase.
  Describes what exists today: architecture, directory tree, and a
  folder-by-folder guide of where to look when making changes.

  Keep this document truthful.  If a folder or file no longer exists,
  or its responsibilities move, update the matching section here in
  the same commit.
-->

# Butler

Butler is a single Node.js web application that combines a study workspace UI (chat, tasks, calendar, notes) with a streaming AI chat agent.  It runs as **one Express process** that serves both the EJS-rendered HTML pages and the JSON / SSE API used by the browser.

---

## Tech Stack

| Layer      | Technology                                        |
|------------|---------------------------------------------------|
| Server     | Node.js + Express                                 |
| Templating | EJS                                               |
| Styling    | One hand-written `style.css` (~3300 lines)        |
| Client JS  | Plain browser JS, no bundler, no framework        |
| AI model   | DeepSeek (via the OpenAI SDK); optional           |
| DevOps     | Docker, docker-compose, CI validation script      |

---

## Architecture

```
┌───────────────────────────────────────────────────────────────┐
│  Browser                                                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │ EJS pages    │  │ shell.js     │  │ chat-client.js       │ │
│  │ (SSR shell)  │  │ (theme+menu) │  │ (SSE stream reader)  │ │
│  └──────┬───────┘  └──────────────┘  └──────────┬───────────┘ │
│         │ GET /chat, /tasks, /calendar, /notes    │ POST /api  │
└─────────┼─────────────────────────────────────────┼────────────┘
          │                                         │
┌─────────▼─────────────────────────────────────────▼────────────┐
│  Express (src/app.js)                                            │
│  routes/pages.js    ─► lib/renderLayout ─► views/*.ejs           │
│  routes/api/chat.js ─► services/ChatService ─► DeepSeek (or mock)│
│  routes/api/health.js                                            │
└──────────────────────────────────────────────────────────────────┘
```

The request flow always follows the same pattern:

- **HTML page**:  `routes/pages.js` → `lib/renderLayout.js` → `views/layout.ejs` → `views/partials/sidebar.ejs` + `views/pages/{page}.ejs`
- **JSON / SSE**: `routes/api/*.js` → `services/*.js` → external API or local logic

---

## Directory Tree

Every leaf is either a real file today or an empty placeholder.  Annotations describe what the folder or file is responsible for.

```
THE_FINAL_C270/
├── package.json          Node dependencies + npm scripts (start, test:ci).
├── package-lock.json     npm lockfile.
├── Dockerfile            Production image build for the Node app.
├── docker-compose.yml    Local stack: Node app + MongoDB (Phase 2+ ready).
├── ci-validate.mjs       CI smoke check for required files.
├── .gitignore            Excludes node_modules, .env, uploads, etc.
├── README.md             This document.
│
└── src/
    │
    ├── app.js            Application entry point.  Wires middleware,
    │                     mounts routes/index.js, starts the HTTP server.
    │                     Contains NO route handlers or business logic.
    │
    ├── lib/              Small, stateless server helpers.
    │   ├── nav.js                Navigation constants.  Source of truth for
    │   │                         the four main tabs (chat / tasks / calendar
    │   │                         / notes) and the page whitelist used by
    │   │                         renderLayout.
    │   ├── renderLayout.js       Central layout renderer.  Every HTML page
    │   │                         route calls this so shared locals (topbar,
    │   │                         sidebar rail, theme, user profile) are
    │   │                         populated identically.
    │   └── apiResponse.js        JSON envelope helpers: makeOk / makeFail /
    │                             runSafe (async wrapper).  All /api/* JSON
    │                             responses follow { ok, data } / { ok, error }.
    │
    ├── data/             Static / mock data used by the UI shell.
    │   └── mockRail.js           Placeholder sidebar payloads for each of
    │                             the four tabs.  Replace with real DB queries
    │                             when data persistence lands.
    │
    ├── services/         Business logic and external API integrations.
    │   ├── ChatService.js        SSE chat streaming.  Proxies to DeepSeek
    │   │                         when DEEPSEEK_API_KEY is set, otherwise
    │   │                         emits a deterministic mock word stream.
    │   ├── ChatPrompt.js         Server-authoritative system prompt builder.
    │   │                         Never trusts client-supplied system messages.
    │   └── ChatToolDefinitions.js  OpenAI-style tool schemas the model may
    │                             call (create/update/delete/toggle task,
    │                             create/list note, ...).
    │
    ├── routes/           HTTP surface.  One file per response type.
    │   ├── index.js              Central route aggregator.  Called once from
    │   │                         app.js to mount every route module.
    │   ├── pages.js              HTML page routes (text/html).
    │   │                           /                → redirect /chat
    │   │                           /chat            → chat workspace
    │   │                           /tasks           → task list
    │   │                           /calendar        → calendar month grid
    │   │                           /notes           → notes split view
    │   │                           /preferences     → theme switcher
    │   │                           /auth/login      → standalone login page
    │   │                           /ai/chat         → redirect /chat (legacy)
    │   │                           /study/dashboard → redirect /tasks (legacy)
    │   └── api/
    │       ├── health.js         GET /api/health.  Liveness probe.
    │       └── chat.js           POST /api/chat.  Streams a chat completion
    │                             as text/event-stream.
    │
    ├── views/            EJS templates.
    │   ├── layout.ejs            Master app shell.  Renders wallpaper,
    │   │                         topbar, sidebar slot, main slot, mobile
    │   │                         tabbar.  Also hosts the inline theme
    │   │                         preload script that reads localStorage
    │   │                         before the stylesheet loads.
    │   ├── preferences.ejs       Standalone theme switcher.  Not wrapped in
    │   │                         layout.ejs.  Presents three theme cards
    │   │                         (Paper, Glass, Dark).
    │   ├── partials/
    │   │   └── sidebar.ejs       Contextual left rail.  Renders a different
    │   │                         section depending on activeNav.
    │   ├── pages/                One file per main navigation tab.  Rendered
    │   │   │                     inside layout.ejs .layout-main via include.
    │   │   ├── chat.ejs          Chat workspace: empty state, message
    │   │   │                     stream, composer.  Loads the chat-*.js
    │   │   │                     modules.
    │   │   ├── task.ejs          Task list with demo cards.
    │   │   ├── calendar.ejs      Calendar month grid.
    │   │   └── note.ejs          Notes split view (list + editor).
    │   └── auth/
    │       └── login.ejs         Standalone login form.  Does NOT use
    │                             layout.ejs.
    │
    └── public/           Static assets served at "/".
        ├── css/
        │   └── style.css         Complete hand-written design system.
        │                         Defines three themes via data-theme:
        │                         paper (iOS glass), retro (paper),
        │                         dark (deep neutral).
        └── js/
            ├── shell.js          Loaded on every page.  Handles the user
            │                     menu, mobile drawer, escape-to-close,
            │                     and cross-tab / bfcache theme sync.
            ├── api.js            Loaded on chat page.  Fetch wrapper for
            │                     /api/* under window.ButlerApi.
            ├── app-state.js      Loaded on chat page.  In-memory state
            │                     container under window.ButlerState.
            │                     Holds messages, streaming flag, session.
            ├── chat-client.js    Loaded on chat page.  Reads the /api/chat
            │                     SSE stream, accumulates content deltas
            │                     and tool_calls, invokes callbacks.
            │                     Exposed as window.ButlerChatClient.
            ├── chat-ui.js        Loaded on chat page.  Wires the composer
            │                     form to ButlerChatClient, renders
            │                     message bubbles, manages the Stop button.
            └── preferences.js    Loaded on the preferences page.  Applies
                                  the selected theme and persists it under
                                  localStorage "butler-theme".
```

---

## Where to Change What

A folder-by-folder cheat sheet.  When you want to modify a specific area of the app, this is the first place to look.

### `src/app.js` — Bootstrap

Touch here when you need to:

- Add or reorder global middleware (body parsers, static, cookies, sessions)
- Register a new route module through `routes/index.js`
- Change global error / 404 behaviour
- Change the listen port

Do **not** put route handlers or business logic here.

### `src/lib/` — Server Helpers

Touch here when you need to:

- Add a new navigation tab or reorder them → `nav.js` (`NAV_ITEMS`, `PAGE_WHITELIST`)
- Add a new shared local for every page → `renderLayout.js`
- Change how API responses are shaped → `apiResponse.js`

### `src/data/` — Mock / Static Data

Touch here when you need to:

- Change what the sidebar shows in Phase-0 development → `mockRail.js`
- Add a new tab's sidebar payload shape (until the real API lands)

### `src/services/` — Business Logic

Touch here when you need to:

- Change the chat system prompt, personality lines, or safety rules → `ChatPrompt.js`
- Change the AI model whitelist, DeepSeek transport, or the mock stream → `ChatService.js`
- Add / remove tools the AI is allowed to call → `ChatToolDefinitions.js`
- Add a new external integration (OCR, search, etc.) → create a new `*Service.js` here

### `src/routes/` — HTTP Surface

Touch here when you need to:

- Add or rename an HTML page URL → `pages.js`
- Add a new JSON or SSE endpoint → create a new file under `routes/api/` and mount it in `routes/index.js`
- Attach middleware to a specific route group → `routes/index.js`

### `src/views/` — EJS Templates

Touch here when you need to:

- Change the topbar, brand, user menu, or mobile tabbar → `layout.ejs`
- Change what appears in the left sidebar per tab → `partials/sidebar.ejs`
- Redesign a specific main tab's content → `pages/chat.ejs`, `pages/task.ejs`, `pages/calendar.ejs`, `pages/note.ejs`
- Change the login screen → `auth/login.ejs`
- Change the preferences page or add another setting section → `preferences.ejs`

### `src/public/css/` — Styling

Touch here when you need to:

- Change any colour, spacing, radius, or shadow → design tokens at the top of `style.css` (`:root`, `[data-theme="dark"]`, `[data-theme="retro"]`)
- Restyle a specific area → search the section headers inside `style.css` (there are 14 numbered sections: layout, topbar, sidebar, chat, tasks, calendar, notes, mini apps, mobile, ...)

### `src/public/js/` — Client-Side Interactions

Touch here when you need to:

- Change the user menu / mobile drawer / cross-tab theme sync → `shell.js`
- Change the /api/* fetch wrapper → `api.js`
- Change how chat state is held in the browser → `app-state.js`
- Change how the SSE stream is parsed or how tool calls are surfaced → `chat-client.js`
- Change how chat messages render, or how the composer behaves → `chat-ui.js`
- Change the theme switcher behaviour → `preferences.js`

---

## Running Locally

```bash
npm install
npm start
```

The server listens on `http://localhost:3000`.  Available URLs:

| URL              | What it shows                                                 |
|------------------|---------------------------------------------------------------|
| `/`              | Redirects to `/chat`                                          |
| `/chat`          | Chat workspace with a working streaming composer              |
| `/tasks`         | Task list demo                                                |
| `/calendar`      | Calendar month grid demo                                      |
| `/notes`         | Notes split view demo                                         |
| `/preferences`   | Theme switcher (Paper / Glass / Dark)                         |
| `/auth/login`    | Standalone login page                                         |
| `/api/health`    | `{ ok: true, data: { status: "up" } }`                        |
| `/api/chat`      | SSE endpoint (POST only)                                      |

### Environment variables

```bash
# .env (never commit)
PORT=3000
NODE_ENV=development

# Optional.  Without this, /api/chat returns a mock word stream so
# the UI is fully browsable offline.
DEEPSEEK_API_KEY=sk-...
DEEPSEEK_BASE_URL=https://api.deepseek.com/v1
```

To enable the real AI path, install the OpenAI SDK and set the key:

```bash
npm install openai
```

---

## Notes on the Theme System

The CSS defines three themes under `data-theme`, and the display names shown in the UI are intentionally different from the CSS values because the original CSS naming is misleading:

| Display name (in Preferences) | CSS value             | Visual                          |
|-------------------------------|-----------------------|---------------------------------|
| **Paper** (default)           | `data-theme="retro"`  | Cream parchment, handwritten fonts, olive + brass accents |
| **Glass**                     | `data-theme="paper"`  | iOS-style frosted glass, soft teal palette |
| **Dark**                      | `data-theme="dark"`   | Deep neutral, cool blue-cyan highlights |

Theme selection is persisted in `localStorage["butler-theme"]`.  It is applied in three places to stay in sync across navigation, browser back/forward cache, and other tabs:

1. Inline `<script>` in the `<head>` of `layout.ejs`, `auth/login.ejs`, and `preferences.ejs` — runs **before** the stylesheet so there is no flash.
2. `shell.js` — listens to `pageshow` (covers bfcache) and `storage` (covers cross-tab).
3. `preferences.js` — writes the choice when a card is clicked.

---

*Built for DevOps CA2 — Republic Polytechnic.*
