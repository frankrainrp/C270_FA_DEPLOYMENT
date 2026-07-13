// ============================================================
// src/routes/api/research.js
//
// API routes for Research.
//
// Endpoints:
//
// GET    /api/research
// GET    /api/research/:id
// POST   /api/research
// PUT    /api/research/:id
// DELETE /api/research/:id
// POST   /api/research/:id/generate
//
// ============================================================

const express = require("express");

const {

    getResearch,

    getResearchById,

    createResearch,

    updateResearch,

    deleteResearch,

    generateResearch

} = require("../../services/ResearchService");

const router = express.Router();

/**
 * Get all research.
 */
router.get("/", async (req, res, next) => {

    try {

        const ownerId = req.query.ownerId;

        const research = await getResearch(ownerId);

        res.json(research);

    }
    catch (err) {

        next(err);

    }

});

/**
 * Get one research item.
 */
router.get("/:id", async (req, res, next) => {

    try {

        const research = await getResearchById(req.params.id);

        if (!research) {

            return res.status(404).json({

                message: "Research not found."

            });

        }

        res.json(research);

    }
    catch (err) {

        next(err);

    }

});

/**
 * Create research.
 */
router.post("/", async (req, res, next) => {

    try {

        const research = await createResearch(req.body);

        res.status(201).json(research);

    }
    catch (err) {

        next(err);

    }

});

/**
 * Update research.
 */
router.put("/:id", async (req, res, next) => {

    try {

        const research = await updateResearch(

            req.params.id,

            req.body

        );

        res.json(research);

    }
    catch (err) {

        next(err);

    }

});

/**
 * Delete research.
 */
router.delete("/:id", async (req, res, next) => {

    try {

        await deleteResearch(req.params.id);

        res.json({

            message: "Research deleted successfully."

        });

    }
    catch (err) {

        next(err);

    }

});

/**
 * Generate AI research.
 */
router.post("/:id/generate", async (req, res, next) => {

    try {

        const research = await generateResearch(req.params.id);

        res.json(research);

    }
    catch (err) {

        next(err);

    }

});

module.exports = router;