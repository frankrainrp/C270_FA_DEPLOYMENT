# 🎩 Butler — DevOps CA2 (Web Application)

Butler is a web-based study and productivity assistant built for our DevOps module (CA2). It combines task/calendar management, an AI agent, data panels, and account/billing features into a single Node.js web app.

> This is the **web/server** version of Butler, built for CA2. It is separate from the earlier React Native mobile version.

---

## 🚀 Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js + Express |
| Database | MongoDB (via Mongoose) |
| Templating | EJS |
| Auth | JWT + cookies |
| Styling | Custom CSS (glassmorphism theme) |
| DevOps (Finals) | Docker, docker-compose, GitHub Actions, Ansible |

---

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v18 or later recommended)
- [MongoDB](https://www.mongodb.com/) running locally or a connection string
- npm (comes with Node.js)

### Installation

```bash
# 1. Clone the repository
git clone https://github.com/HeinThuNyiNyi/butler-devops-CA2.git

# 2. Enter the project folder
cd butler-devops-CA2

# 3. Install dependencies
npm install

# 4. Create a .env file (see below)

# 5. Start the server
npm start
```

The app runs at **http://localhost:3000**.

### Environment Variables

Create a `.env` file in the project root:
> `.env`, `node_modules`, and `uploads` are excluded via `.gitignore`.

---

## 🔑 Demo Login
---

## ✨ Features

- **Tasks & Calendar** — [teammate to fill in]
- **AI Agent** — chat-based AI assistant [teammate to fill in]
- **Data Panels** — [teammate to fill in]
- **Settings & Billing** — AI credits, membership plans (Free / Pro / Premium) with simulated checkout, account management, and preferences
- **AI Usage & Safety** — usage stats and safety controls (content filter, usage reminders, privacy options)
- **Themes** — light / dark mode with a glassmorphism design
- **Language** — English / 中文 support on settings

---

## 📁 Project Structure
---

## ✨ Features

- **Tasks & Calendar** — [teammate to fill in]
- **AI Agent** — chat-based AI assistant [teammate to fill in]
- **Data Panels** — [teammate to fill in]
- **Settings & Billing** — AI credits, membership plans (Free / Pro / Premium) with simulated checkout, account management, and preferences
- **AI Usage & Safety** — usage stats and safety controls (content filter, usage reminders, privacy options)
- **Themes** — light / dark mode with a glassmorphism design
- **Language** — English / 中文 support on settings

---

## 📁 Project Structure
butler-devops-CA2/
├── src/
│   ├── routes/         # Express routes (billing.js, study.js, etc.)
│   ├── views/          # EJS templates
│   │   ├── billing/    # settings, plans, profile
│   │   └── partials/   # shared topbar, layout
│   ├── models/         # Mongoose models
│   └── public/css/     # Stylesheet
├── Dockerfile          # (for Finals)
├── docker-compose.yml  # (for Finals)
├── ci-validate.mjs     # (for Finals)
└── package.json

---

## 👥 Team

| Member | Role |
|---|---|
| [Name] | [Role] |
| [Name] | Login / User database |
| [Name] | Study features (tasks & calendar) |
| Hein Thu Nyi Nyi | Platform / Billing / QA Specialist |
| [Name] | [Role] |
| [Name] | [Role] |

---

## 📝 Notes

- Payment/checkout is **simulated** — no real transactions occur.
- CI/CD, Docker, and Ansible are part of the **Finals** deliverable and are scaffolded but not the focus of CA2.

---

*Built for DevOps CA2 — Republic Polytechnic, Year 2.*
