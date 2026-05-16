import fs from 'fs';
import pg from 'pg';
import path from 'path';

// Parse the connection string to remove unsupported parameters for direct pg driver
const connectionString = 'postgresql://postgres.utyepqukzxdqgsmvgdsf:Vasanth%402411@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';

const client = new pg.Client({ 
  connectionString,
  ssl: { rejectUnauthorized: false }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to Supabase.");

    const sqlPath = path.resolve('../database/schema.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute schema
    await client.query(sql);
    console.log("Schema applied successfully.");
    
    // Insert demo users
    const adminQuery = `
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES ('user-admin', 'Super Admin', 'admin@nalanda.local', '$2a$10$X8T/mQyJ/L7Z2G4t/KjB9O0T/Xm1zHwzG1sT5k9hT/Jv1kH/0O0K', 'Super Admin', 'Active')
      ON CONFLICT (email) DO NOTHING;
    `;
    const managerQuery = `
      INSERT INTO users (id, name, email, password_hash, role, status)
      VALUES ('user-manager', 'Manager', 'aarav@nalanda.local', '$2a$10$X8T/mQyJ/L7Z2G4t/KjB9O0T/Xm1zHwzG1sT5k9hT/Jv1kH/0O0K', 'Manager', 'Active')
      ON CONFLICT (email) DO NOTHING;
    `;
    await client.query(adminQuery);
    await client.query(managerQuery);
    console.log("Demo users inserted.");

  } catch (err) {
    console.error("Migration Error:", err);
  } finally {
    await client.end();
  }
}
run();
