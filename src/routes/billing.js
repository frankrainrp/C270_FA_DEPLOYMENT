const express = require('express');
const router = express.Router();

router.get('/settings', (req, res) => {
  res.render('billing/settings', { title: 'Settings & Billing' });
});

module.exports = router;