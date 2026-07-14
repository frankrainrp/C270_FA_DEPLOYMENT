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
// original Task 6 shared demo profile so existing local testing
// still works. Avatar/plan/credits stay on the shared demo profile
// either way — those aren't per-account yet.
//
// Validation ("quality checks") lives at two layers:
//   1. multer fileFilter/limits reject the wrong type/size before any
//      bytes hit disk.
//   2. UserProfileService / User / the Mongoose schemas reject bad
//      name/email.
// ============================================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const express = require("express");
const multer = require("multer");

const UserProfileService = require("../../services/UserProfileService");
const AuthService = require("../../services/AuthService");
const { makeOk, makeFail, runSafe } = require("../../lib/apiResponse");
const { requireAuthApi } = require("../../middleware/requireAuth");

const router = express.Router();
router.use(requireAuthApi);

// ------------------------------------------------------------------
// Upload target: src/public/uploads/avatars.  "uploads/" is gitignored
// (user-generated files never get committed), so it may not exist on a
// fresh clone — create it lazily on boot.
// ------------------------------------------------------------------
const UPLOAD_DIR = path.join(__dirname, "..", "..", "public", "uploads", "avatars");
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const ALLOWED_MIME = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MIME_EXTENSION = {
  "image/png": ".png",
  "image/jpeg": ".jpg",
  "image/webp": ".webp",
  "image/gif": ".gif",
};
const MAX_AVATAR_BYTES = 2 * 1024 * 1024; // 2 MB

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ownerHash = crypto.createHash("sha256").update(req.sessionUser.email).digest("hex").slice(0, 16);
    const ext = MIME_EXTENSION[file.mimetype] || ".jpg";
    cb(null, `avatar-${ownerHash}-${crypto.randomUUID()}${ext}`);
  },
});

const upload = multer({
  storage,
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
 * NOTE: avatar storage is still on the shared demo profile, not
 * per-account, regardless of login state — a known simplification.
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

    try {
      const publicUrl = `/uploads/avatars/${req.file.filename}`;
      const profile = await UserProfileService.setAvatar(req.sessionUser.email, publicUrl);
      res.status(201).json(makeOk({ profile, avatarUrl: publicUrl }));
    } catch (saveErr) {
      console.error("[api/profile] avatar save error:", saveErr);
      res.status(500).json(makeFail(saveErr.message));
    }
  });
});

module.exports = router;
