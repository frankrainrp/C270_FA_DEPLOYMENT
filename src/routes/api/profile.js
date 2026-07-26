// ============================================================
// src/routes/api/profile.js
// User Profile + avatar upload (Task 6: Platform / Billing / QA).
//
//   GET  /api/profile          -> current profile (+ plan/credits)
//   PUT  /api/profile          -> update name / email
//   POST /api/profile/avatar   -> upload + preview an avatar image
//
// Login-aware: if there's a valid session cookie (see AuthService),
// name/email reflect the real logged-in User record and email is
// read-only (it's the verified login identity — changing it here
// wouldn't re-verify it). Without a session, this falls back to the
// account-scoped UserProfile document. Avatar, plan, and credits are
// therefore isolated by the verified session email as well.
//
// Validation ("quality checks") lives at two layers:
//   1. multer fileFilter/limits and image signatures reject the wrong
//      type/size while the upload remains in memory.
//   2. UserProfileService / User / the Mongoose schemas reject bad
//      name/email.
// ============================================================

const express = require("express");
const multer = require("multer");

const UserProfileService = require("../../services/UserProfileService");
const AuthService = require("../../services/AuthService");
const { makeOk, makeFail, runSafe } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();
router.use(requireAuthApi);

// ------------------------------------------------------------------
// Avatars are held in memory while validating and then stored as bounded data
// URLs in MongoDB. Container-local files would be lost or inconsistent across
// Kubernetes replicas, and they would violate the read-only root filesystem.
// ------------------------------------------------------------------
const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

function hasExpectedImageSignature(buffer, mimeType) {
  if (!Buffer.isBuffer(buffer)) return false;
  if (mimeType === "image/png") {
    return buffer.length >= 8
      && buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  }
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/gif") {
    const header = buffer.subarray(0, 6).toString("ascii");
    return header === "GIF87a" || header === "GIF89a";
  }
  if (mimeType === "image/webp") {
    return buffer.length >= 12
      && buffer.subarray(0, 4).toString("ascii") === "RIFF"
      && buffer.subarray(8, 12).toString("ascii") === "WEBP";
  }
  return false;
}

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_AVATAR_BYTES },
  fileFilter: (_req, file, cb) => {
    if (!ALLOWED_MIME.has(file.mimetype)) {
      cb(new Error("Only PNG, JPEG, WEBP or GIF images are allowed."));
      return;
    }
    cb(null, true);
  },
});

/**
 * GET /api/profile
 */
router.get("/", runSafe(async (req, res) => {
  const sessionUser = req.sessionUser;
  const storedProfile = await UserProfileService.getOrCreate(sessionUser.email);
  const profile = {
    name: sessionUser.name,
    email: sessionUser.email,
    avatarUrl: storedProfile.avatarUrl,
    plan: storedProfile.plan,
    credits: storedProfile.credits,
    emailEditable: false,
  };

  res.json(makeOk({ profile }));
}));

/**
 * PUT /api/profile
 * Body: { name, email }
 * Logged in: only `name` is applied (email is read-only).
 * Logged out: existing Task 6 demo behavior — both editable.
 */
router.put("/", async (req, res) => {
  try {
    const { name } = req.body;
    const sessionUser = req.sessionUser;

    if (typeof name !== "undefined" && !String(name).trim()) {
      return res.status(400).json(makeFail("Name cannot be empty."));
    }

    const normalizedName = String(name || "").trim();
    await UserProfileService.updateProfile(sessionUser.email, { name: normalizedName });
    const updatedSession = await AuthService.updateSessionName(req.sessionToken, normalizedName);
    if (!updatedSession) {
      return res.status(401).json(makeFail("Your session expired. Please sign in again."));
    }
    return res.json(makeOk({
      profile: {
        name: updatedSession.name,
        email: updatedSession.email,
        emailEditable: false,
      },
    }));
  } catch (err) {
    const message = err.name === "ValidationError"
      ? Object.values(err.errors).map((e) => e.message).join(" ")
      : err.message;
    console.error("[api/profile] PUT error:", err);
    res.status(400).json(makeFail(message));
  }
});

/**
 * POST /api/profile/avatar
 * multipart/form-data, field name "avatar".
 * The validated data URL is account-scoped and survives Pod replacement.
 */
router.post("/avatar", (req, res) => {
  upload.single("avatar")(req, res, async (err) => {
    if (err) {
      const message = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE"
        ? "Image is too large. Max size is 2MB."
        : err.message;
      return res.status(400).json(makeFail(message));
    }
    if (!req.file) {
      return res.status(400).json(makeFail("No image file was uploaded."));
    }
    if (!hasExpectedImageSignature(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json(makeFail("The uploaded file does not match its declared image type."));
    }

    try {
      const avatarUrl = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const profile = await UserProfileService.setAvatar(req.sessionUser.email, avatarUrl);
      res.status(201).json(makeOk({ profile, avatarUrl }));
    } catch (saveErr) {
      console.error("[api/profile] avatar save error:", saveErr);
      res.status(500).json(makeFail(saveErr.message));
    }
  });
});

module.exports = router;
module.exports.hasExpectedImageSignature = hasExpectedImageSignature;
