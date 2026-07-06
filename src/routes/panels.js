const express = require('express'); const router = express.Router();
router.get('/connectors', (req, res) => res.render('layout', { title: 'Data Panels', body: '<%- include("panels/generated") %>' }));
module.exports = router;