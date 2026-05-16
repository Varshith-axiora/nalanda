import pg from 'pg';
const connectionString = 'postgresql://postgres.utyepqukzxdqgsmvgdsf:Vasanth%402411@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
async function run() {
  await client.connect();
  const res = await client.query("SELECT * FROM users LIMIT 1");
  console.log("Sample user row:", res.rows[0]);
  await client.end();
}
run();
