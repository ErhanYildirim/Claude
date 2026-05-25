// Task #113 — ENTSO-E A44 DAM fiyat çekici
import { prisma, Prisma } from "@voltfox/db";
import {
  ZONE_MAP, toEntsoeDate,
  getTagContent, getAllBlocks, parsePeriodPoints,
} from "./entso-e-utils.js";

export interface PriceImportResult {
  zoneCode:  string;
  rowsAdded: number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

/**
 * ENTSO-E A44 (Day-Ahead Prices) — tüm zone'lar için D+1 fiyatlarını çeker.
 * Saat 14:30 UTC'de çalıştırılmalı (fiyatlar 13:00–14:00 arası yayınlanır).
 */
export async function importDamPrices(
  token:     string,
  zoneCode:  string,
  startDate: Date,
  endDate:   Date,
): Promise<PriceImportResult> {
  const zone = ZONE_MAP.get(zoneCode);
  if (!zone) return { zoneCode, rowsAdded: 0, status: "error", message: `Bilinmeyen zone: ${zoneCode}` };

  const jobStarted = new Date();

  const url = new URL("https://web-api.tp.entsoe.eu/api");
  url.searchParams.set("securityToken", token);
  url.searchParams.set("documentType",  "A44");   // Day-Ahead Prices
  url.searchParams.set("in_Domain",     zone.eicCode);
  url.searchParams.set("out_Domain",    zone.eicCode);
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
      const errMsg = getTagContent(xml, "text") || `HTTP ${resp.status}`;
      throw new Error(`ENTSO-E A44 hatası: ${errMsg}`);
    }
  } catch (err) {
    await logJob("dam-prices", zoneCode, "error", 0, String(err), jobStarted);
    return { zoneCode, rowsAdded: 0, status: "error", message: String(err) };
  }

  const prices = parseA44Xml(xml);
  if (prices.length === 0) {
    await logJob("dam-prices", zoneCode, "partial", 0, "Veri bulunamadı", jobStarted);
    return { zoneCode, rowsAdded: 0, status: "partial", message: "ENTSO-E A44 yanıtında fiyat verisi yok" };
  }

  let rowsAdded = 0;
  for (const row of prices) {
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO market_prices
          (zone_id, hour, price_eur_mwh, currency, price_type, source)
        VALUES
          (${zone.code}, ${row.hour}, ${row.priceEur}, 'EUR', 'dam_actual', 'entso-e')
        ON CONFLICT (zone_id, hour, price_type, source)
        DO UPDATE SET
          price_eur_mwh = EXCLUDED.price_eur_mwh
      `);
      rowsAdded++;
    } catch { /* tek satır hatalarını atla */ }
  }

  await logJob("dam-prices", zoneCode, rowsAdded > 0 ? "success" : "partial", rowsAdded, undefined, jobStarted);
  return {
    zoneCode,
    rowsAdded,
    status:  rowsAdded > 0 ? "ok" : "partial",
    message: `${rowsAdded} saatlik DAM fiyatı eklendi/güncellendi.`,
  };
}

/** Tüm zone'lara paralel istek — Promise.allSettled ile hata izolasyonu */
export async function importAllZonesDamPrices(
  token:     string,
  startDate: Date,
  endDate:   Date,
): Promise<PriceImportResult[]> {
  const zones = [...ZONE_MAP.keys()];
  const settled = await Promise.allSettled(
    zones.map(z => importDamPrices(token, z, startDate, endDate))
  );
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { zoneCode: zones[i], rowsAdded: 0, status: "error" as const, message: String(r.reason) }
  );
}

// ── XML parser ───────────────────────────────────────────────────────────────

interface PricePoint {
  hour:     Date;
  priceEur: number;
}

function parseA44Xml(xml: string): PricePoint[] {
  const result: PricePoint[] = [];
  const timeSeries = getAllBlocks(xml, "TimeSeries");

  for (const ts of timeSeries) {
    const periods = getAllBlocks(ts, "Period");
    for (const period of periods) {
      const points = parsePeriodPoints(period, "price.amount");
      for (const p of points) {
        result.push({ hour: p.hour, priceEur: p.value });
      }
    }
  }
  return result;
}

// ── data_import_jobs loglama ────────────────────────────────────────────────

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
