const express = require("express");
const StudyBriefingService = require("../../services/StudyBriefingService");
const { makeOk, makeFail } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();

router.use(requireAuthApi);

router.get("/", async (req, res) => {
  try {
    const days = Math.min(30, Math.max(1, Number(req.query.days) || 7));
    const briefing = await StudyBriefingService.getBriefing(req.sessionUser.email, days);
    return res.json(makeOk({ briefing }));
  } catch (err) {
    console.error("[api/briefing] GET error:", err);
    return res.status(500).json(makeFail("Study briefing is temporarily unavailable."));
  }
});

module.exports = router;
