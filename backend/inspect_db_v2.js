import pg from 'pg';
const connectionString = 'postgresql://postgres.utyepqukzxdqgsmvgdsf:Vasanth%402411@aws-1-ap-northeast-2.pooler.supabase.com:6543/postgres';
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } });
async function run() {
  await client.connect();
  const res = await client.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'users' AND table_schema = 'public'");
  console.log("Columns in 'public.users' table:", res.rows);
  await client.end();
}
run();
