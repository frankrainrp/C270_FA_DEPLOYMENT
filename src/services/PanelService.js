// ============================================================
// src/services/PanelService.js
//
// Business logic for Custom Panels.
//
// Responsible for:
// - Creating panels
// - Retrieving panels
// - Updating panels
// - Deleting panels
//
// ============================================================

const CustomPanel = require("../models/CustomPanelModel");

/**
 * Get all panels for a user.
 */
async function getPanels(ownerId) {

    return await CustomPanel.find({
        ownerId,
        deleted: false
    })
    .sort({
        updatedAt: -1
    });

}

/**
 * Get a single panel.
 */
async function getPanelById(panelId) {

    return await CustomPanel.findOne({
        _id: panelId,
        deleted: false
    });

}

/**
 * Create a new panel.
 */
async function createPanel(data) {

    const panel = new CustomPanel({

        ownerId: data.ownerId,

        title: data.title,

        icon: data.icon,

        type: data.type,

        content: data.content,

        layout: data.layout,

        colour: data.colour,

        tags: data.tags

    });

    await panel.save();

    return panel;

}

/**
 * Update an existing panel.
 */
async function updatePanel(panelId, updates) {

    const panel = await CustomPanel.findOne({
        _id: panelId,
        deleted: false
    });

    if (!panel) {
        throw new Error("Panel not found.");
    }

    Object.assign(panel, updates);

    await panel.save();

    return panel;

}

/**
 * Soft delete a panel.
 */
async function deletePanel(panelId) {

    const panel = await CustomPanel.findOne({
        _id: panelId,
        deleted: false
    });

    if (!panel) {
        throw new Error("Panel not found.");
    }

    panel.deleted = true;

    await panel.save();

    return panel;

}

/**
 * Toggle favourite.
 */
async function toggleFavourite(panelId) {

    const panel = await CustomPanel.findOne({
        _id: panelId,
        deleted: false
    });

    if (!panel) {
        throw new Error("Panel not found.");
    }

    panel.favourite = !panel.favourite;

    await panel.save();

    return panel;

}

module.exports = {

    getPanels,

    getPanelById,

    createPanel,

    updatePanel,

    deletePanel,

    toggleFavourite

};