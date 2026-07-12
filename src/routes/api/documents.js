const express = require("express");
const multer = require("multer");

const { makeOk, makeFail } = require("../../lib/apiResponse");
const { extractText } = require("../../services/DocumentDecodeService");

const router = express.Router();

function maxUploadBytes() {
  const megabytes = Number(process.env.DOCUMENT_MAX_MB);
  const safeMegabytes = Number.isFinite(megabytes) && megabytes > 0 ? megabytes : 10;
  return Math.floor(safeMegabytes * 1024 * 1024);
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: maxUploadBytes() },
});

router.post("/decode", (req, res) => {
  upload.single("document")(req, res, async (uploadError) => {
    if (uploadError) {
      const message = uploadError.code === "LIMIT_FILE_SIZE"
        ? `Document exceeds the ${process.env.DOCUMENT_MAX_MB || 10} MB limit.`
        : uploadError.message;
      return res.status(400).json(makeFail(message));
    }
    if (!req.file) {
      return res.status(400).json(makeFail("A document file is required."));
    }

    try {
      const document = await extractText(req.file);
      return res.json(makeOk({ document }));
    } catch (err) {
      return res.status(422).json(makeFail(err.message));
    }
  });
});

module.exports = router;
