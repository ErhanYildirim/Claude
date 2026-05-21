/**
 * Runs VACUUM FULL on emission_factors to actually reclaim disk space after DELETE.
 * Regular VACUUM only marks space as reusable; VACUUM FULL rewrites the table.
 */
import { Client } from "pg";

const DIRECT_URL =
  "postgresql://postgres.qhqyyaosykzldbeuyjmq:GreenLink123!!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function main() {
  const client = new Client({
    connectionString: DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");

  console.log("Checking table size before...");
  const before = await client.query(
    "SELECT pg_size_pretty(pg_total_relation_size('emission_factors')) as size, COUNT(*) as rows FROM emission_factors"
  );
  console.log("Before:", before.rows[0]);

  console.log("Running VACUUM FULL (this rewrites the table — may take 1-2 minutes)...");
  await client.query("VACUUM FULL emission_factors");
  console.log("VACUUM FULL done");

  const after = await client.query(
    "SELECT pg_size_pretty(pg_total_relation_size('emission_factors')) as size, COUNT(*) as rows FROM emission_factors"
  );
  console.log("After:", after.rows[0]);

  // Also check total DB size
  const dbSize = await client.query(
    "SELECT pg_size_pretty(pg_database_size(current_database())) as db_size"
  );
  console.log("Total DB size:", dbSize.rows[0].db_size);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
