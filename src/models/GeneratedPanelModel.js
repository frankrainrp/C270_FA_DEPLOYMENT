// ============================================================
// src/models/GeneratedPanelModel.js
//
// Stores AI-generated dashboard panels.
//
// These panels are created from prompts, research,
// or external data sources before being displayed
// to the user.
//
// ============================================================

const mongoose = require("mongoose");

/**
 * Widget schema.
 * Each generated panel can contain multiple widgets.
 */
const WidgetSchema = new mongoose.Schema({

    // Widget title
    title: {
        type: String,
        default: ""
    },

    // Widget type
    type: {
        type: String,
        enum: [
            "chart",
            "table",
            "kpi",
            "summary",
            "markdown"
        ],
        required: true
    },

    // Widget content
    data: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }

},
{
    _id: false
});

/**
 * Generated Panel schema.
 */
const GeneratedPanelSchema = new mongoose.Schema({

    // User that generated this panel
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // User prompt
    prompt: {
        type: String,
        required: true,
        trim: true
    },

    // Panel title
    title: {
        type: String,
        default: "Generated Dashboard"
    },

    // Generated widgets
    widgets: {
        type: [WidgetSchema],
        default: []
    },

    // Data source used
    source: {
        type: String,
        default: "AI"
    },

    // Generation status
    status: {
        type: String,
        enum: [
            "pending",
            "completed",
            "failed"
        ],
        default: "pending"
    },

    // Error message (if generation failed)
    error: {
        type: String,
        default: ""
    }

},
{
    timestamps: true
});

module.exports = mongoose.model(
    "GeneratedPanel",
    GeneratedPanelSchema
);