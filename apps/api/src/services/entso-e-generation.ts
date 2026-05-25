// Task #115 + #116 — ENTSO-E A69 (üretim tahmini) + A65 (yük tahmini)
import { prisma, Prisma } from "@voltfox/db";
import {
  ZONE_MAP, toEntsoeDate,
  getTagContent, getAllBlocks, parsePeriodPoints,
} from "./entso-e-utils.js";

// Yenilenebilir üretim için hedef PSR tipleri
const RE_PSR_TYPES = new Set(["B16", "B18", "B19", "B10", "B11", "B12"]);

export interface GenerationImportResult {
  zoneCode:  string;
  rowsAdded: number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

// ── A69: Yenilenebilir Üretim Tahmini ────────────────────────────────────────

/**
 * ENTSO-E A69 — Wind and Solar Generation Forecast (Day-Ahead).
 * Solar (B16) + Rüzgar (B18, B19) + Hidro (B10, B11, B12) tahminleri.
 * Her gün 14:30 UTC cron'u ile çalıştırılır.
 */
export async function importGenerationForecast(
  token:     string,
  zoneCode:  string,
  startDate: Date,
  endDate:   Date,
): Promise<GenerationImportResult> {
  const zone = ZONE_MAP.get(zoneCode);
  if (!zone) return { zoneCode, rowsAdded: 0, status: "error", message: `Bilinmeyen zone: ${zoneCode}` };

  const startedAt = new Date();

  // A69: processType=A01 (Day-Ahead)
  const result = await fetchAndUpsertGeneration({
    token,
    zone: { code: zone.code, eicCode: zone.eicCode },
    documentType: "A69",
    processType:  "A01",
    recordType:   "forecast",
    startDate,
    endDate,
    jobType:      "generation-forecast",
    startedAt,
  });

  return result;
}

/**
 * ENTSO-E A75 — Actual Generation Per Production Type (Realised).
 * Gerçekleşen üretim verisi — saatlik cron ile çalıştırılır.
 */
export async function importGenerationActual(
  token:     string,
  zoneCode:  string,
  startDate: Date,
  endDate:   Date,
): Promise<GenerationImportResult> {
  const zone = ZONE_MAP.get(zoneCode);
  if (!zone) return { zoneCode, rowsAdded: 0, status: "error", message: `Bilinmeyen zone: ${zoneCode}` };

  const startedAt = new Date();

  const result = await fetchAndUpsertGeneration({
    token,
    zone: { code: zone.code, eicCode: zone.eicCode },
    documentType: "A75",
    processType:  "A16",
    recordType:   "actual",
    startDate,
    endDate,
    jobType:      "generation-forecast",
    startedAt,
  });

  return result;
}

// ── A65: Toplam Yük Tahmini ──────────────────────────────────────────────────

/**
 * ENTSO-E A65 — Total Load Forecast (Day-Ahead).
 * Net yük = toplam_yük - yenilenebilir → marjinal üretici → CI için kritik.
 */
export async function importLoadForecast(
  token:     string,
  zoneCode:  string,
  startDate: Date,
  endDate:   Date,
): Promise<GenerationImportResult> {
  const zone = ZONE_MAP.get(zoneCode);
  if (!zone) return { zoneCode, rowsAdded: 0, status: "error", message: `Bilinmeyen zone: ${zoneCode}` };

  const startedAt = new Date();

  const url = new URL("https://web-api.tp.entsoe.eu/api");
  url.searchParams.set("securityToken", token);
  url.searchParams.set("documentType",  "A65");
  url.searchParams.set("processType",   "A01");
  url.searchParams.set("outBiddingZone_Domain", zone.eicCode);
  url.searchParams.set("periodStart",   toEntsoeDate(startDate));
  url.searchParams.set("periodEnd",     toEntsoeDate(endDate));

  let xml: string;
  try {
    const resp = await fetch(url.toString(), {
      signal:  AbortSignal.timeout(15_000),
      headers: { "Accept": "application/xml" },
    });
    xml = await resp.text();
    if (!resp.ok) {
      throw new Error(`ENTSO-E A65 hatası: ${getTagContent(xml, "text") || `HTTP ${resp.status}`}`);
    }
  } catch (err) {
    await logJob("load-forecast", zone.code, "error", 0, String(err), startedAt);
    return { zoneCode, rowsAdded: 0, status: "error", message: String(err) };
  }

  const loadPoints = parseLoadXml(xml);
  if (loadPoints.length === 0) {
    await logJob("load-forecast", zone.code, "partial", 0, "Veri bulunamadı", startedAt);
    return { zoneCode, rowsAdded: 0, status: "partial", message: "A65 yanıtında yük verisi yok" };
  }

  let rowsAdded = 0;
  const forecastMadeAt = new Date();
  for (const row of loadPoints) {
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO generation_forecasts
          (zone_id, hour, psr_type, record_type, quantity_mw, source, forecast_made_at)
        VALUES
          (${zone.code}, ${row.hour}, 'TOTAL_LOAD', 'forecast', ${row.loadMw}, 'entso-e', ${forecastMadeAt})
        ON CONFLICT (zone_id, hour, psr_type, record_type, source)
        DO UPDATE SET
          quantity_mw      = EXCLUDED.quantity_mw,
          forecast_made_at = EXCLUDED.forecast_made_at
      `);
      rowsAdded++;
    } catch { /* tek satır hatalarını atla */ }
  }

  await logJob("load-forecast", zone.code, rowsAdded > 0 ? "success" : "partial", rowsAdded, undefined, startedAt);
  return {
    zoneCode,
    rowsAdded,
    status:  rowsAdded > 0 ? "ok" : "partial",
    message: `${rowsAdded} saatlik yük tahmini eklendi/güncellendi.`,
  };
}

/** Tüm zone'lar için üretim tahmini — Promise.allSettled */
export async function importAllZonesGenerationForecast(
  token:     string,
  startDate: Date,
  endDate:   Date,
): Promise<GenerationImportResult[]> {
  const zones = [...ZONE_MAP.keys()];
  const settled = await Promise.allSettled(
    zones.map(z => importGenerationForecast(token, z, startDate, endDate))
  );
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { zoneCode: zones[i], rowsAdded: 0, status: "error" as const, message: String(r.reason) }
  );
}

// ── İç yardımcılar ──────────────────────────────────────────────────────────

interface FetchParams {
  token:        string;
  zone:         { code: string; eicCode: string };
  documentType: string;
  processType:  string;
  recordType:   "actual" | "forecast";
  startDate:    Date;
  endDate:      Date;
  jobType:      string;
  startedAt:    Date;
}

async function fetchAndUpsertGeneration(p: FetchParams): Promise<GenerationImportResult> {
  const url = new URL("https://web-api.tp.entsoe.eu/api");
  url.searchParams.set("securityToken", p.token);
  url.searchParams.set("documentType",  p.documentType);
  url.searchParams.set("processType",   p.processType);
  url.searchParams.set("in_Domain",     p.zone.eicCode);
  url.searchParams.set("periodStart",   toEntsoeDate(p.startDate));
  url.searchParams.set("periodEnd",     toEntsoeDate(p.endDate));

  let xml: string;
  try {
    const resp = await fetch(url.toString(), {
      signal:  AbortSignal.timeout(15_000),
      headers: { "Accept": "application/xml" },
    });
    xml = await resp.text();
    if (!resp.ok) {
      throw new Error(`ENTSO-E ${p.documentType}: ${getTagContent(xml, "text") || `HTTP ${resp.status}`}`);
    }
  } catch (err) {
    await logJob(p.jobType, p.zone.code, "error", 0, String(err), p.startedAt);
    return { zoneCode: p.zone.code, rowsAdded: 0, status: "error", message: String(err) };
  }

  const entries = parseGenerationXml(xml);
  // Sadece RE + yük tipleri sakla
  const filtered = entries.filter(e => RE_PSR_TYPES.has(e.psrType));
  if (filtered.length === 0) {
    await logJob(p.jobType, p.zone.code, "partial", 0, "Veri bulunamadı", p.startedAt);
    return { zoneCode: p.zone.code, rowsAdded: 0, status: "partial", message: "Kullanılabilir veri yok" };
  }

  let rowsAdded = 0;
  const forecastMadeAt = p.recordType === "forecast" ? new Date() : null;
  for (const entry of filtered) {
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO generation_forecasts
          (zone_id, hour, psr_type, record_type, quantity_mw, source, forecast_made_at)
        VALUES
          (${p.zone.code}, ${entry.hour}, ${entry.psrType}, ${p.recordType},
           ${entry.quantityMw}, 'entso-e', ${forecastMadeAt})
        ON CONFLICT (zone_id, hour, psr_type, record_type, source)
        DO UPDATE SET
          quantity_mw      = EXCLUDED.quantity_mw,
          forecast_made_at = EXCLUDED.forecast_made_at
      `);
      rowsAdded++;
    } catch { /* tek satır hatalarını atla */ }
  }

  await logJob(p.jobType, p.zone.code, rowsAdded > 0 ? "success" : "partial", rowsAdded, undefined, p.startedAt);
  return {
    zoneCode: p.zone.code,
    rowsAdded,
    status:   rowsAdded > 0 ? "ok" : "partial",
    message:  `${rowsAdded} saatlik üretim verisi (${p.documentType}) eklendi/güncellendi.`,
  };
}

interface GenerationEntry {
  hour:       Date;
  psrType:    string;
  quantityMw: number;
}

function parseGenerationXml(xml: string): GenerationEntry[] {
  const entries: GenerationEntry[] = [];
  const timeSeries = getAllBlocks(xml, "TimeSeries");

  for (const ts of timeSeries) {
    const psrType = getTagContent(ts, "psrType");
    if (!psrType) continue;

    const periods = getAllBlocks(ts, "Period");
    for (const period of periods) {
      const points = parsePeriodPoints(period, "quantity");
      for (const p of points) {
        entries.push({ hour: p.hour, psrType, quantityMw: p.value });
      }
    }
  }
  return entries;
}

interface LoadPoint {
  hour:   Date;
  loadMw: number;
}

function parseLoadXml(xml: string): LoadPoint[] {
  const result: LoadPoint[] = [];
  const timeSeries = getAllBlocks(xml, "TimeSeries");
  for (const ts of timeSeries) {
    const periods = getAllBlocks(ts, "Period");
    for (const period of periods) {
      const points = parsePeriodPoints(period, "quantity");
      for (const p of points) {
        result.push({ hour: p.hour, loadMw: p.value });
      }
    }
  }
  return result;
}

async function logJob(
  jobType:  string,
  zoneId:   string,
  status:   "success" | "error" | "partial",
  rows:     number,
  errorMsg: string | undefined,
  startedAt: Date,
) {
  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO data_import_jobs (job_type, zone_id, status, started_at, finished_at, rows_inserted, error_message)
      VALUES (${jobType}, ${zoneId}, ${status}, ${startedAt}, ${new Date()}, ${rows}, ${errorMsg ?? null})
    `);
  } catch { /* log hatası uygulamayı durdurmasın */ }
}
