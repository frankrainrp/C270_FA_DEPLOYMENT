const mongoose = require('mongoose');
const Task = require('../models/Task');
const Panel = require('../models/Panel');

async function seedData() {
    const taskCount = await Task.countDocuments();
    if (taskCount === 0) {
        await Task.insertMany([
            { title: 'Normalize CostPerPrint and PricePerPrint database fields', completed: false, category: 'Database' },
            { title: 'Draft final slides for administration presentation', completed: false, category: 'Planning' },
            { title: 'Configure Tableau dashboards for student printing logistics', completed: true, category: 'Visualization' }
        ]);
        console.log('Seeded initial study tasks.');
    }
}
seedData();