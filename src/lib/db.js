// ============================================================
// src/lib/db.js
// Owns the application's single MongoDB connection and applies the
// same fail-fast timeout in local and container environments.
// ============================================================

const mongoose = require("mongoose");

/** Connects Mongoose to the configured Butler database. */
async function connectDb() {
  mongoose.set("strictQuery", true);
  mongoose.set("bufferCommands", false);

  const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/butler";
  const configuredTimeout = Number(process.env.MONGO_CONNECT_TIMEOUT_MS);
  const serverSelectionTimeoutMS = Number.isFinite(configuredTimeout) && configuredTimeout > 0
    ? configuredTimeout
    : 5000;

  await mongoose.connect(mongoUri, { serverSelectionTimeoutMS });
  const safeMongoUri = mongoUri.replace(/(mongodb(?:\+srv)?:\/\/)([^@/]+)@/i, "$1***:***@");
  console.log("[db] Connected to MongoDB:", safeMongoUri);
}

module.exports = { connectDb };
