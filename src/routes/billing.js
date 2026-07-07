const express = require('express');
const router = express.Router();

// TEMPORARY placeholder user data.
// LATER: replace with real data from the User database (Member 2's model).
const demoUser = {
    name: "Student",
    email: "student@butler.local",
    plan: "Free",
    credits: 1450,
    memberSince: "January 2026",
};

// Simulated AI usage stats (LATER: pull from real usage logs)
const usageStats = {
    messagesThisMonth: 128,
    creditsUsedThisMonth: 640,
};

// The membership plans on offer
const plans = [
  { name: "Free",    price: "$0",     credits: 1500,  perks: ["1,500 AI credits/month", "Basic study tools"] },
  { name: "Pro",     price: "$9.90",  credits: 5000,  perks: ["5,000 AI credits/month", "Priority AI responses", "All study tools"] },
  { name: "Premium", price: "$19.90", credits: 15000, perks: ["15,000 AI credits/month", "Fastest AI", "Everything in Pro", "Early features"] },
];

// Settings & Billing page
router.get('/settings', (req, res) => {
  res.render('billing/settings', { title: 'Settings & Billing', user: demoUser, usage: usageStats });
});

// Test: spend 10 credits
router.post('/use-credit', (req, res) => {
  if (demoUser.credits >= 10) demoUser.credits -= 10;
  res.redirect('/billing/settings');
});

// Save account edits (name / email) — simulated, updates the placeholder user
router.post('/account', (req, res) => {
  if (req.body.name && req.body.name.trim())  demoUser.name  = req.body.name.trim();
  if (req.body.email && req.body.email.trim()) demoUser.email = req.body.email.trim();
  // NOTE: password is simulated only — nothing is stored (no User model yet).
  res.redirect('/billing/settings');
});

// Show the plans page
router.get('/plans', (req, res) => {
  res.render('billing/plans', { title: 'Membership Plans', user: demoUser, plans });
});

// "Buy" a plan (simulated checkout — no real payment)
router.post('/checkout', (req, res) => {
  const chosen = plans.find(p => p.name === req.body.plan);
  if (chosen) {
    demoUser.plan = chosen.name;
    demoUser.credits += chosen.credits; // add the plan's credits as a bonus
  }
  res.redirect('/billing/settings');
});

// Profile page
router.get('/profile', (req, res) => {
  res.render('billing/profile', { title: 'My Profile', user: demoUser });
});
module.exports = router;