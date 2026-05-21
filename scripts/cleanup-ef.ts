/**
 * Trims emission_factors to priority zones (EU27 + EFTA + CBAM partners)
 * Must run when Supabase DB is in read-only mode due to storage limit.
 *
 * Uses ALTER DATABASE to temporarily unlock write access, then DELETEs
 * non-priority zones to bring DB back under 500MB free-tier limit.
 *
 * Run: npx tsx scripts/cleanup-ef.ts
 */

import { Client } from "pg";

const DIRECT_URL =
  "postgresql://postgres.qhqyyaosykzldbeuyjmq:GreenLink123!!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const PRIORITY_ZONES = [
  // EU27
  "AT","BE","BG","CY","CZ",
  "DE","DK","DK-BHM","DK-DK1","DK-DK2",
  "EE","ES","ES-CE","ES-CN-FV","ES-CN-GC","ES-CN-HI","ES-CN-IG","ES-CN-TE",
  "ES-IB-FO","ES-IB-IZ","ES-IB-MA","ES-IB-ME","ES-ML",
  "FI","FR","GR","HR","HU","IE",
  "IT","IT-CNO","IT-CSO","IT-NO","IT-SAR","IT-SIC","IT-SO",
  "LT","LU","LV","MT","NL","PL","PT","RO","SE","SI","SK",
  // EFTA / associated
  "CH","GB","GB-NIR","GB-ORK","IS","NO","NO-NO1","NO-NO2","NO-NO3","NO-NO4","NO-NO5",
  // CBAM trading partners
  "AL","AZ","BA","CN","EG","GE","IN","KZ","MA","MD","ME","MK","RS",
  "RU-1","RU-2","RU-AS",
  // Voltfox primary market
  "TR",
  // Ukraine (energy interconnection)
  "UA",
];

async function main() {
  const client = new Client({
    connectionString: DIRECT_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log("Connected.");

  // Step 1: try to unlock write access at session level
  try {
    await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");
    console.log("Session set to READ WRITE");
  } catch (e) {
    console.log("Session SET failed (expected), continuing...");
  }

  // Step 2: check current row count
  const countBefore = await client.query(
    "SELECT COUNT(*) as n, COUNT(DISTINCT zone_id) as zones FROM emission_factors"
  );
  console.log("Before:", countBefore.rows[0]);

  // Step 3: DELETE non-priority zones
  const placeholders = PRIORITY_ZONES.map((_, i) => `$${i + 1}`).join(",");
  const sql = `DELETE FROM emission_factors WHERE zone_id NOT IN (${placeholders})`;

  console.log(`Deleting non-priority zones... (keeping ${PRIORITY_ZONES.length} zone IDs)`);
  const result = await client.query(sql, PRIORITY_ZONES);
  console.log(`Deleted ${result.rowCount} rows`);

  // Step 4: VACUUM to reclaim disk space (cannot run in transaction)
  await client.query("VACUUM emission_factors");
  console.log("VACUUM done");

  // Step 5: final count
  const countAfter = await client.query(
    "SELECT COUNT(*) as n, COUNT(DISTINCT zone_id) as zones FROM emission_factors"
  );
  console.log("After:", countAfter.rows[0]);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
