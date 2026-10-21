<p align="center"><img src="docs/assets/butler-mark.svg" alt="Study Butler logo" width="100"></p>

# Study Butler — AI Study Workspace

Study Butler combines account-scoped tasks, Markdown notes, calendar events and streaming AI chat. Node.js and Express serve EJS pages and REST endpoints; MongoDB persists account data, sessions and chat history.

**Node.js · Express · EJS · MongoDB · Docker · GitHub Actions · Kubernetes/K3s · Ansible**

## Implementation

| Feature | Implementation |
|---|---|
| Accounts | Email OTP delivered through an n8n webhook; opaque server-side sessions and account-scoped queries |
| Workspace | Tasks, calendar events, Markdown notes, search and derived study statistics |
| Assistant | OpenAI-compatible streamed chat, bounded tool exchanges and user approval before mutations |
| Grounded summaries | Deterministic summaries and study briefings computed from the current account's MongoDB records |
| Documents | In-memory text, PDF and DOCX decoding with configured size and text limits |
| Delivery | Docker Compose, GitHub Actions validation and image delivery, Kubernetes overlays and Ansible K3s automation |

## Run locally

```sh
git clone https://github.com/frankrainrp/C270_FA_DEPLOYMENT.git
cd C270_FA_DEPLOYMENT
```

Copy `.env.example` to `.env`, then run:

```sh
docker compose up -d --build --wait
docker compose ps
curl http://127.0.0.1:3001/api/health
```

Open `http://localhost:3001` and select **Enter local demo**. The Compose stack includes MongoDB. Workspace features use the database; chat uses deterministic responses when the model API is unavailable. Stop the stack with `docker compose down` to retain the data volume.

## Model integration

`src/services/ChatService.js` maps chat choices to actual API models:

| Compatibility ID | API model | Tool calls |
|---|---|---|
| `deepseek-v4-flash` | `deepseek-chat` | Enabled |
| `deepseek-v4-thinking` | `deepseek-reasoner` | Disabled in this implementation |

Set `DEEPSEEK_BASE_URL` and `DEEPSEEK_API_KEY` in the server environment for live inference. `CHAT_MOCK_MODE` selects deterministic local responses. Provider credentials remain server-side. Proposed task, note and calendar changes require user confirmation before account-scoped REST operations execute them.

## Configuration

| Setting | Purpose |
|---|---|
| `APP_PORT` / `PORT` | Compose host port / application process port |
| `MONGO_URI` and MongoDB settings | Persistent database connection |
| `N8N_OTP_WEBHOOK_URL` | OTP delivery workflow |
| `OTP_TTL_MINUTES` / `OTP_MAX_ATTEMPTS` | OTP expiry and retry limit |
| `SESSION_TTL_DAYS` / `SESSION_COOKIE_NAME` | Server-side session lifecycle |
| `LOCAL_DEMO_MODE` | One-click account for isolated localhost demonstrations |
| `DOCUMENT_MAX_MB` / `DOCUMENT_TEXT_LIMIT` | Document processing bounds |

Use the n8n workflow template with deployment-specific SMTP credentials. Local example passwords are development defaults and should be replaced for deployment.

## Deployment and verification

```sh
npm ci
npm run test:ci
npm run smoke
```

The `k8s/` directory contains staging/production overlays, TLS ingress, probes, resource controls and rollout policies. `ansible/` contains cluster provisioning and deployment automation. GitHub Actions validates tests and configuration, builds and checks the container, publishes versioned images and gates deployment jobs. Inspect `.github/workflows/` for the current pipeline.

## Repository layout

| Path | Responsibility |
|---|---|
| `src/` | Express routes, services, MongoDB models, EJS views and browser assets |
| `test/` | Application regression tests |
| `scripts/` | Smoke checks and maintenance utilities |
| `k8s/` | Kubernetes manifests and environment overlays |
| `ansible/` | K3s infrastructure and application deployment |

[Agent instructions](AGENTS.md)

The separate [Next.js/Ollama Butler workspace](https://github.com/frankrainrp/Bulter) has its own Windows package and independent MCP component. Its installer is not the delivery artifact for this Express/MongoDB repository.
