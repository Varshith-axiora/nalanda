// backend/routes/health.js
// Render pings GET /api/health every 30 seconds to confirm your server is alive.
// If this route is missing, Render marks the service as "failed" and restarts it.

const express = require("express");
const router = express.Router();
const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Required for Render PostgreSQL
});

router.get("/health", async (req, res) => {
  try {
    await pool.query("SELECT 1"); // Quick DB connectivity check
    res.status(200).json({
      status: "ok",
      service: "nalanda-backend",
      database: "connected",
      timestamp: new Date().toISOString(),
      env: process.env.NODE_ENV,
    });
  } catch (err) {
    res.status(503).json({
      status: "error",
      database: "disconnected",
      message: err.message,
    });
  }
});

module.exports = router;

// ─── Add these 2 lines to backend/server.js ──────────────────────────────────
//
//   const healthRoute = require('./routes/health');
//   app.use('/api', healthRoute);
//
// Test it: GET https://nalanda-backend.onrender.com/api/health
// Expected: { "status": "ok", "database": "connected" }
// ─────────────────────────────────────────────────────────────────────────────
