# DevOps Team Code Learning Guide

## Purpose

This document tells each team member exactly which DevOps files or workflow sections they are responsible for studying and presenting. Business application source code under `src/` is outside the scope of this guide.

Repository root on Windows:

```text
C:\path\to\C270_FA_DEPLOYMENT
```

All paths below are relative to the repository root. "Effective lines" excludes blank lines, comment-only lines, generated dependency files, and business application code. Contribution percentages represent responsibility, operational effort, integration work, and presentation duties; they are not calculated only from line counts.

## Team Summary

| Team Member | Contribution | Primary Role | Assigned Effective Lines |
|---|---:|---|---:|
| Kaiduo | 33.5% | DevOps Architecture and CI/CD Integration | 462 |
| Yu Fei | 14% | K3s and Monitoring | 602 |
| Ei Htet Htet Tun | 13.5% | Server Deployment and Presentation | 100 tracked + 12 local |
| Sherlyn | 13% | Ansible Automation | 812 |
| Chong Khen | 13% | Trivy Security and Quality Testing | 855 |
| HeinThuNyiNyi | 13% | Automated Testing | 855 |
| **Total** | **100%** | | **3,686 tracked** |

---

## 1. Kaiduo - DevOps Architecture and CI/CD Integration

### Learning objective

Kaiduo should be able to explain how one Git commit moves through validation, container testing, GHCR publishing, staging, production, and final health verification. The focus is the integration between tools, not only the syntax of individual files.

### Assigned files and sections

| Path or section | Effective lines | What the code does |
|---|---:|---|
| `.github\workflows\ci-cd.yml` lines 1-41 | Part of 167 | Defines workflow triggers, permissions, concurrency, Node/Python versions, image repository, and the main quality job. |
| `.github\workflows\ci-cd.yml` lines 45-57 and 73-78 | Part of 167 | Installs locked npm dependencies, runs validation/tests, and validates both Docker Compose configurations. |
| `.github\workflows\ci-cd.yml` lines 79-118 | Part of 167 | Renders staging/production Kustomize overlays and performs Ansible syntax validation. |
| `.github\workflows\ci-cd.yml` lines 154-203 | Part of 167 | Builds the Docker Compose test stack, runs smoke tests, verifies the container is non-root, uploads logs, and cleans up. |
| `.github\workflows\ci-cd.yml` lines 204-232 and 243-271 | Part of 167 | Builds the immutable image, logs in to GHCR, adds OCI metadata, and publishes `latest` and commit-SHA tags with cache, SBOM, and provenance. |
| `.env.example` | 24 | Documents the application's deployable environment-variable interface without storing real secrets. |
| `Dockerfile` | 16 | Builds the Node.js 24 Alpine production image, installs production-only dependencies, removes unnecessary tooling, runs as a non-root user, and exposes application/metrics ports. |
| `docker-compose.yml` | 61 | Defines the complete local/CI stack with Butler, MongoDB, health checks, secure container settings, ports, and a disposable database volume. |
| `docker-compose.db.yml` | 21 | Defines the MongoDB-only development stack used when the Node.js process runs outside Docker. |
| `package.json` | 25 | Defines npm dependencies and CI commands: `test:ci`, `audit:ci`, and `smoke`. |
| `scripts\smoke-check.mjs` | 87 | Performs live HTTP checks for liveness, readiness, MongoDB connectivity, authentication, protected pages, and task create/read/delete behavior. |
| `scripts\verify-ghcr-read.sh` | 61 | Exchanges the configured GHCR credentials for a registry token and verifies that the exact immutable image manifest can be pulled. |
| `package-lock.json` | Generated; not counted | Locks exact npm dependency versions and integrity hashes for repeatable `npm ci` installations. JSON does not support ownership comments. |

### What Kaiduo must understand

1. The difference between CI, container delivery, and CD.
2. Why pull requests run validation but do not deploy production.
3. Why production uses `sha-${GITHUB_SHA}` instead of only `latest`.
4. How `needs` creates the order: quality -> smoke test -> publish -> staging -> production.
5. Why Docker Compose is used for CI testing but K3s is used for the deployed environments.
6. How GitHub Variables and Secrets are passed into the deployment process without being committed.
7. Why SBOM, provenance, non-root execution, and immutable tags improve traceability and security.

### Presentation evidence

- Show the GitHub Actions job graph.
- Show a GHCR image with a full commit-SHA tag.
- Explain the difference between the GitHub-hosted CI runner and the self-hosted deployment runner.
- Show that the same immutable image is promoted from staging to production.

---

## 2. Yu Fei - K3s and Monitoring

### Learning objective

Yu Fei should be able to explain how the application runs inside K3s, how Kubernetes controls availability and scaling, and how application/MongoDB metrics reach Grafana Cloud.

### Assigned files and sections

| Path or section | Effective lines | What the code does |
|---|---:|---|
| `.github\workflows\ci-cd.yml` lines 119-153 | 29 | Provides the manual Prometheus Operator bootstrap job on the self-hosted K3s runner. |
| `k8s\base\configmap.yaml` | 22 | Stores non-secret runtime configuration such as ports, session settings, document limits, and production mode. |
| `k8s\base\deployment.yaml` | 142 | Defines the Butler and MongoDB Exporter containers, rolling updates, probes, resources, security contexts, temporary storage, ports, and image pull secret. |
| `k8s\base\hpa.yaml` | 33 | Scales the Butler Deployment according to average CPU utilization with controlled scale-up and scale-down behavior. |
| `k8s\base\ingress.yaml` | 26 | Routes HTTPS traffic through Traefik to the internal Butler Service. |
| `k8s\base\kustomization.yaml` | 15 | Combines all base Kubernetes resources into one reusable deployment definition. |
| `k8s\base\networkpolicy.yaml` | 52 | Restricts ingress to Traefik/Prometheus and limits egress to DNS, HTTPS, and MongoDB. |
| `k8s\base\pdb.yaml` | 12 | Requires at least one Butler Pod to remain available during voluntary disruptions. |
| `k8s\base\prometheus-rbac.yaml` | 37 | Creates the Prometheus ServiceAccount, Role, and RoleBinding required for target discovery. |
| `k8s\base\prometheus-service.yaml` | 16 | Creates an internal ClusterIP endpoint for the environment's Prometheus instance. |
| `k8s\base\prometheus.yaml` | 48 | Defines the Prometheus instance, ServiceMonitor/rule selection, 24-hour retention, resource limits, security context, and Grafana Cloud remote write. |
| `k8s\base\prometheusrule.yaml` | 27 | Defines alerts for database disconnection and missing Butler metrics. |
| `k8s\base\service.yaml` | 25 | Exposes Butler HTTP, application metrics, and MongoDB Exporter metrics inside the cluster. |
| `k8s\base\servicemonitor.yaml` | 35 | Instructs Prometheus to scrape Butler and MongoDB Exporter every 30 seconds. |
| `k8s\cluster\letsencrypt-production.yaml` | 13 | Defines the cluster-wide Let's Encrypt ACME issuer using Traefik HTTP-01 challenges. |
| `k8s\overlays\production\kustomization.yaml` | 20 | Applies production namespace, host, replica, and base-resource configuration. |
| `k8s\overlays\production\namespace.yaml` | 10 | Defines the restricted `butler-production` namespace. |
| `k8s\overlays\staging\kustomization.yaml` | 30 | Applies staging host, one initial replica, and an HPA range of one to two replicas. |
| `k8s\overlays\staging\namespace.yaml` | 10 | Defines the restricted `butler-staging` namespace. |

### What Yu Fei must understand

1. Deployment versus Pod versus container.
2. Service versus Ingress and why Traefik is the public entry point.
3. Startup, readiness, and liveness probes.
4. Requests/limits, HPA, PDB, rolling updates, and NetworkPolicy.
5. The difference between the Butler metrics endpoint (`9090`) and MongoDB Exporter (`9216`).
6. ServiceMonitor -> Prometheus -> remote write -> Grafana Cloud.
7. Why staging and production use separate namespaces and overlays.

### Presentation evidence

- Show `kubectl get deployment,pods,service,ingress -n butler-production`.
- Show `kubectl get prometheus,servicemonitor,prometheusrule`.
- In Grafana, query `sum by (namespace, job) (up)` and explain that `1` means the target is healthy.

---

## 3. Ei Htet Htet Tun - Server Deployment and Presentation

### Learning objective

Ei Htet Htet Tun should be able to demonstrate the real deployment path and explain how GitHub Actions securely operates the K3s server without exposing credentials in the repository.

### Assigned files and sections

| Path or section | Effective lines | What the code does |
|---|---:|---|
| `.github\workflows\ci-cd.yml` lines 272-328 | 50 | Runs staging deployment on the self-hosted K3s runner, verifies GHCR access, passes staging variables/secrets, and executes the deployment playbook. |
| `.github\workflows\ci-cd.yml` lines 329-384 | 50 | Runs production only after publish and staging succeed, loads production credentials, and executes the same immutable deployment. |
| `ansible\inventory.yml` | 12 local lines; not committed | Contains the real deployment host, SSH user, and local private-key path. It is intentionally ignored by Git. |

### Operational responsibilities

1. Maintain the EC2 deployment environment and self-hosted GitHub Actions runner.
2. Protect `/home/github-runner/.kube/config` and understand its permissions.
3. Configure GitHub staging/production Environment Variables and Secrets.
4. Configure GHCR read credentials, MongoDB credentials, and Grafana Cloud credentials.
5. Explain the 2 GB swap configuration and why swap is not a replacement for physical RAM.
6. Trigger deployments, inspect Pods, view logs, check rollout status, and investigate restarts.
7. Verify both public `/api/health` endpoints after deployment.

### Presentation evidence

- Open the successful GitHub Actions run.
- Show the staging job completing before production.
- Show Pod and rollout status without revealing secrets.
- Open staging/production health endpoints.
- Keep screenshots as a backup if the live server or network is unavailable.

### Security warning

Never show MongoDB passwords, Grafana API keys, GHCR tokens, private keys, raw Kubernetes Secrets, or the contents of the private inventory during the presentation.

---

## 4. Sherlyn - Ansible Automation

### Learning objective

Sherlyn should be able to explain how Ansible converts manual cluster/deployment commands into repeatable, validated, retryable, and recoverable automation.

### Assigned files

| Path | Effective lines | What the code does |
|---|---:|---|
| `ansible\group_vars\all.yml` | 5 | Pins the K3s version and defines cluster API, token, and Kubeconfig variables. |
| `ansible\inventory.example.yml` | 20 | Demonstrates one/three server nodes and optional agent-node inventory without real addresses. |
| `ansible\playbooks\bootstrap-k3s.yml` | 209 | Validates Linux hosts, installs prerequisites, initializes or upgrades K3s servers/agents, joins nodes, and verifies readiness. |
| `ansible\playbooks\deploy.yml` | 306 | Validates deployment inputs, checks cluster/operator access, creates Secrets, builds Kustomize output, applies resources, verifies health, captures failure logs, and rolls back. |
| `ansible\playbooks\export-kubeconfig.yml` | 30 | Securely copies the protected server Kubeconfig and replaces localhost with the reachable API address. |
| `ansible\playbooks\install-cert-manager.yml` | 91 | Installs pinned cert-manager components and verifies the Let's Encrypt ClusterIssuer. |
| `ansible\playbooks\install-prometheus-operator.yml` | 74 | Verifies cluster-admin access, installs a pinned Prometheus Operator, and waits for required CRDs. |
| `ansible\playbooks\rollback.yml` | 59 | Manually rolls the Butler Deployment back one revision and verifies health afterward. |
| `ansible\requirements.txt` | 4 | Pins Python packages used by Ansible and Kubernetes modules. |
| `ansible\requirements.yml` | 3 | Pins the `kubernetes.core` Ansible Collection. |
| `ansible\templates\k3s-server-config.yaml.j2` | 11 | Renders first-server or joining-server K3s configuration with encryption, TLS SAN, labels, and secure Kubeconfig mode. |

### What Sherlyn must understand

1. Inventory, variables, templates, modules, tasks, handlers, blocks, and rescue blocks.
2. Idempotency: repeated runs should converge on the same desired state.
3. Why credentials are read from environment variables and protected with `no_log`.
4. Kustomize rendering followed by one server-side `kubectl apply` operation.
5. Retries and delays used when the small K3s server is temporarily busy.
6. Rollout verification, public health verification, failure-log capture, and automatic rollback.

### Presentation evidence

- Walk through `deploy.yml` as: validate -> connect -> create secrets -> render -> apply -> wait -> verify -> rescue.
- Explain why Ansible runs locally on the self-hosted runner while Kubernetes is controlled through Kubeconfig.

---

## 5. Chong Khen - Trivy Security and Quality Testing

### Learning objective

Chong Khen should be able to explain how the pipeline blocks unsafe source/configuration and unsafe container images before deployment, and how the assigned regression tests support the quality gate.

### Security and quality files

| Path or section | Effective lines | What the code does |
|---|---:|---|
| `.github\actionlint.yaml` | 3 | Declares the custom `butler-k3s` self-hosted runner label so workflow linting accepts it. |
| `.github\workflows\ci-cd.yml` lines 42-44 | Part of 23 | Runs actionlint against the GitHub Actions workflow. |
| `.github\workflows\ci-cd.yml` lines 58-60 | Part of 23 | Runs production dependency audit and blocks high-severity vulnerabilities. |
| `.github\workflows\ci-cd.yml` lines 62-72 | Part of 23 | Runs Trivy filesystem vulnerability, secret, and misconfiguration scanners. |
| `.github\workflows\ci-cd.yml` lines 233-242 | Part of 23 | Scans the final candidate Docker image before GHCR publishing. |
| `.dockerignore` | 18 | Prevents secrets, Git data, tests, deployment files, and unnecessary artifacts from entering the Docker build context. |
| `.gitignore` | 19 | Prevents environment files, private keys, Kubeconfigs, real inventory, logs, uploads, and build artifacts from being committed. |
| `ci-validate.mjs` | 161 | Enforces required deployment files, route mounting, authentication guards, account isolation, environment documentation, and supported action versions. |

### Assigned test files

| Path | Effective lines | What the tests verify |
|---|---:|---|
| `test\auth-session.test.js` | 69 | Session-token cookies, MongoDB-backed sessions, public route boundaries, and opt-in demo authentication. |
| `test\calendar-workspace.test.js` | 79 | Calendar navigation, selected-date behavior, labels, event counts, and create-event behavior. |
| `test\chat-regressions.test.js` | 127 | Safe state serialization, concurrent-send prevention, Markdown safety, idempotency, identity scope, and OTP requirements. |
| `test\create-action-behavior.test.js` | 157 | Validates calendar/task create payloads, ownership, idempotency keys, and validation failures. |
| `test\document-decode.test.js` | 28 | UTF-8/UTF-16 decoding and rejection of unsupported binary formats. |
| `test\markdown-renderer.test.js` | 74 | Safe Markdown rendering, HTML escaping, safe links, tables, and notes preview behavior. |
| `test\metrics.test.js` | 18 | Stable Prometheus route labels and the live database-connection metric. |
| `test\note-pinned-filter.test.js` | 79 | Pinned-note navigation, selected filters, refresh behavior, counts, links, and fallbacks. |
| **Assigned total** | **855** | 224 security/configuration lines + 631 test lines. |

### What Chong Khen must understand

1. The difference between `scan-type: fs` and `scan-type: image`.
2. `vuln`, `secret`, and `misconfig` scanners.
3. Why severity is limited to HIGH/CRITICAL and `exit-code: 1` blocks the pipeline.
4. Why `ignore-unfixed: true` avoids blocking on vulnerabilities that have no available fix.
5. The difference between npm audit, actionlint, Trivy, structural validation, and automated tests.

### Presentation evidence

- Point to both Trivy locations in the workflow.
- Explain that the first scan protects source/configuration and the second protects the exact container image.
- Explain how any failed gate prevents GHCR publishing and deployment.

---

## 6. HeinThuNyiNyi - Automated Testing

### Learning objective

HeinThuNyiNyi should be able to explain the assigned test suites, how Node's test runner executes them, what regressions they prevent, and how test failure stops the delivery process.

### Assigned test files

| Path | Effective lines | What the tests verify |
|---|---:|---|
| `test\agent-task-summary.test.js` | 241 | Deterministic task summaries, partial updates, Agent capability registration/execution, browser tool behavior, and mock mode. |
| `test\api-create-operation.test.js` | 55 | Shared retry-safe create operations for tasks and calendar events. |
| `test\idempotency-key-defaults.test.js` | 32 | Unique generated keys and preservation of caller-provided retry keys. |
| `test\preferences-appearance.test.js` | 117 | Appearance controls, safe color allow-listing, persistence, reset behavior, cross-tab synchronization, and accessible contrast. |
| `test\profile-avatar.test.js` | 17 | Supported image signatures and rejection of MIME spoofing or unsupported content. |
| `test\study-briefing.test.js` | 109 | Cross-module study briefings, Agent capability execution, and account-scoped loading. |
| `test\task-completion-analytics.test.js` | 47 | Durable completion timestamps and analytics consistency after task updates. |
| `test\task-workspace.test.js` | 87 | Task filters, calendar integration, empty states, focused views, and create-dialog styles. |
| `test\ui-action-contracts.test.js` | 150 | Ensures buttons and controls have real JavaScript/API behavior and valid fallback routes. |
| **Assigned total** | **855** | Nine test files. |

### What HeinThuNyiNyi must understand

1. How `node --test` discovers and executes the test files.
2. Arrange, Act, Assert structure and why tests should be deterministic.
3. Unit tests versus integration/regression/contract tests.
4. Why account scoping, idempotency, safe rendering, and UI action contracts are important regressions.
5. How `npm run test:ci` combines structural validation with all 70 automated tests.

### Presentation evidence

- Show the GitHub Actions test output with `70 passed, 0 failed`.
- Select two representative test files and explain the setup, action, and assertion.
- Explain that the `publish` job cannot run if tests fail.

---

## Shared End-to-End Story

Every member should understand this sequence even when presenting only one section:

```text
Developer push / pull request
        -> quality and security gates
        -> automated tests
        -> Docker Compose smoke test
        -> immutable Docker image
        -> GHCR publish
        -> staging deployment
        -> staging health verification
        -> production deployment
        -> production health verification
        -> Prometheus remote write
        -> Grafana Cloud monitoring
```

## Presentation Rules

1. Do not expose any passwords, API keys, tokens, private keys, raw Secrets, or private inventory contents.
2. Explain outcomes and reasons, not every YAML line.
3. Each presenter should show one real piece of evidence: a workflow job, test result, Kubernetes resource, deployment result, or Grafana metric.
4. Use screenshots as a backup for all live demonstrations.
5. Use the agreed contribution percentages; do not attempt to derive them directly from file line counts.

## Current Verification Evidence

- 70 automated tests passed.
- Both Docker Compose configurations parsed successfully.
- Staging and production Kustomize overlays rendered successfully.
- GitHub pull-request checks passed with no failures.
