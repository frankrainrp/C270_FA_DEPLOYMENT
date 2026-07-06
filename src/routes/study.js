const express = require('express'); const router = express.Router();
const Task = require('../models/Task');
router.get('/dashboard', async (req, res) => {
    const tasks = await Task.find();
    res.render('layout', { title: 'Study Hub', tasks, body: '<%- include("study/dashboard") %>' });
});
module.exports = router;