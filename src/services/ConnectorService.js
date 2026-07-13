// ============================================================
// src/services/ConnectorService.js
//
// Business logic for API Connectors.
//
// Responsible for:
// - Creating connectors
// - Retrieving connectors
// - Updating connectors
// - Deleting connectors
// - Fetching external API data
//
// ============================================================

const Connector = require("../models/ConnectorModel");

/**
 * Get all connectors for a user.
 * @param {String} ownerId
 * @returns {Promise<Array>}
 */
async function getConnectors(ownerId) {

    return await Connector.find({
        ownerId
    }).sort({
        updatedAt: -1
    });

}

/**
 * Get one connector.
 * @param {String} connectorId
 * @returns {Promise<Object>}
 */
async function getConnectorById(connectorId) {

    return await Connector.findById(connectorId);

}

/**
 * Create a connector.
 * @param {Object} data
 * @returns {Promise<Object>}
 */
async function createConnector(data) {

    const connector = new Connector({

        ownerId: data.ownerId,

        name: data.name,

        description: data.description,

        baseUrl: data.baseUrl,

        method: data.method,

        headers: data.headers,

        query: data.query,

        body: data.body,

        auth: data.auth

    });

    await connector.save();

    return connector;

}

/**
 * Update a connector.
 * @param {String} connectorId
 * @param {Object} updates
 * @returns {Promise<Object>}
 */
async function updateConnector(connectorId, updates) {

    const connector = await Connector.findById(connectorId);

    if (!connector) {
        throw new Error("Connector not found.");
    }

    Object.assign(connector, updates);

    await connector.save();

    return connector;

}

/**
 * Delete a connector.
 * @param {String} connectorId
 * @returns {Promise<Object>}
 */
async function deleteConnector(connectorId) {

    const connector = await Connector.findById(connectorId);

    if (!connector) {
        throw new Error("Connector not found.");
    }

    await connector.deleteOne();

    return connector;

}

/**
 * Fetch data from an external API.
 * @param {String} connectorId
 * @returns {Promise<Object>}
 */
async function fetchConnectorData(connectorId) {

    const connector = await Connector.findById(connectorId);

    if (!connector) {
        throw new Error("Connector not found.");
    }

    if (!connector.enabled) {
        throw new Error("Connector is disabled.");
    }

    //--------------------------------------------------------
    // Build request URL
    //--------------------------------------------------------

    const url = new URL(connector.baseUrl);

    connector.query.forEach(param => {
        url.searchParams.append(param.key, param.value);
    });

    //--------------------------------------------------------
    // Build request headers
    //--------------------------------------------------------

    const headers = {};

    connector.headers.forEach(header => {
        headers[header.key] = header.value;
    });

    //--------------------------------------------------------
    // Authentication
    //--------------------------------------------------------

    if (connector.auth.type === "apikey") {

        headers["X-API-Key"] = connector.auth.value;

    }

    if (connector.auth.type === "bearer") {

        headers["Authorization"] =
            `Bearer ${connector.auth.value}`;

    }

    //--------------------------------------------------------
    // Execute request
    //--------------------------------------------------------

    const response = await fetch(url.toString(), {

        method: connector.method,

        headers,

        body:
            connector.method === "GET"
                ? undefined
                : JSON.stringify(connector.body)

    });

    if (!response.ok) {

        throw new Error(
            `API request failed (${response.status})`
        );

    }

    const data = await response.json();

    //--------------------------------------------------------
    // Save last successful connection
    //--------------------------------------------------------

    connector.lastConnected = new Date();

    await connector.save();

    return data;

}

module.exports = {

    getConnectors,

    getConnectorById,

    createConnector,

    updateConnector,

    deleteConnector,

    fetchConnectorData

};