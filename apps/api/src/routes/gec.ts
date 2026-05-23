import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { Prisma } from "@voltfox/db";
import { parse } from "csv-parse";
import multipart from "@fastify/multipart";
import * as XLSX from "xlsx";
import { calculateCFEMatching } from "../../../../src/cbam/cfe-matching.js";
import type { HourlySlot } from "../../../../src/cbam/cfe-matching.js";

// ── GEC — Granular Emission Calculation API ───────────────────────────────────

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

// Kullanıcının seçtiği kolon eşlemesi
interface ColumnMap {
  hour?:        string;  // hangi sütun = saat
  consumption?: string;  // hangi sütun = tüketimKwh
  production?:  string;  // hangi sütun = üretimKwh (opsiyonel)
}

// ── Tarih ayrıştırıcısı ───────────────────────────────────────────────────────
function parseDate(s: string): Date | null {
  if (!s) return null;
  const t = s.trim();

  // Türkçe: D.MM.YYYY HH:mm
  const tr = t.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\s+(\d{1,2}):(\d{2})$/);
  if (tr) {
    const d = new Date(Date.UTC(+tr[3], +tr[2] - 1, +tr[1], +tr[4], +tr[5]));
    if (!isNaN(d.getTime())) return d;
  }

  // Konsolide / OSOS: YYYY-MM-DD HH:mm:ss (veya HH:mm) — açık UTC
  const isoSpc = t.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (isoSpc) {
    const d = new Date(Date.UTC(+isoSpc[1], +isoSpc[2] - 1, +isoSpc[3], +isoSpc[4], +isoSpc[5]));
    if (!isNaN(d.getTime())) return d;
  }

  // ISO 8601 (Z suffix veya offset)
  if (/Z$|[+-]\d{2}:\d{2}$/.test(t)) {
    const iso = new Date(t);
    if (!isNaN(iso.getTime())) return iso;
  }

  return null;
}

function excelSerialToDate(serial: number): Date | null {
  if (serial < 1) return null;
  const adj = serial > 59 ? serial - 1 : serial;
  const d = new Date(Date.UTC(1900, 0, 1) + (adj - 1) * 86_400_000);
  return isNaN(d.getTime()) ? null : d;
}

function cellToDate(v: unknown): Date | null {
  if (v instanceof Date) {
    return new Date(Date.UTC(v.getFullYear(), v.getMonth(), v.getDate(),
                             v.getHours(), v.getMinutes()));
  }
  if (typeof v === "number") return excelSerialToDate(v);
  if (typeof v === "string") return parseDate(v);
  return null;
}

function parseNum(v: unknown): number | undefined {
  if (typeof v === "number" && isFinite(v) && v >= 0) return v;
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return undefined;
    let n = parseFloat(s);
    if (isNaN(n)) n = parseFloat(s.replace(",", "."));
    if (!isNaN(n) && n >= 0) return n;
  }
  return undefined;
}

// Esnek alan arama: string veya regex ile eşleşen ilk değeri döner
function findVal(r: Record<string, unknown>, ...patterns: (string | RegExp)[]): unknown {
  for (const pat of patterns) {
    if (typeof pat === "string") {
      if (Object.prototype.hasOwnProperty.call(r, pat)) return r[pat];
    } else {
      const key = Object.keys(r).find(k => pat.test(k));
      if (key !== undefined) return r[key];
    }
  }
  return undefined;
}

// Kolon eşleme uygula: kullanıcı seçimi → standart alan adlarına kopyala
function remapRow(r: Record<string, unknown>, colMap: ColumnMap): Record<string, unknown> {
  const out = { ...r };
  if (colMap.hour        && colMap.hour in r)        out["hour"]           = r[colMap.hour];
  if (colMap.consumption && colMap.consumption in r) out["consumptionKwh"] = r[colMap.consumption];
  if (colMap.production  && colMap.production in r)  out["production_kwh"] = r[colMap.production];
  return out;
}

// Kolon adlarından otomatik eşlem tahmini
function detectSuggestedMap(columns: string[]): ColumnMap {
  const map: ColumnMap = {};
  for (const col of columns) {
    const lc = col.toLowerCase().trim();
    if (!map.hour && (
      /^(hour|zaman|timestamp|datetime)$/i.test(lc) ||
      lc.includes("zaman") || lc.includes("tarih") || lc.includes("saat")
    )) { map.hour = col; }

    if (!map.consumption && (
      /^(consumptionkwh|consumption_kwh)$/i.test(lc) ||
      /t.{0,5}ketim/i.test(col) ||
      lc.includes("consumption") || lc.includes("tüketim") ||
      lc.includes("tuketim") || lc.includes("çekiş") || lc.includes("cekis")
    )) { map.consumption = col; }

    if (!map.production && (
      /^(production_kwh|productionkwh)$/i.test(lc) ||
      /[uü].{0,3}retim/i.test(col) ||
      lc.includes("production") || lc.includes("üretim") ||
      lc.includes("uretim") || lc.includes("veriş") || lc.includes("veris")
    )) { map.production = col; }
  }
  return map;
}

// Birim dönüşümü → kWh
function toKwh(value: number, unit: string): number {
  switch (unit) {
    case "Wh":  return value / 1000;
    case "MWh": return value * 1_000;
    case "GWh": return value * 1_000_000;
    default:    return value; // kWh
  }
}

// Ham satır → FileRow (kolon eşlemesi zaten uygulanmış olmalı)
function parseRowRecord(r: Record<string, unknown>): FileRow | null {
  const ts = findVal(r,
    "hour", "timestamp", "datetime", "Datetime (UTC)", "Zaman", "zaman",
    /^zaman$/i,
  );
  if (ts === undefined || ts === null || ts === "") return null;

  const h = cellToDate(ts);
  if (!h) return null;

  const consumption = parseNum(findVal(r,
    "consumptionKwh", "consumption_kwh",
    /t.{0,5}ketim/i,
    /consumption/i,
  ));
  const production = parseNum(findVal(r,
    "production_kwh", "productionKwh",
    /[uü].{0,3}retim/i,
    /production/i,
  ));

  if (consumption === undefined && production === undefined) return null;
  return { hour: h, consumptionKwh: consumption, productionKwh: production };
}

// ── CSV Parser ────────────────────────────────────────────────────────────────
// Ayraç tespiti + Konsolide format normalizasyonu + opsiyonel colMap uygulaması
function parseCsvFile(text: string, colMap?: ColumnMap): Promise<FileRow[]> {
  const clean  = text.replace(/^﻿/, "");
  const lines  = clean.split(/\r?\n/);
  const hdrIdx = lines.findIndex(l => l.trim() !== "");
  const header = lines[hdrIdx] ?? "";
  const delimiter = header.includes(";") ? ";" : ",";

  let parseText = clean;

  if (delimiter === ";") {
    const cols = header.split(";").map(c => c.trim());
    if (cols[0] === "EIC" && cols[1] === "Zaman") {
      // Konsolide / OSOS / TEDAŞ: başlığı normalize et
      const newLines = [...lines];
      newLines[hdrIdx] = "_eic;hour;consumptionKwh;production_kwh";
      parseText = newLines.join("\n");
    }
  }

  return new Promise((resolve, reject) => {
    const rows: FileRow[] = [];
    const parser = parse(parseText, {
      columns: true, skip_empty_lines: true, trim: true, delimiter,
    });
    parser.on("data", (r: Record<string, string>) => {
      const mapped = colMap ? remapRow(r as Record<string, unknown>, colMap) : r;
      const row = parseRowRecord(mapped);
      if (row) rows.push(row);
    });
    parser.on("end",   () => resolve(rows));
    parser.on("error", reject);
  });
}

// ── Excel Parser ──────────────────────────────────────────────────────────────
function parseExcelFile(buffer: Buffer, colMap?: ColumnMap): FileRow[] {
  const wb  = XLSX.read(buffer, { type: "buffer", cellDates: true });
  const ws  = wb.Sheets[wb.SheetNames[0]];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
  const rows: FileRow[] = [];
  for (const r of raw) {
    const mapped = colMap ? remapRow(r, colMap) : r;
    const row    = parseRowRecord(mapped);
    if (row) rows.push(row);
  }
  return rows;
}

// ── Kolon bilgisi için CSV header + preview çıkar ─────────────────────────────
function extractCsvColumnsAndPreview(
  text:  string,
): { columns: string[]; preview: Record<string, string>[]; isKonsolide: boolean } {
  const clean     = text.replace(/^﻿/, "");
  const lines     = clean.split(/\r?\n/).filter(l => l.trim() !== "");
  const header    = lines[0] ?? "";
  const delimiter = header.includes(";") ? ";" : ",";
  const rawCols   = header.split(delimiter).map(c => c.trim());

  // Konsolide tespiti
  const isKonsolide = rawCols[0] === "EIC" && rawCols[1] === "Zaman";
  const columns     = isKonsolide
    ? ["EIC", "Zaman", "Tüketim (Çekiş)", "Üretim (Veriş)"]
    : rawCols;

  const preview = lines.slice(1, 6).map(line => {
    const vals = line.split(delimiter);
    const obj: Record<string, string> = {};
    columns.forEach((col, i) => { obj[col] = (vals[i] ?? "").trim(); });
    return obj;
  });

  return { columns, preview, isKonsolide };
}

export const gecRoutes: FastifyPluginAsync = async (app) => {
  if (!app.hasContentTypeParser("multipart/form-data")) {
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  }

  // ── POST /gec/columns — kolon adları + önizleme satırları ───────────────────
  // Dosyayı parse etmeden önce kolon seçimi için UI'ya veri sağlar
  app.post("/gec/columns", {}, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "MISSING_FILE" });

    const filename = (data.filename ?? "").toLowerCase();
    const isExcel  = filename.endsWith(".xlsx") || filename.endsWith(".xls");

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    try {
      let columns: string[];
      let preview: Record<string, string>[];

      if (isExcel) {
        const wb  = XLSX.read(buffer, { type: "buffer", cellDates: false, raw: false });
        const ws  = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "", raw: false });
        columns = raw.length > 0 ? Object.keys(raw[0]) : [];
        preview = raw.slice(0, 5).map(r => {
          const obj: Record<string, string> = {};
          for (const [k, v] of Object.entries(r)) obj[k] = String(v ?? "");
          return obj;
        });
      } else {
        const text = buffer.toString("utf-8");
        const extracted = extractCsvColumnsAndPreview(text);
        columns = extracted.columns;
        preview = extracted.preview;
      }

      const suggestedMap = detectSuggestedMap(columns);
      return reply.send({ columns, preview, suggestedMap });
    } catch {
      return reply.status(422).send({
        error: "PARSE_ERROR",
        message: "Kolon bilgisi alınamadı. CSV veya Excel formatını kontrol edin.",
      });
    }
  });

  // ── POST /gec/calculate ──────────────────────────────────────────────────────
  // Query: zoneId, periodId, colHour, colConsumption, colProduction
  app.post("/gec/calculate", {}, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "MISSING_FILE", message: "CSV veya Excel dosyası gerekli." });

    const filename = (data.filename ?? "").toLowerCase();
    const isExcel  = filename.endsWith(".xlsx") || filename.endsWith(".xls");

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const buffer = Buffer.concat(chunks);

    // Kullanıcı kolon eşlemesi + birim seçimi (opsiyonel)
    const q = request.query as {
      zoneId?: string; periodId?: string;
      colHour?: string; colConsumption?: string; colProduction?: string;
      colConsUnit?: string; colProdUnit?: string;   // Wh | kWh | MWh | GWh
    };
    const colMap: ColumnMap | undefined =
      (q.colHour || q.colConsumption || q.colProduction)
        ? { hour: q.colHour || undefined, consumption: q.colConsumption || undefined, production: q.colProduction || undefined }
        : undefined;

    const consUnit = q.colConsUnit ?? "kWh";
    const prodUnit = q.colProdUnit ?? "kWh";

    let rows: FileRow[];
    try {
      rows = isExcel
        ? parseExcelFile(buffer, colMap)
        : await parseCsvFile(buffer.toString("utf-8"), colMap);
    } catch {
      return reply.status(422).send({
        error: "PARSE_ERROR",
        message: "Dosya okunamadı. CSV veya Excel (.xlsx) formatını kontrol edin.",
      });
    }

    if (!rows.length) {
      return reply.status(422).send({
        error: "NO_VALID_ROWS",
        message: "Geçerli satır bulunamadı. Kolon eşleştirmesini kontrol edin.",
      });
    }

    // Birim dönüşümü uygula (kWh dışındaki birimler)
    if (consUnit !== "kWh" || prodUnit !== "kWh") {
      for (const row of rows) {
        if (row.consumptionKwh !== undefined) row.consumptionKwh = toKwh(row.consumptionKwh, consUnit);
        if (row.productionKwh  !== undefined) row.productionKwh  = toKwh(row.productionKwh,  prodUnit);
      }
    }

    const hasConsumption = rows.some(r => r.consumptionKwh !== undefined);
    const hasProduction  = rows.some(r => r.productionKwh  !== undefined);

    // Sadece üretim verisi varsa özet döndür
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
        zoneId: q.zoneId ?? "TR",
        hasConsumption: false, hasProduction: true,
        totalProductionKwh: Math.round(totalProd * 100) / 100,
        totalRows: rows.length,
        productionMonthly: Array.from(prodMonth.values())
          .sort((a, b) => a.month - b.month)
          .map(m => ({ ...m, productionKwh: Math.round(m.productionKwh * 100) / 100 })),
        savedToPeriod: false, savedCFE: false,
        note: "GEC hesaplama için Tüketim sütunu gereklidir.",
      });
    }

    const { zoneId = "TR", periodId } = q;
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
        month: m.month, monthName: m.monthName,
        consumptionKwh: Math.round(m.consumptionKwh * 100) / 100,
        productionKwh:  Math.round(m.productionKwh  * 100) / 100,
        tco2:           Math.round(m.tco2            * 1000) / 1000,
        avgEfGco2Kwh:   Math.round((m.hours > 0 ? m.efSum / m.hours : 0) * 100) / 100,
        hours:          m.hours,
      }));

    const avgEf = matchedHours > 0
      ? monthly.reduce((s, m) => s + m.avgEfGco2Kwh * m.hours, 0) / matchedHours
      : 0;

    let savedToPeriod = false;
    let savedCFE      = false;
    let cfeResult: object | null = null;

    if (periodId) {
      const period = await prisma.reportingPeriod.findFirst({
        where: { id: periodId, installation: { tenantId: request.tenantId } },
      });

      if (period) {
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
              cfeScore:            Math.round(cfeCalc.cfeScore * 10) / 10,
              totalConsumptionKwh: Math.round(cfeCalc.totalConsumptionKwh),
              totalProductionKwh:  Math.round(cfeCalc.totalProductionKwh),
              totalMatchedKwh:     Math.round(cfeCalc.totalMatchedKwh),
              matchedHours:        cfeCalc.matchedHours,
              calculatedAt:        stored.calculatedAt,
            };
            savedCFE = true;

            await prisma.auditLog.create({
              data: {
                tenantId: request.tenantId, userId: request.userId ?? undefined,
                action: "IMPORT", resource: "CFEMatchingResult", resourceId: periodId,
                payload: { slots: slots.length, cfeScore: cfeCalc.cfeScore, source },
              },
            });
          }
        }

        await prisma.auditLog.create({
          data: {
            tenantId: request.tenantId, userId: request.userId ?? undefined,
            action: "IMPORT", resource: "HourlyConsumption", resourceId: periodId,
            payload: { rows: rows.length, matchedHours, zoneId, hasProduction, source },
          },
        });
      }
    }

    return reply.send({
      zoneId, hasConsumption, hasProduction,
      totalConsumptionKwh: Math.round(totalConsumptionKwh * 100) / 100,
      totalTco2:           Math.round(totalTco2 * 1000) / 1000,
      avgEfGco2Kwh:        Math.round(avgEf     * 100)  / 100,
      matchedHours, totalRows: rows.length,
      totalProductionKwh:  Math.round(totalProductionKwh * 100) / 100,
      monthly,
      methodology: "hourly_consumption_x_location_based_ef",
      unit: { consumption: "kWh", emission: "tCO₂eq", ef: "gCO₂/kWh" },
      savedToPeriod, savedCFE,
      ...(cfeResult ? { cfeResult } : {}),
    });
  });
};
