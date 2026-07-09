// ============================================================
// src/routes/api/visualization.js
//
// API routes for Visualization.
//
// Endpoints:
//
// POST /api/visualization/bar
// POST /api/visualization/pie
// POST /api/visualization/line
// POST /api/visualization/kpi
// POST /api/visualization/table
// POST /api/visualization/summary
//
// ============================================================

const express = require("express");

const {

    buildBarChart,

    buildPieChart,

    buildLineChart,

    buildKPI,

    buildTable,

    buildSummary,

    suggestChart

} = require("../../services/VisualizationService");

const router = express.Router();

router.post("/bar", async (req, res, next) => {

    try {

        const chart = buildBarChart(

            req.body.data,

            req.body.labelField,

            req.body.valueField

        );

        res.json(chart);

    }
    catch (err) {

        next(err);

    }

});

router.post("/pie", async (req, res, next) => {

    try {

        const chart = buildPieChart(

            req.body.data,

            req.body.labelField,

            req.body.valueField

        );

        res.json(chart);

    }
    catch (err) {

        next(err);

    }

});

router.post("/line", async (req, res, next) => {

    try {

        const chart = buildLineChart(

            req.body.data,

            req.body.labelField,

            req.body.valueField

        );

        res.json(chart);

    }
    catch (err) {

        next(err);

    }

});

router.post("/kpi", async (req, res, next) => {

    try {

        const chart = buildKPI(

            req.body.title,

            req.body.value

        );

        res.json(chart);

    }
    catch (err) {

        next(err);

    }

});

router.post("/table", async (req, res, next) => {

    try {

        const table = buildTable(req.body.data);

        res.json(table);

    }
    catch (err) {

        next(err);

    }

});

router.post("/summary", async (req, res, next) => {

    try {

        const summary = buildSummary(

            req.body.data,

            req.body.valueField

        );

        res.json({

            summary,

            suggestedChart: suggestChart(req.body.data)

        });

    }
    catch (err) {

        next(err);

    }

});

module.exports = router;