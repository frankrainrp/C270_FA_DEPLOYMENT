// ============================================================
// src/models/ConnectorModel.js
//
// Stores external API connector configurations.
//
// Connectors allow the application to safely connect to
// third-party APIs and provide data for generated panels,
// dashboards and research.
//
// ============================================================

const mongoose = require("mongoose");

/**
 * Header schema
 * Stores HTTP request headers.
 */
const HeaderSchema = new mongoose.Schema({

    key: {
        type: String,
        required: true,
        trim: true
    },

    value: {
        type: String,
        default: ""
    }

},
{
    _id: false
});

/**
 * Query parameter schema
 */
const QuerySchema = new mongoose.Schema({

    key: {
        type: String,
        required: true,
        trim: true
    },

    value: {
        type: String,
        default: ""
    }

},
{
    _id: false
});

/**
 * Connector schema
 */
const ConnectorSchema = new mongoose.Schema({

    // User that owns this connector
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    // Friendly connector name
    name: {
        type: String,
        required: true,
        trim: true
    },

    // Description
    description: {
        type: String,
        default: ""
    },

    // Base API URL
    baseUrl: {
        type: String,
        required: true,
        trim: true
    },

    // HTTP Method
    method: {
        type: String,
        enum: [
            "GET",
            "POST",
            "PUT",
            "PATCH",
            "DELETE"
        ],
        default: "GET"
    },

    // Request headers
    headers: {
        type: [HeaderSchema],
        default: []
    },

    // Query parameters
    query: {
        type: [QuerySchema],
        default: []
    },

    // Request body
    body: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    },

    // Authentication type
    auth: {
        type: {
            type: String,
            enum: [
                "none",
                "apikey",
                "bearer"
            ],
            default: "none"
        },

        value: {
            type: String,
            default: ""
        }
    },

    // Connector enabled
    enabled: {
        type: Boolean,
        default: true
    },

    // Last successful connection
    lastConnected: {
        type: Date
    }

},
{
    timestamps: true
});

module.exports = mongoose.model(
    "Connector",
    ConnectorSchema
);