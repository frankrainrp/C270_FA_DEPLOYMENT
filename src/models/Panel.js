const mongoose = require('mongoose'); 
module.exports = mongoose.model('Panel', new mongoose.Schema({ title: String, config: Object }));