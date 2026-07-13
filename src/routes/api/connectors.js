// ============================================================
// src/routes/api/connectors.js
//
// API routes for Connectors.
//
// Endpoints:
//
// GET    /api/connectors
// GET    /api/connectors/:id
// POST   /api/connectors
// PUT    /api/connectors/:id
// DELETE /api/connectors/:id
// GET    /api/connectors/:id/data
//
// ============================================================

const express = require("express");

const {

    getConnectors,

    getConnectorById,

    createConnector,

    updateConnector,

    deleteConnector,

    fetchConnectorData

} = require("../../services/ConnectorService");

const router = express.Router();

/**
 * GET /
 * Get all connectors.
 */
router.get("/", async (req, res, next) => {

    try {

        const ownerId = req.query.ownerId;

        const connectors = await getConnectors(ownerId);

        res.json(connectors);

    }
    catch (err) {

        next(err);

    }

});

/**
 * GET /:id
 * Get a single connector.
 */
router.get("/:id", async (req, res, next) => {

    try {

        const connector = await getConnectorById(req.params.id);

        if (!connector) {

            return res.status(404).json({

                message: "Connector not found."

            });

        }

        res.json(connector);

    }
    catch (err) {

        next(err);

    }

});

/**
 * POST /
 * Create a connector.
 */
router.post("/", async (req, res, next) => {

    try {

        const connector = await createConnector(req.body);

        res.status(201).json(connector);

    }
    catch (err) {

        next(err);

    }

});

/**
 * PUT /:id
 * Update a connector.
 */
router.put("/:id", async (req, res, next) => {

    try {

        const connector = await updateConnector(

            req.params.id,

            req.body

        );

        res.json(connector);

    }
    catch (err) {

        next(err);

    }

});

/**
 * DELETE /:id
 * Delete a connector.
 */
router.delete("/:id", async (req, res, next) => {

    try {

        await deleteConnector(req.params.id);

        res.json({

            message: "Connector deleted successfully."

        });

    }
    catch (err) {

        next(err);

    }

});

/**
 * GET /:id/data
 * Fetch data from the external API.
 */
router.get("/:id/data", async (req, res, next) => {

    try {

        const data = await fetchConnectorData(

            req.params.id

        );

        res.json(data);

    }
    catch (err) {

        next(err);

    }

});

module.exports = router;