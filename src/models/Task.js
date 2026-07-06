const mongoose = require('mongoose'); 
module.exports = mongoose.model('Task', new mongoose.Schema({ title: String, completed: Boolean, category: String }));