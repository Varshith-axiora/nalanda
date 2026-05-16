// backend/db.js
// Central database connection file.
// Import this wherever you need to run queries: const db = require('./db');

const { Pool } = require("pg");

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  // SSL is REQUIRED for Render PostgreSQL in production.
  // In local dev (NODE_ENV !== 'production'), SSL is disabled so localhost works.
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
});

// Test connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error("❌ Database connection error:", err.message);
  } else {
    console.log("✅ Database connected successfully");
    release();
  }
});

module.exports = {
  // Run a query: db.query('SELECT * FROM users WHERE id = $1', [userId])
  query: (text, params) => pool.query(text, params),

  // Get a client for transactions:
  // const client = await db.getClient();
  // await client.query('BEGIN');
  // ...
  // await client.query('COMMIT');
  // client.release();
  getClient: () => pool.connect(),
};
