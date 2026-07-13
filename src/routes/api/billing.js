// ============================================================
// src/routes/api/billing.js
// Simulated billing & credits (Task 6: Platform / Billing / QA).
// No real payment processor is involved anywhere in this file —
// every "purchase" just adjusts numbers in MongoDB and logs a
// history entry so the Billing page has something real to show.
//
//   GET  /api/billing        -> plan, credit balance, history
//   POST /api/billing/topup  -> simulated credit top-up (whitelisted amounts)
//   POST /api/billing/plan   -> simulated plan change (free/pro/max)
// ============================================================

const express = require("express");
const UserProfileService = require("../../services/UserProfileService");
const { makeOk, makeFail, runSafe } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();
router.use(requireAuthApi);

/**
 * GET /api/billing
 */
router.get("/", runSafe(async (req, res) => {
  const profile = await UserProfileService.getOrCreate(req.sessionUser.email);
  res.json(makeOk({
    plan: profile.plan,
    credits: profile.credits,
    creditsUsed: profile.creditsUsed,
    history: profile.history,
  }));
}));

/**
 * POST /api/billing/topup
 * Body: { amount }  -- must be one of UserProfileService.TOPUP_PRESETS
 */
router.post("/topup", async (req, res) => {
  try {
    const { amount } = req.body;
    const profile = await UserProfileService.addCredits(req.sessionUser.email, amount);
    res.status(201).json(makeOk({
      credits: profile.credits,
      history: profile.history,
    }));
  } catch (err) {
    console.error("[api/billing] topup error:", err);
    res.status(400).json(makeFail(err.message));
  }
});

/**
 * POST /api/billing/plan
 * Body: { plan }  -- one of "free" | "pro" | "max"
 */
router.post("/plan", async (req, res) => {
  try {
    const { plan } = req.body;
    const profile = await UserProfileService.setPlan(req.sessionUser.email, plan);
    res.status(201).json(makeOk({
      plan: profile.plan,
      history: profile.history,
    }));
  } catch (err) {
    console.error("[api/billing] plan change error:", err);
    res.status(400).json(makeFail(err.message));
  }
});

module.exports = router;
