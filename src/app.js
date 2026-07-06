const express = require('express');
const mongoose = require('mongoose');
const cookieParser = require('cookie-parser');
const path = require('path');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Database Connection
const mongoURI = process.env.MONGO_URI || 'mongodb://localhost:27017/butlerdb';
mongoose.connect(mongoURI).then(() => {
    console.log('MongoDB Connected to ButlerDB');
    require('./services/seeder'); // Seed initial data
}).catch(err => console.log('MongoDB connection pending...'));

// UI Shell / Theme Setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));

// Middleware (AuthGate equivalent)
const { requireAuth } = require('./middleware/authGate');

// Routes mapped to Features
app.use('/auth', require('./routes/auth'));
app.use('/ai', requireAuth, require('./routes/ai'));
app.use('/ocr', requireAuth, require('./routes/ocr'));
app.use('/study', requireAuth, require('./routes/study'));
app.use('/panels', requireAuth, require('./routes/panels'));
app.use('/billing', requireAuth, require('./routes/billing'));

app.get('/', (req, res) => res.redirect('/auth/login'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Butler is running on port ' + PORT));