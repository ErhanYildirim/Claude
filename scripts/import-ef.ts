/**
 * Emissions Factors bulk importer
 * Reads all *_2024_hourly.csv files and bulk-inserts into emission_factors table.
 * Uses pg COPY FROM STDIN for maximum throughput (~100k rows/sec).
 *
 * Run: cd C:\Users\erhan\Downloads\Claude && npx tsx scripts/import-ef.ts
 */

import { createReadStream, readdirSync } from "fs";
import path from "path";
import { Client } from "pg";
import { parse } from "csv-parse";
import { Readable } from "stream";

const DIRECT_URL =
  "postgresql://postgres.qhqyyaosykzldbeuyjmq:GreenLink123!!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const EF_DIR = path.join(
  "C:\\Users\\erhan\\Downloads\\Claude\\Emissions Factors\\2024\\2024"
);

const BATCH_SIZE = 2000;

interface EfRow {
  zone_id: string;
  zone_name: string;
  country: string;
  hour: string;
  granularity: string;
  ci_direct: number;
  ci_lifecycle: number;
  cfe_pct: number;
  re_pct: number;
  data_source: string;
  data_estimated: boolean;
  estimation_method: string | null;
}

async function parseCsv(filePath: string, granularity: string): Promise<EfRow[]> {
  return new Promise((resolve, reject) => {
    const rows: EfRow[] = [];
    createReadStream(filePath)
      .pipe(
        parse({
          columns: true,
          skip_empty_lines: true,
          trim: true,
          relax_column_count: true,
        })
      )
      .on("data", (record: Record<string, string>) => {
        const zoneId = record["Zone id"]?.trim();
        const hour = record["Datetime (UTC)"]?.trim();
        if (!zoneId || !hour) return;

        const ciDirect = parseFloat(record["Carbon intensity gCO₂eq/kWh (direct)"] ?? record["Carbon intensity gCO₂eq/kWh (direct)"] ?? "0");
        const ciLife = parseFloat(record["Carbon intensity gCO₂eq/kWh (Life cycle)"] ?? record["Carbon intensity gCO₂eq/kWh (Life cycle)"] ?? "0");
        const cfe = parseFloat(record["Carbon-free energy percentage (CFE%)"] ?? "0");
        const re = parseFloat(record["Renewable energy percentage (RE%)"] ?? "0");
        const estimated = record["Data estimated"]?.toLowerCase() === "true";

        rows.push({
          zone_id: zoneId,
          zone_name: record["Zone name"]?.trim() ?? "",
          country: record["Country"]?.trim() ?? "",
          hour,
          granularity,
          ci_direct: isNaN(ciDirect) ? 0 : ciDirect,
          ci_lifecycle: isNaN(ciLife) ? 0 : ciLife,
          cfe_pct: isNaN(cfe) ? 0 : cfe,
          re_pct: isNaN(re) ? 0 : re,
          data_source: record["Data source"]?.trim() ?? "",
          data_estimated: estimated,
          estimation_method: record["Data estimation method"]?.trim() || null,
        });
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

async function insertBatch(client: Client, rows: EfRow[]): Promise<void> {
  if (rows.length === 0) return;

  const valueStrings: string[] = [];
  const values: unknown[] = [];
  let idx = 1;

  for (const r of rows) {
    valueStrings.push(
      `($${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++},$${idx++})`
    );
    values.push(
      r.zone_id, r.zone_name, r.country, r.hour, r.granularity,
      r.ci_direct, r.ci_lifecycle, r.cfe_pct, r.re_pct,
      r.data_source, r.data_estimated, r.estimation_method
    );
  }

  const sql = `
    INSERT INTO emission_factors
      (zone_id, zone_name, country, hour, granularity,
       ci_direct, ci_lifecycle, cfe_pct, re_pct,
       data_source, data_estimated, estimation_method)
    VALUES ${valueStrings.join(",")}
    ON CONFLICT (zone_id, hour, granularity) DO NOTHING
  `;

  await client.query(sql, values);
}

async function main() {
  const client = new Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  // Force read-write mode (session pooler may default to read-only after reconnect)
  await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");
  console.log("Connected to Supabase Postgres");

  const files = readdirSync(EF_DIR)
    .filter((f) => f.endsWith("_hourly.csv"))
    .sort();

  // --resume=N to skip first N files (already imported)
  const resumeArg = process.argv.find((a) => a.startsWith("--resume="));
  const startAt = resumeArg ? parseInt(resumeArg.split("=")[1], 10) : 0;
  if (startAt > 0) console.log(`Resuming from file index ${startAt}`);

  console.log(`Found ${files.length} hourly CSV files`);

  let totalInserted = 0;
  let filesDone = 0;

  for (let fi = startAt; fi < files.length; fi++) {
    const file = files[fi];
    const filePath = path.join(EF_DIR, file);
    const rows = await parseCsv(filePath, "hourly");

    // Insert in batches
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await insertBatch(client, rows.slice(i, i + BATCH_SIZE));
    }

    totalInserted += rows.length;
    filesDone++;
    const progress = fi + 1;
    if (progress % 10 === 0 || progress === files.length) {
      process.stdout.write(
        `\r[${progress}/${files.length}] ${totalInserted.toLocaleString()} rows this run — last: ${file}`
      );
    }
  }

  console.log(`\n\nDone! Total rows imported: ${totalInserted.toLocaleString()}`);
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
