// ============================================================
// src/models/ResearchModel.js
//
// Stores research requests and AI-generated findings.
//
// Research can later be converted into generated panels,
// charts or summaries.
//
// ============================================================

const mongoose = require("mongoose");

/**
 * Individual research finding.
 */
const FindingSchema = new mongoose.Schema({

    // Heading of the finding
    title: {
        type: String,
        required: true,
        trim: true
    },

    // Description
    description: {
        type: String,
        default: ""
    },

    // Optional reference/source
    source: {
        type: String,
        default: ""
    }

},
{
    _id: false
});

/**
 * Research schema
 */
const ResearchSchema = new mongoose.Schema({

    // User who owns this research
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Research title
    title: {
        type: String,
        required: true,
        trim: true
    },

    // Original prompt
    prompt: {
        type: String,
        required: true,
        trim: true
    },

    // AI summary
    summary: {
        type: String,
        default: ""
    },

    // Individual findings
    findings: {
        type: [FindingSchema],
        default: []
    },

    // Suggested visualisations
    suggestedCharts: {
        type: [{
            type: String,
            enum: [
                "bar",
                "line",
                "pie",
                "table",
                "kpi",
                "heatmap"
            ]
        }],
        default: []
    },

    // Research status
    status: {
        type: String,
        enum: [
            "pending",
            "processing",
            "completed",
            "failed"
        ],
        default: "pending"
    },

    // Error message if generation fails
    error: {
        type: String,
        default: ""
    }

},
{
    timestamps: true
});

module.exports = mongoose.model(
    "Research",
    ResearchSchema
);