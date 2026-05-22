/**
 * Year-generic Emissions Factors bulk importer.
 * Reads *_hourly.csv files from a directory and bulk-inserts into emission_factors table.
 *
 * Usage:
 *   npx tsx scripts/import-ef-year.ts --year=2025
 *   npx tsx scripts/import-ef-year.ts --year=2025 --dir="C:\path\to\CSVs"
 *   npx tsx scripts/import-ef-year.ts --year=2025 --zone=TR,DE,FR
 *   npx tsx scripts/import-ef-year.ts --year=2025 --resume=10
 *   npx tsx scripts/import-ef-year.ts --year=2025 --dry-run
 */

import { createReadStream, readdirSync, existsSync } from "fs";
import path from "path";
import { Client } from "pg";
import { parse } from "csv-parse";

const DIRECT_URL =
  "postgresql://postgres.qhqyyaosykzldbeuyjmq:GreenLink123!!!@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const BATCH_SIZE = 2000;

// Expected hourly rows per year (for completeness check)
function expectedHours(year: number): number {
  const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
  return isLeap ? 8784 : 8760;
}

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

function parseArg(name: string): string | undefined {
  const arg = process.argv.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=").slice(1).join("=") : undefined;
}

function hasFlag(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

async function parseCsv(filePath: string, granularity: string): Promise<EfRow[]> {
  return new Promise((resolve, reject) => {
    const rows: EfRow[] = [];
    createReadStream(filePath)
      .pipe(parse({ columns: true, skip_empty_lines: true, trim: true, relax_column_count: true }))
      .on("data", (record: Record<string, string>) => {
        const zoneId = record["Zone id"]?.trim();
        const hour   = record["Datetime (UTC)"]?.trim();
        if (!zoneId || !hour) return;

        const ciDirect = parseFloat(record["Carbon intensity gCO₂eq/kWh (direct)"] ?? "0");
        const ciLife   = parseFloat(record["Carbon intensity gCO₂eq/kWh (Life cycle)"] ?? "0");
        const cfe      = parseFloat(record["Carbon-free energy percentage (CFE%)"] ?? "0");
        const re       = parseFloat(record["Renewable energy percentage (RE%)"] ?? "0");
        const estimated = record["Data estimated"]?.toLowerCase() === "true";

        rows.push({
          zone_id:           zoneId,
          zone_name:         record["Zone name"]?.trim() ?? "",
          country:           record["Country"]?.trim() ?? "",
          hour,
          granularity,
          ci_direct:         isNaN(ciDirect) ? 0 : ciDirect,
          ci_lifecycle:      isNaN(ciLife)   ? 0 : ciLife,
          cfe_pct:           isNaN(cfe)      ? 0 : cfe,
          re_pct:            isNaN(re)       ? 0 : re,
          data_source:       record["Data source"]?.trim() ?? "",
          data_estimated:    estimated,
          estimation_method: record["Data estimation method"]?.trim() || null,
        });
      })
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

async function insertBatch(client: Client, rows: EfRow[], dryRun: boolean): Promise<void> {
  if (rows.length === 0 || dryRun) return;

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

async function printCoverage(client: Client, year: number): Promise<void> {
  const expected = expectedHours(year);
  const rows = await client.query<{ zone_id: string; row_count: string }>(
    `SELECT zone_id, COUNT(*)::text AS row_count
     FROM emission_factors
     WHERE granularity = 'hourly' AND EXTRACT(YEAR FROM hour) = $1
     GROUP BY zone_id ORDER BY zone_id`,
    [year]
  );

  console.log(`\n── Coverage for year ${year} (expected ${expected} hours/zone) ──`);
  if (rows.rows.length === 0) {
    console.log("  No data found for this year.");
    return;
  }
  for (const r of rows.rows) {
    const count = parseInt(r.row_count, 10);
    const pct   = ((count / expected) * 100).toFixed(1);
    const bar   = count >= expected ? "✓" : `${pct}%`;
    console.log(`  ${r.zone_id.padEnd(6)} ${count.toString().padStart(5)} rows  ${bar}`);
  }
  console.log(`  Total zones: ${rows.rows.length}`);
}

async function main() {
  const year   = parseInt(parseArg("year") ?? "2025", 10);
  const dryRun = hasFlag("dry-run");
  const resumeAt = parseInt(parseArg("resume") ?? "0", 10);
  const zoneFilter = parseArg("zone")?.split(",").map(z => z.trim().toUpperCase()) ?? null;

  const defaultDir = path.join(
    "C:\\Users\\erhan\\Downloads\\Claude\\Emissions Factors",
    String(year), String(year)
  );
  const efDir = parseArg("dir") ?? defaultDir;

  console.log(`EF Import — Year: ${year}${dryRun ? " (DRY RUN)" : ""}`);
  console.log(`Directory: ${efDir}`);
  if (zoneFilter) console.log(`Zone filter: ${zoneFilter.join(", ")}`);

  if (!existsSync(efDir)) {
    console.error(`\nDirectory not found: ${efDir}`);
    console.error(`Create it and place the ${year} hourly CSV files there, then re-run.`);
    process.exit(1);
  }

  const allFiles = readdirSync(efDir).filter((f) => f.endsWith("_hourly.csv")).sort();

  const files = zoneFilter
    ? allFiles.filter((f) => zoneFilter.some((z) => f.toUpperCase().includes(z)))
    : allFiles;

  if (files.length === 0) {
    console.error(`\nNo *_hourly.csv files found in ${efDir}`);
    process.exit(1);
  }

  const client = new Client({ connectionString: DIRECT_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();
  await client.query("SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE");
  console.log(`Connected · ${files.length} CSV files found\n`);

  let totalInserted = 0;

  for (let fi = resumeAt; fi < files.length; fi++) {
    const file     = files[fi];
    const filePath = path.join(efDir, file);
    const rows     = await parseCsv(filePath, "hourly");

    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
      await insertBatch(client, rows.slice(i, i + BATCH_SIZE), dryRun);
    }

    totalInserted += rows.length;
    const progress = fi + 1 - resumeAt;
    const total    = files.length - resumeAt;
    process.stdout.write(
      `\r[${progress}/${total}] ${totalInserted.toLocaleString()} rows — ${file.slice(0, 40)}`
    );
  }

  console.log(`\n\nDone! ${dryRun ? "(dry run — nothing written) " : ""}Total rows: ${totalInserted.toLocaleString()}`);

  if (!dryRun) await printCoverage(client, year);

  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
