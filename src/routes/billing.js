const express = require('express'); const router = express.Router();
router.get('/settings', (req, res) => res.render('layout', { title: 'Settings & Billing', body: '<%- include("billing/settings") %>' }));
module.exports = router;