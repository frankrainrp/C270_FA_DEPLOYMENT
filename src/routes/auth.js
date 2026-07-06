const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();

router.get('/login', (req, res) => res.render('auth/login', { title: 'Butler Login' }));
router.post('/login', (req, res) => {
    // Simulated auth check
    const token = jwt.sign({ id: 1, email: req.body.email }, process.env.JWT_SECRET || 'secret');
    res.cookie('butler_session', token, { httpOnly: true }).redirect('/study/dashboard');
});
router.get('/logout', (req, res) => res.clearCookie('butler_session').redirect('/auth/login'));
module.exports = router;