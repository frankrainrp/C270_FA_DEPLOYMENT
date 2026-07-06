const jwt = require('jsonwebtoken');
exports.requireAuth = (req, res, next) => {
    const token = req.cookies.butler_session;
    if (!token) return res.redirect('/auth/login');
    try {
        req.user = jwt.verify(token, process.env.JWT_SECRET || 'secret');
        next();
    } catch (err) {
        res.redirect('/auth/login');
    }
};