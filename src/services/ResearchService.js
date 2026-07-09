// ============================================================
// src/services/ResearchService.js
//
// Business logic for Research.
//
// Responsible for:
// - Creating research
// - Retrieving research
// - Updating research
// - Deleting research
// - Generating structured findings
//
// ============================================================

const Research = require("../models/ResearchModel");

/**
 * Get all research for a user.
 * @param {String} ownerId
 * @returns {Promise<Array>}
 */
async function getResearch(ownerId) {

    return await Research.find({
        ownerId
    }).sort({
        updatedAt: -1
    });

}

/**
 * Get one research item.
 * @param {String} researchId
 * @returns {Promise<Object>}
 */
async function getResearchById(researchId) {

    return await Research.findById(researchId);

}

/**
 * Create new research.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createResearch(data) {

    const research = new Research({

        ownerId: data.ownerId,

        title: data.title,

        prompt: data.prompt,

        summary: "",

        findings: [],

        suggestedCharts: [],

        status: "pending"

    });

    await research.save();

    return research;

}

/**
 * Update research.
 * @param {String} researchId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateResearch(researchId, updates) {

    const research = await Research.findById(researchId);

    if (!research) {
        throw new Error("Research not found.");
    }

    Object.assign(research, updates);

    await research.save();

    return research;

}

/**
 * Delete research.
 * @param {String} researchId
 * @returns {Promise<Object>}
 */
async function deleteResearch(researchId) {

    const research = await Research.findById(researchId);

    if (!research) {
        throw new Error("Research not found.");
    }

    await research.deleteOne();

    return research;

}

/**
 * Generate structured research.
 * (Placeholder until AI integration)
 * @param {String} researchId
 * @returns {Promise<Object>}
 */
async function generateResearch(researchId) {

    const research = await Research.findById(researchId);

    if (!research) {
        throw new Error("Research not found.");
    }

    research.summary =
        `Summary for "${research.title}".`;

    research.findings = [

        {
            title: "Background",
            description:
                "Provides an overview of the research topic."
        },

        {
            title: "Key Insights",
            description:
                "Highlights important trends and findings."
        },

        {
            title: "Recommendations",
            description:
                "Suggests possible actions based on the findings."
        }

    ];

    research.suggestedCharts = [

        "bar",

        "pie",

        "table"

    ];

    research.status = "completed";

    await research.save();

    return research;

}

module.exports = {

    getResearch,

    getResearchById,

    createResearch,

    updateResearch,

    deleteResearch,

    generateResearch

};