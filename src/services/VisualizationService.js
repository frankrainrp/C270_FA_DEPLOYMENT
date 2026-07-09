// ============================================================
// src/services/VisualizationService.js
//
// Business logic for dashboard visualizations.
//
// Responsible for:
// - Bar charts
// - Pie charts
// - Line charts
// - KPI cards
// - Tables
// - Summary statistics
//
// ============================================================

/**
 * Build a Bar Chart.
 * @param {Array} data
 * @param {String} labelField
 * @param {String} valueField
 * @returns {Object}
 */
function buildBarChart(data, labelField, valueField) {

    return {

        type: "bar",

        labels: data.map(item => item[labelField]),

        datasets: [
            {
                label: valueField,

                data: data.map(item => item[valueField])
            }
        ]

    };

}

/**
 * Build a Pie Chart.
 * @param {Array} data
 * @param {String} labelField
 * @param {String} valueField
 * @returns {Object}
 */
function buildPieChart(data, labelField, valueField) {

    return {

        type: "pie",

        labels: data.map(item => item[labelField]),

        datasets: [
            {
                data: data.map(item => item[valueField])
            }
        ]

    };

}

/**
 * Build a Line Chart.
 * @param {Array} data
 * @param {String} labelField
 * @param {String} valueField
 * @returns {Object}
 */
function buildLineChart(data, labelField, valueField) {

    return {

        type: "line",

        labels: data.map(item => item[labelField]),

        datasets: [
            {
                label: valueField,

                data: data.map(item => item[valueField])
            }
        ]

    };

}

/**
 * Build KPI Card.
 * @param {String} title
 * @param {Number|String} value
 * @returns {Object}
 */
function buildKPI(title, value) {

    return {

        type: "kpi",

        title,

        value

    };

}

/**
 * Build Table.
 * @param {Array} data
 * @returns {Object}
 */
function buildTable(data) {

    return {

        type: "table",

        rows: data

    };

}

/**
 * Build Summary Statistics.
 * @param {Array} data
 * @param {String} valueField
 * @returns {Object}
 */
function buildSummary(data, valueField) {

    const values = data.map(item =>
        Number(item[valueField]) || 0
    );

    const total =
        values.reduce((sum, value) => sum + value, 0);

    const average =
        values.length > 0
            ? total / values.length
            : 0;

    const highest =
        values.length > 0
            ? Math.max(...values)
            : 0;

    const lowest =
        values.length > 0
            ? Math.min(...values)
            : 0;

    return {

        total,

        average,

        highest,

        lowest,

        count: values.length

    };

}

/**
 * Automatically determine the best chart type.
 * @param {Array} data
 * @returns {String}
 */
function suggestChart(data) {

    if (!Array.isArray(data)) {

        return "table";

    }

    if (data.length <= 5) {

        return "pie";

    }

    if (data.length <= 20) {

        return "bar";

    }

    return "line";

}

module.exports = {

    buildBarChart,

    buildPieChart,

    buildLineChart,

    buildKPI,

    buildTable,

    buildSummary,

    suggestChart

};