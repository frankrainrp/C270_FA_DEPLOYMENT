const express = require('express'); const router = express.Router();
router.get('/chat', (req, res) => res.render('layout', { title: 'Butler AI Chat', body: '<%- include("ai/chat") %>' }));
module.exports = router;