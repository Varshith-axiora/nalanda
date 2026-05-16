import pg from 'pg';

const connectionString = 'postgresql://postgres.utyepqukzxdqgsmvgdsf:Vasanth%402411@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const client = new pg.Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase.");

    // Simplify users table to match Prisma's current expectations for the demo
    await client.query(`
      ALTER TABLE users DROP COLUMN IF EXISTS department_id;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Unassigned';
    `);
    console.log("Users table updated (department_id -> department TEXT).");

    // Also check other tables for consistency with the new schema.prisma I wrote
    // current_version in courses vs version in prisma
    await client.query(`
      ALTER TABLE courses RENAME COLUMN current_version TO version;
    `);
    console.log("Courses table updated (current_version -> version).");

  } catch (err) {
    console.error("Migration Fix Error:", err);
  } finally {
    await client.end();
  }
}
run();
