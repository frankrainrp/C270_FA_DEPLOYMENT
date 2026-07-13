// ============================================================
// src/lib/db.js
// MongoDB connection via Mongoose. Call connectDb() once at startup.
// Reads MONGO_URI when provided (e.g. from docker-compose), otherwise
// falls back to the local Compass database so it runs on your laptop.
// ============================================================

const mongoose = require("mongoose");

// Database name is "butlerdb" to match MongoDB Compass and docker-compose.
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/butlerdb";

async function connectDb() {
  mongoose.set("strictQuery", true);
  await mongoose.connect(MONGO_URI);
  console.log("[db] connected to", MONGO_URI);
}

module.exports = { connectDb };
