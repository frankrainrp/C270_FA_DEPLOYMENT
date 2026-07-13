// ============================================================
// src/services/BillingService.js
// Simulated billing + subscription plans.
//
// STATUS: intentionally in-memory / mock.  There is no real payment
// gateway wired up yet and no persisted per-user account model.
// This lets the Billing and Pricing pages ship with real UI and a
// working "upgrade" flow while that decision is made later.
//
// TODO (next phase, once login/auth lands):
//   1. Replace `accountState` below with a persisted Mongoose model
//      (e.g. `UserAccount`) keyed by the authenticated user.
//   2. Replace `simulateUpgrade()` with a real checkout call to a
//      payment gateway (e.g. Stripe Checkout Session / webhooks) and
//      only flip the plan once the gateway confirms payment.
//   3. Replace the in-memory `history` array with real invoice
//      records from the gateway.
// ============================================================

// Plan catalog. Prices are in USD/month; "free" has no billing period.
const PLAN_CATALOG = [
  {
    id: "free",
    name: "Free",
    price: 0,
    period: "forever",
    credits: 50,
    tagline: "Enough to try Butler for real coursework.",
    features: [
      "50 AI credits / month",
      "Unlimited tasks, notes, and calendar events",
      "1 document upload per chat message",
      "Paper, Glass, and Dark themes",
    ],
  },
  {
    id: "pro",
    name: "Pro",
    price: 9,
    period: "month",
    credits: 500,
    tagline: "For students who chat with Butler every day.",
    features: [
      "500 AI credits / month",
      "3 document uploads per chat message",
      "Priority response streaming",
      "Everything in Free",
    ],
  },
  {
    id: "max",
    name: "Max",
    price: 19,
    period: "month",
    credits: 2000,
    tagline: "Heaviest users: exam season, group projects, research.",
    features: [
      "2000 AI credits / month",
      "5 document uploads per chat message",
      "Early access to new learning tools",
      "Everything in Pro",
    ],
  },
];

// Simulated single-user account state. Resets whenever the server
// restarts, on purpose, until a real persisted model replaces it.
let accountState = {
  planId: "free",
  creditsUsed: 12,
  renewsOn: null,
  history: [],
};

function findPlan(planId) {
  return PLAN_CATALOG.find((p) => p.id === planId) || PLAN_CATALOG[0];
}

function getPlans() {
  return PLAN_CATALOG;
}

function getAccountSnapshot() {
  const plan = findPlan(accountState.planId);
  const creditsUsed = Math.min(accountState.creditsUsed, plan.credits);
  return {
    plan,
    creditsUsed,
    creditsLimit: plan.credits,
    creditsRemaining: Math.max(plan.credits - creditsUsed, 0),
    renewsOn: accountState.renewsOn,
    history: accountState.history.slice(0, 12),
  };
}

// Simulates a plan change. No real money moves. Marked clearly as a
// stub so it is obvious where a real payment gateway call belongs.
function simulateUpgrade(planId) {
  const plan = findPlan(planId);
  const now = new Date();
  const renewsOn = plan.id === "free" ? null : new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());

  accountState = {
    planId: plan.id,
    // Give the new plan a clean credit cycle.
    creditsUsed: 0,
    renewsOn,
    history: [
      {
        id: "sim_" + now.getTime(),
        date: now,
        description: plan.price > 0 ? `Upgraded to ${plan.name}` : "Switched to Free",
        amount: plan.price,
        status: plan.price > 0 ? "simulated" : "n/a",
      },
      ...accountState.history,
    ],
  };

  return getAccountSnapshot();
}

module.exports = {
  getPlans,
  getAccountSnapshot,
  simulateUpgrade,
};
