// ============================================================
// src/routes/api/panels.js
//
// API routes for Custom Panels.
//
// Endpoints:
//
// GET    /api/panels
// GET    /api/panels/:id
// POST   /api/panels
// PUT    /api/panels/:id
// DELETE /api/panels/:id
// PATCH  /api/panels/:id/favourite
//
// ============================================================

const express = require("express");

const {

    getPanels,

    getPanelById,

    createPanel,

    updatePanel,

    deletePanel,

    toggleFavourite

} = require("../../services/PanelService");

const router = express.Router();

/**
 * GET /
 * Get all panels for a user.
 */
router.get("/", async (req, res, next) => {

    try {

        const ownerId = req.query.ownerId;

        const panels = await getPanels(ownerId);

        res.json(panels);

    }
    catch (err) {

        next(err);

    }

});

/**
 * GET /:id
 * Get a single panel.
 */
router.get("/:id", async (req, res, next) => {

    try {

        const panel = await getPanelById(req.params.id);

        if (!panel) {

            return res.status(404).json({

                message: "Panel not found."

            });

        }

        res.json(panel);

    }
    catch (err) {

        next(err);

    }

});

/**
 * POST /
 * Create a new panel.
 */
router.post("/", async (req, res, next) => {

    try {

        const panel = await createPanel(req.body);

        res.status(201).json(panel);

    }
    catch (err) {

        next(err);

    }

});

/**
 * PUT /:id
 * Update a panel.
 */
router.put("/:id", async (req, res, next) => {

    try {

        const panel = await updatePanel(

            req.params.id,

            req.body

        );

        res.json(panel);

    }
    catch (err) {

        next(err);

    }

});

/**
 * DELETE /:id
 * Delete a panel.
 */
router.delete("/:id", async (req, res, next) => {

    try {

        await deletePanel(req.params.id);

        res.json({

            message: "Panel deleted successfully."

        });

    }
    catch (err) {

        next(err);

    }

});

/**
 * PATCH /:id/favourite
 * Toggle favourite status.
 */
router.patch("/:id/favourite", async (req, res, next) => {

    try {

        const panel = await toggleFavourite(

            req.params.id

        );

        res.json(panel);

    }
    catch (err) {

        next(err);

    }

});

module.exports = router;