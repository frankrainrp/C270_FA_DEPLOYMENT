// ============================================================
// src/models/CustomPanelModel.js
//
// Stores user-created dashboard panels.
//
// A custom panel represents one widget on a dashboard.
// It may be a chart, markdown note, table, KPI card,
// iframe, module or AI-generated content.
//
// ============================================================

const mongoose = require("mongoose");

/**
 * Dashboard layout information.
 * Used by the frontend to position widgets.
 */
const LayoutSchema = new mongoose.Schema(
{
    x: {
        type: Number,
        default: 0
    },

    y: {
        type: Number,
        default: 0
    },

    width: {
        type: Number,
        default: 4
    },

    height: {
        type: Number,
        default: 4
    }

},
{
    _id: false
});

/**
 * Main Custom Panel schema.
 */
const CustomPanelSchema = new mongoose.Schema({

    // Owner of this panel
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Panel title
    title: {
        type: String,
        required: true,
        trim: true
    },

    // Small dashboard icon
    icon: {
        type: String,
        default: "📊"
    },

    // Panel type
    type: {
        type: String,
        enum: [
            "markdown",
            "table",
            "chart",
            "kpi",
            "iframe",
            "module",
            "generated"
        ],
        default: "markdown"
    },

    // Panel content
    content: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Dashboard position
    layout: {
        type: LayoutSchema,
        default: () => ({})
    },

    // Optional colour
    colour: {
        type: String,
        default: "#ffffff"
    },

    // Optional tags
    tags: {
        type: [String],
        default: []
    },

    // Favourite panel
    favourite: {
        type: Boolean,
        default: false
    },

    // Soft delete
    deleted: {
        type: Boolean,
        default: false
    }

},
{
    timestamps: true
});

module.exports = mongoose.model(
    "CustomPanel",
    CustomPanelSchema
);