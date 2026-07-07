const express = require('express');
const router = express.Router();

// TEMPORARY placeholder user data.
// LATER: replace with real data from the User database (Member 2's model).
const demoUser = {
  name: "Student",
  plan: "Free",
  credits: 1450,
};

// The membership plans on offer
const plans = [
  { name: "Free",    price: "$0",     credits: 1500,  perks: ["1,500 AI credits/month", "Basic study tools"] },
  { name: "Pro",     price: "$9.90",  credits: 5000,  perks: ["5,000 AI credits/month", "Priority AI responses", "All study tools"] },
  { name: "Premium", price: "$19.90", credits: 15000, perks: ["15,000 AI credits/month", "Fastest AI", "Everything in Pro", "Early features"] },
];

// Settings & Billing page
router.get('/settings', (req, res) => {
  res.render('billing/settings', { title: 'Settings & Billing', user: demoUser });
});

// Test: spend 10 credits
router.post('/use-credit', (req, res) => {
  if (demoUser.credits >= 10) demoUser.credits -= 10;
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

module.exports = router;