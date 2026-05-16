// backend/migrate.js
// Reads your database/schema.sql file and runs it against the cloud PostgreSQL.
// Run this once after first deploy to create all your tables on Render.
//
// How to run on Render:
//   Option A (manual): Render dashboard → nalanda-backend → Shell → node migrate.js
//   Option B (auto):   Change buildCommand in render.yaml to:
//                      npm install && node migrate.js

const { Pool } = require("pg");
const fs = require("fs");
const path = require("path");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function migrate() {
  // Path from backend/ up one level to database/schema.sql
  const schemaPath = path.join(__dirname, "..", "database", "schema.sql");

  if (!fs.existsSync(schemaPath)) {
    console.error("❌ schema.sql not found at:", schemaPath);
    process.exit(1);
  }

  const sql = fs.readFileSync(schemaPath, "utf8");
  console.log("📦 Running schema.sql against database...");

  const client = await pool.connect();
  try {
    await client.query(sql);
    console.log("✅ Database schema applied successfully");
  } catch (err) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
