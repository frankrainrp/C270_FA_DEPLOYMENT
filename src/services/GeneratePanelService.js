// ============================================================
// src/services/GeneratePanelService.js
//
// Business logic for AI Generated Panels.
//
// Responsible for:
// - Creating generated panels
// - Running research
// - Building visualizations
// - Saving generated dashboards
//
// ============================================================

const GeneratedPanel = require("../models/GeneratedPanelModel");

const ResearchService = require("./ResearchService");
const VisualizationService = require("./VisualizationService");

/**
 * Get all generated panels.
 * @param {String} ownerId
 * @returns {Promise<Array>}
 */
async function getGeneratedPanels(ownerId) {

    return await GeneratedPanel.find({
        ownerId
    }).sort({
        createdAt: -1
    });

}

/**
 * Get one generated panel.
 * @param {String} panelId
 * @returns {Promise<Object>}
 */
async function getGeneratedPanelById(panelId) {

    return await GeneratedPanel.findById(panelId);

}

/**
 * Delete generated panel.
 * @param {String} panelId
 * @returns {Promise<Object>}
 */
async function deleteGeneratedPanel(panelId) {

    const panel = await GeneratedPanel.findById(panelId);

    if (!panel) {
        throw new Error("Generated panel not found.");
    }

    await panel.deleteOne();

    return panel;

}

/**
 * Generate a dashboard panel.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function generatePanel(data) {

    //--------------------------------------------------
    // Create research summary
    //--------------------------------------------------

    const summary =
        `Dashboard generated from prompt: "${data.prompt}"`;

    //--------------------------------------------------
    // Placeholder widgets
    //--------------------------------------------------

    const widgets = [

        VisualizationService.buildKPI(
            "Items",
            0
        ),

        {
            title: "Summary",

            type: "summary",

            data: {
                text: summary
            }
        }

    ];

    //--------------------------------------------------
    // Create generated panel
    //--------------------------------------------------

    const panel = new GeneratedPanel({

        ownerId: data.ownerId,

        prompt: data.prompt,

        title:
            data.title || "Generated Dashboard",

        widgets,

        source: "AI",

        status: "completed"

    });

    await panel.save();

    return panel;

}

/**
 * Convert research into a generated panel.
 * @param {String} researchId
 * @returns {Promise<Object>}
 */
async function generatePanelFromResearch(researchId) {

    const research =
        await ResearchService.getResearchById(researchId);

    if (!research) {
        throw new Error("Research not found.");
    }

    const widgets = [];

    //--------------------------------------------------
    // Summary widget
    //--------------------------------------------------

    widgets.push({

        title: "Summary",

        type: "summary",

        data: {
            text: research.summary
        }

    });

    //--------------------------------------------------
    // Findings table
    //--------------------------------------------------

    widgets.push(

        VisualizationService.buildTable(
            research.findings
        )

    );

    //--------------------------------------------------
    // Save panel
    //--------------------------------------------------

    const panel = new GeneratedPanel({

        ownerId: research.ownerId,

        prompt: research.prompt,

        title: research.title,

        widgets,

        source: "Research",

        status: "completed"

    });

    await panel.save();

    return panel;

}

module.exports = {

    getGeneratedPanels,

    getGeneratedPanelById,

    deleteGeneratedPanel,

    generatePanel,

    generatePanelFromResearch

};