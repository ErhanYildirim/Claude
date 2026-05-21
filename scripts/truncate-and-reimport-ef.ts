/**
 * TRUNCATE emission_factors (immediate space reclaim) then re-import only priority zones.
 * This is the recovery path when VACUUM FULL fails due to disk-full on Supabase free tier.
 *
 * Priority set: EU27 + EFTA + key CBAM trading partners (~80 zones, ~700K rows, ~130MB)
 *
 * Run: npx tsx scripts/truncate-and-reimport-ef.ts
 */

import { createReadStream, readdirSync } from "fs";
import path from "path";
import { Client } from "pg";
import { parse } from "csv-parse";

const DIRECT_URL =
  "postgresql://postgres.qhqyyaosykzldbeuyjmq:GreenLink123!!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const EF_DIR =
  "C:\\Users\\erhan\\Downloads\\Claude\\Emissions Factors\\2024\\2024";

const BATCH_SIZE = 2000;

// Şimdilik sadece Türkiye — ilerleyen aşamada diğer ülkeler eklenebilir
const PRIORITY_ZONES = new Set(["TR"]);

interface EfRow {
  zone_id: string; zone_name: string; country: string; hour: string;
  granularity: string; ci_direct: number; ci_lifecycle: number;
  cfe_pct: number; re_pct: number; data_source: string;
  data_estimated: boolean; estimation_method: string | null;
}

async function parseCsv(filePath: string): Promise<EfRow[]> {
  return new Promise((resolve, reject) => {
    const rows: EfRow[] = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }))
      .on("data", (r: Record<string, string>) => {
        const zoneId = r["Zone id"]?.trim();
        if (!zoneId) return;
        const cd = parseFloat(r["Carbon intensity gCO₂eq/kWh (direct)"] ?? "0");
        const cl = parseFloat(r["Carbon intensity gCO₂eq/kWh (Life cycle)"] ?? "0");
        const cfe = parseFloat(r["Carbon-free energy percentage (CFE%)"] ?? "0");
        const re = parseFloat(r["Renewable energy percentage (RE%)"] ?? "0");
        rows.push({
          zone_id: zoneId,
          zone_name: r["Zone name"]?.trim() ?? "",
          country: r["Country"]?.trim() ?? "",
          hour: r["Datetime (UTC)"]?.trim() ?? "",
          granularity: "hourly",
          ci_direct: isNaN(cd) ? 0 : cd,
          ci_lifecycle: isNaN(cl) ? 0 : cl,
          cfe_pct: isNaN(cfe) ? 0 : cfe,
          re_pct: isNaN(re) ? 0 : re,
          data_source: r["Data source"]?.trim() ?? "",
          data_estimated: r["Data estimated"]?.toLowerCase() === "true",
          estimation_method: r["Data estimation method"]?.trim() || null,
        });
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

async function insertBatch(client: Client, rows: EfRow[]): Promise<void> {
  if (!rows.length) return;
  const vals: unknown[] = [];
  const placeholders = rows.map((_, i) => {
    const b = i * 12;
    vals.push(rows[i].zone_id, rows[i].zone_name, rows[i].country, rows[i].hour,
      rows[i].granularity, rows[i].ci_direct, rows[i].ci_lifecycle,
      rows[i].cfe_pct, rows[i].re_pct, rows[i].data_source,
      rows[i].data_estimated, rows[i].estimation_method);
    return `($${b+1},$${b+2},$${b+3},$${b+4},$${b+5},$${b+6},$${b+7},$${b+8},$${b+9},$${b+10},$${b+11},$${b+12})`;
  }).join(",");
  await client.query(
    `INSERT INTO emission_factors
       (zone_id,zone_name,country,hour,granularity,ci_direct,ci_lifecycle,cfe_pct,re_pct,data_source,data_estimated,estimation_method)
     VALUES ${placeholders}
     ON CONFLICT (zone_id,hour,granularity) DO NOTHING`,
    vals
  );
}

async function main() {
  const client = new Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");
  console.log("Connected.");

  // TRUNCATE — immediate full space reclaim (no extra disk needed unlike VACUUM FULL)
  console.log("Truncating emission_factors...");
  await client.query("TRUNCATE TABLE emission_factors RESTART IDENTITY");
  console.log("Truncated. Disk space reclaimed.");

  // Get all hourly files that match priority zone IDs
  const allFiles = readdirSync(EF_DIR).filter((f) => f.endsWith("_2024_hourly.csv")).sort();
  const files = allFiles.filter((f) => {
    const zoneId = f.replace("_2024_hourly.csv", "");
    return PRIORITY_ZONES.has(zoneId);
  });

  console.log(`Importing ${files.length} priority zone files (${PRIORITY_ZONES.size} zones targeted)...`);

  let totalRows = 0;
  for (let fi = 0; fi < files.length; fi++) {
    const file = files[fi];
    const rows = await parseCsv(path.join(EF_DIR, file));
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await insertBatch(client, rows.slice(i, i + BATCH_SIZE));
    }
    totalRows += rows.length;
    if ((fi + 1) % 5 === 0 || fi === files.length - 1) {
      process.stdout.write(`\r[${fi + 1}/${files.length}] ${totalRows.toLocaleString()} rows — ${file}`);
    }
  }

  console.log("\n\nChecking final state...");
  const result = await client.query(
    "SELECT COUNT(*) as rows, COUNT(DISTINCT zone_id) as zones, pg_size_pretty(pg_total_relation_size('emission_factors')) as size FROM emission_factors"
  );
  console.log("Final:", result.rows[0]);

  const dbSize = await client.query("SELECT pg_size_pretty(pg_database_size(current_database())) as db_size");
  console.log("Total DB size:", dbSize.rows[0].db_size);

  await client.end();
}

main().catch((err) => { console.error(err); process.exit(1); });
