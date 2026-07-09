// ============================================================
// src/routes/api/generatePanel.js
//
// API routes for AI Generated Panels.
//
// Endpoints:
//
// GET    /api/generate-panel
// GET    /api/generate-panel/:id
// POST   /api/generate-panel
// POST   /api/generate-panel/research/:researchId
// DELETE /api/generate-panel/:id
//
// ============================================================

const express = require("express");

const {

    getGeneratedPanels,

    getGeneratedPanelById,

    generatePanel,

    generatePanelFromResearch,

    deleteGeneratedPanel

} = require("../../services/GeneratePanelService");

const router = express.Router();

/**
 * GET /
 * Get all generated panels.
 */
router.get("/", async (req, res, next) => {

    try {

        const ownerId = req.query.ownerId;

        const panels = await getGeneratedPanels(ownerId);

        res.json(panels);

    }
    catch (err) {

        next(err);

    }

});

/**
 * GET /:id
 * Get one generated panel.
 */
router.get("/:id", async (req, res, next) => {

    try {

        const panel = await getGeneratedPanelById(req.params.id);

        if (!panel) {

            return res.status(404).json({

                message: "Generated panel not found."

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
 * Generate a new dashboard panel.
 */
router.post("/", async (req, res, next) => {

    try {

        const panel = await generatePanel(req.body);

        res.status(201).json(panel);

    }
    catch (err) {

        next(err);

    }

});

/**
 * POST /research/:researchId
 * Generate a panel from research.
 */
router.post("/research/:researchId", async (req, res, next) => {

    try {

        const panel = await generatePanelFromResearch(

            req.params.researchId

        );

        res.status(201).json(panel);

    }
    catch (err) {

        next(err);

    }

});

/**
 * DELETE /:id
 * Delete a generated panel.
 */
router.delete("/:id", async (req, res, next) => {

    try {

        await deleteGeneratedPanel(req.params.id);

        res.json({

            message: "Generated panel deleted successfully."

        });

    }
    catch (err) {

        next(err);

    }

});

module.exports = router;