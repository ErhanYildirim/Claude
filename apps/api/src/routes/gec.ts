import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { Prisma } from "@voltfox/db";
import { parse } from "csv-parse";
import multipart from "@fastify/multipart";
import * as XLSX from "xlsx";
import { calculateCFEMatching } from "../../../../src/cbam/cfe-matching.js";
import type { HourlySlot } from "../../../../src/cbam/cfe-matching.js";

// ── GEC — Granular Emission Calculation API ───────────────────────────────────
// CSV / Excel upload → join with hourly EF → tCO₂ per hour
// Opsiyonel: production_kwh sütunu varsa → 24/7 CFE matching de hesaplanır

type EFRow = { hour: Date; ci_direct: number };

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface FileRow {
  hour: Date;
  consumptionKwh?: number;
  productionKwh?: number;
}

interface MonthAgg {
  month: number; monthName: string;
  consumptionKwh: number; productionKwh: number;
  tco2: number; efSum: number; hours: number;
}

// ── Tarih ayrıştırıcısı: Türkçe format + ISO 8601 ────────────────────────────
function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();

  // Türkçe: D.MM.YYYY HH:mm  (örn: 1.01.2025 00:00 | 15.3.2025 14:30)
  const tr = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (tr) {
    const d = new Date(Date.UTC(+tr[3], +tr[2] - 1, +tr[1], +tr[4], +tr[5]));
    if (!isNaN(d.getTime())) return d;
  }

  // ISO 8601 ve diğer tarayıcı-destekli formatlar
  const iso = new Date(t);
  if (!isNaN(iso.getTime())) return iso;

  return null;
}

// Excel seri tarihi → UTC Date (1900 epoch, 1900 artık-yıl hatası dahil)
function excelSerialToDate(serial: number): Date | null {
  if (serial < 1) return null;
  const adj = serial > 59 ? serial - 1 : serial;   // 60 = sahte 29 Şub 1900
  const d = new Date(Date.UTC(1900, 0, 1) + (adj - 1) * 86_400_000);
  return isNaN(d.getTime()) ? null : d;
}

// Hücre değeri → UTC Date
function cellToDate(v: unknown): Date | null {
  if (v instanceof Date) {
    // xlsx cellDates:true → JS Date (yerel saat) → UTC'ye çevir
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(),
                             v.getHours(), v.getMinutes()));
  }
  if (typeof v === "number") return excelSerialToDate(v);
  if (typeof v === "string") return parseDate(v);
  return null;
}

// Sayısal hücre: number döner, virgüllü string de kabul edilir
function parseNum(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v) && v >= 0) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    // Önce standart float dene; başarısız olursa Türkçe ondalık (virgül) dene
    let n = parseFloat(s);
    if (isNaN(n)) n = parseFloat(s.replace(",", "."));
    if (!isNaN(n) && n >= 0) return n;
  }
  return undefined;
}

// Ham satır kaydı → FileRow
function parseRowRecord(r: Record<string, unknown>): FileRow | null {
  const ts = r["hour"] ?? r["timestamp"] ?? r["datetime"] ?? r["Datetime (UTC)"];
  if (ts === undefined || ts === null || ts === "") return null;

  const h = cellToDate(ts);
  if (!h) return null;

  const consumption = parseNum(r["consumptionKwh"] ?? r["consumption_kwh"]);
  const production  = parseNum(r["production_kwh"]  ?? r["productionKwh"]);

  if (consumption === undefined && production === undefined) return null;
  return { hour: h, consumptionKwh: consumption, productionKwh: production };
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
function parseCsvFile(text: string): Promise<FileRow[]> {
  return new Promise((resolve, reject) => {
    const rows: FileRow[] = [];
    const parser = parse(text, { columns: true, skip_empty_lines: true, trim: true });
    parser.on("data", (r: Record<string, string>) => {
      const row = parseRowRecord(r);
      if (row) rows.push(row);
    });
    parser.on("end",   () => resolve(rows));
    parser.on("error", reject);
  });
}

// ── Excel Parser ──────────────────────────────────────────────────────────────
function parseExcelFile(buffer: Buffer): FileRow[] {
  const wb = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const rows: FileRow[] = [];
  for (const r of raw) {
    const row = parseRowRecord(r);
    if (row) rows.push(row);
  }
  return rows;
}

export const gecRoutes: FastifyPluginAsync = async (app) => {
  if (!app.hasContentTypeParser("multipart/form-data")) {
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  }

  /**
   * POST /gec/calculate
   * Content-Type: multipart/form-data
   * Field: file (CSV veya Excel .xlsx/.xls)
   *
   * Başlıklar: hour | consumptionKwh | production_kwh
   *   - consumptionKwh: opsiyonel → Scope 2 emisyon hesaplar
   *   - production_kwh: opsiyonel → CFE matching hesaplar (tüketimle birlikte)
   *   - İkisi birlikte veya ayrı ayrı olabilir
   *
   * Tarih formatları:
   *   - ISO 8601:    2025-01-01T00:00:00Z  veya  2025-01-01 00:00
   *   - Türkçe:      1.01.2025 00:00
   *
   * Query: zoneId (default: TR), periodId (opsiyonel — döneme kaydeder)
   * periodId + her iki sütun → HourlyConsumption + CFEMatchingResult güncellenir
   */
  app.post("/gec/calculate", {}, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "MISSING_FILE", message: "CSV veya Excel dosyası gerekli." });

    const filename = (data.filename ?? "").toLowerCase();
    const isExcel  = filename.endsWith(".xlsx") || filename.endsWith(".xls");

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    let rows: FileRow[];
    try {
      rows = isExcel
        ? parseExcelFile(buffer)
        : await parseCsvFile(buffer.toString("utf-8"));
    } catch {
      return reply.status(422).send({
        error: "PARSE_ERROR",
        message: "Dosya okunamadı. CSV veya Excel (.xlsx) formatını kontrol edin.",
      });
    }

    if (!rows.length) {
      return reply.status(422).send({
        error: "NO_VALID_ROWS",
        message: "Geçerli satır bulunamadı. Beklenen başlıklar: hour, consumptionKwh, production_kwh",
      });
    }

    const hasConsumption = rows.some(r => r.consumptionKwh !== undefined);
    const hasProduction  = rows.some(r => r.productionKwh  !== undefined);

    // Üretim verisi var ama tüketim yok → üretim özeti döndür
    if (!hasConsumption) {
      const prodMonth = new Map<number, { month: number; monthName: string; productionKwh: number; hours: number }>();
      let totalProd = 0;
      for (const row of rows) {
        if (row.productionKwh === undefined) continue;
        totalProd += row.productionKwh;
        const m = row.hour.getUTCMonth() + 1;
        if (!prodMonth.has(m)) prodMonth.set(m, { month: m, monthName: MONTH_NAMES[m], productionKwh: 0, hours: 0 });
        const agg = prodMonth.get(m)!;
        agg.productionKwh += row.productionKwh;
        agg.hours++;
      }
      return reply.send({
        zoneId: (request.query as { zoneId?: string }).zoneId ?? "TR",
        hasConsumption: false,
        hasProduction:  true,
        totalProductionKwh: Math.round(totalProd * 100) / 100,
        totalRows: rows.length,
        productionMonthly: Array.from(prodMonth.values())
          .sort((a, b) => a.month - b.month)
          .map(m => ({ ...m, productionKwh: Math.round(m.productionKwh * 100) / 100 })),
        savedToPeriod: false,
        savedCFE: false,
        note: "GEC hesaplama için consumptionKwh sütunu gereklidir. CFE için her iki sütunu ekleyin.",
      });
    }

    // ── GEC: tüketim × EF ──────────────────────────────────────────────────────
    const { zoneId = "TR", periodId } = request.query as { zoneId?: string; periodId?: string };
    const source = isExcel ? "excel" : "csv";

    const consumptionRows = rows.filter((r): r is FileRow & { consumptionKwh: number } =>
      r.consumptionKwh !== undefined);

    const minHour = consumptionRows.reduce((m, r) => r.hour < m ? r.hour : m, consumptionRows[0].hour);
    const maxHour = consumptionRows.reduce((m, r) => r.hour > m ? r.hour : m, consumptionRows[0].hour);

    const efRows = await prisma.$queryRaw(Prisma.sql`
      SELECT hour, ci_direct
      FROM emission_factors
      WHERE zone_id    = ${zoneId}
        AND granularity = 'hourly'
        AND hour        >= ${minHour}
        AND hour        <= ${maxHour}
      ORDER BY hour
    `) as EFRow[];

    if (!efRows.length) {
      return reply.status(404).send({
        error: "EF_NOT_FOUND",
        message: `${zoneId} zone için EF verisi bulunamadı. Mevcut zonlar için GET /ef/zones adresini kontrol edin.`,
      });
    }

    const efMap = new Map<string, number>();
    for (const ef of efRows) {
      efMap.set(new Date(ef.hour).toISOString().slice(0, 13), Number(ef.ci_direct));
    }

    const monthMap = new Map<number, MonthAgg>();
    let totalConsumptionKwh = 0;
    let totalProductionKwh  = 0;
    let totalTco2           = 0;
    let matchedHours        = 0;

    for (const row of rows) {
      const month = row.hour.getUTCMonth() + 1;
      if (!monthMap.has(month)) {
        monthMap.set(month, {
          month, monthName: MONTH_NAMES[month],
          consumptionKwh: 0, productionKwh: 0, tco2: 0, efSum: 0, hours: 0,
        });
      }
      const m = monthMap.get(month)!;

      if (row.productionKwh !== undefined) {
        m.productionKwh += row.productionKwh;
        totalProductionKwh += row.productionKwh;
      }

      if (row.consumptionKwh === undefined) continue;
      const key = row.hour.toISOString().slice(0, 13);
      const ci  = efMap.get(key);
      if (ci == null) continue;

      const tco2 = row.consumptionKwh * ci / 1_000_000;
      m.consumptionKwh += row.consumptionKwh;
      m.tco2           += tco2;
      m.efSum          += ci;
      m.hours++;

      totalConsumptionKwh += row.consumptionKwh;
      totalTco2           += tco2;
      matchedHours++;
    }

    const monthly = Array.from(monthMap.values())
      .sort((a, b) => a.month - b.month)
      .map(m => ({
        month:          m.month,
        monthName:      m.monthName,
        consumptionKwh: Math.round(m.consumptionKwh * 100) / 100,
        productionKwh:  Math.round(m.productionKwh  * 100) / 100,
        tco2:           Math.round(m.tco2            * 1000) / 1000,
        avgEfGco2Kwh:   Math.round((m.hours > 0 ? m.efSum / m.hours : 0) * 100) / 100,
        hours:          m.hours,
      }));

    const avgEf = matchedHours > 0
      ? monthly.reduce((s, m) => s + m.avgEfGco2Kwh * m.hours, 0) / matchedHours
      : 0;

    // ── Döneme kaydet ──────────────────────────────────────────────────────────
    let savedToPeriod = false;
    let savedCFE      = false;
    let cfeResult: object | null = null;

    if (periodId) {
      const period = await prisma.reportingPeriod.findFirst({
        where: { id: periodId, installation: { tenantId: request.tenantId } },
      });

      if (period) {
        // Saatlik tüketim kaydet
        await prisma.$transaction(
          consumptionRows.map(r =>
            prisma.hourlyConsumption.upsert({
              where:  { periodId_hour: { periodId, hour: r.hour } },
              create: { periodId, hour: r.hour, consumptionKwh: r.consumptionKwh, source },
              update: { consumptionKwh: r.consumptionKwh, source },
            })
          )
        );
        savedToPeriod = true;

        // CFE matching: her iki sütun da mevcutsa
        if (hasProduction) {
          const slots: HourlySlot[] = rows
            .filter((r): r is FileRow & { consumptionKwh: number; productionKwh: number } =>
              r.consumptionKwh !== undefined && r.productionKwh !== undefined)
            .map(r => ({
              hour:           r.hour.toISOString(),
              consumptionKwh: r.consumptionKwh,
              productionKwh:  r.productionKwh,
            }));

          if (slots.length >= 1) {
            const cfeCalc = calculateCFEMatching({
              installationId: period.installationId,
              periodLabel:    period.periodName,
              slots,
              gecDataVersion: `${source}-${new Date().toISOString().slice(0, 10)}`,
            });

            const stored = await prisma.cFEMatchingResult.upsert({
              where:  { periodId },
              create: {
                periodId,
                totalConsumptionKwh: cfeCalc.totalConsumptionKwh,
                totalProductionKwh:  cfeCalc.totalProductionKwh,
                totalMatchedKwh:     cfeCalc.totalMatchedKwh,
                cfeScore:            cfeCalc.cfeScore,
                ppaSurplusKwh:       cfeCalc.ppaSurplusKwh,
                ppaDeficitKwh:       cfeCalc.ppaDeficitKwh,
                matchedHours:        cfeCalc.matchedHours,
                partialHours:        cfeCalc.partialHours,
                unmatchedHours:      cfeCalc.unmatchedHours,
                monthlyBreakdown:    cfeCalc.monthlyBreakdown as object[],
                gecDataVersion:      cfeCalc.gecDataVersion,
              },
              update: {
                totalConsumptionKwh: cfeCalc.totalConsumptionKwh,
                totalProductionKwh:  cfeCalc.totalProductionKwh,
                totalMatchedKwh:     cfeCalc.totalMatchedKwh,
                cfeScore:            cfeCalc.cfeScore,
                ppaSurplusKwh:       cfeCalc.ppaSurplusKwh,
                ppaDeficitKwh:       cfeCalc.ppaDeficitKwh,
                matchedHours:        cfeCalc.matchedHours,
                partialHours:        cfeCalc.partialHours,
                unmatchedHours:      cfeCalc.unmatchedHours,
                monthlyBreakdown:    cfeCalc.monthlyBreakdown as object[],
                gecDataVersion:      cfeCalc.gecDataVersion,
                calculatedAt:        new Date(),
              },
            });

            cfeResult = {
              cfeScore:            Math.round(cfeCalc.cfeScore * 1000) / 10, // % olarak
              totalConsumptionKwh: Math.round(cfeCalc.totalConsumptionKwh),
              totalProductionKwh:  Math.round(cfeCalc.totalProductionKwh),
              totalMatchedKwh:     Math.round(cfeCalc.totalMatchedKwh),
              matchedHours:        cfeCalc.matchedHours,
              calculatedAt:        stored.calculatedAt,
            };
            savedCFE = true;

            await prisma.auditLog.create({
              data: {
                tenantId:   request.tenantId,
                userId:     request.userId ?? undefined,
                action:     "IMPORT",
                resource:   "CFEMatchingResult",
                resourceId: periodId,
                payload:    { slots: slots.length, cfeScore: cfeCalc.cfeScore, source },
              },
            });
          }
        }

        await prisma.auditLog.create({
          data: {
            tenantId:   request.tenantId,
            userId:     request.userId ?? undefined,
            action:     "IMPORT",
            resource:   "HourlyConsumption",
            resourceId: periodId,
            payload:    { rows: rows.length, matchedHours, zoneId, hasProduction, source },
          },
        });
      }
    }

    return reply.send({
      zoneId,
      hasConsumption,
      hasProduction,
      totalConsumptionKwh: Math.round(totalConsumptionKwh * 100) / 100,
      totalTco2:           Math.round(totalTco2 * 1000)          / 1000,
      avgEfGco2Kwh:        Math.round(avgEf     * 100)           / 100,
      matchedHours,
      totalRows:           rows.length,
      totalProductionKwh:  Math.round(totalProductionKwh * 100) / 100,
      monthly,
      methodology: "hourly_consumption_x_location_based_ef",
      unit: { consumption: "kWh", emission: "tCO₂eq", ef: "gCO₂/kWh" },
      savedToPeriod,
      savedCFE,
      ...(cfeResult ? { cfeResult } : {}),
    });
  });
};
