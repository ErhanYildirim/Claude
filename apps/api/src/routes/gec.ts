import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { Prisma } from "@voltfox/db";
import { parse } from "csv-parse";
import multipart from "@fastify/multipart";

// ── GEC — Granular Emission Calculation API ───────────────────────────────────
// Stateless calculator: CSV upload → join with hourly EF → tCO₂ per hour

type EFRow = { hour: Date; ci_direct: number };

const MONTH_NAMES = ["", "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

interface MonthAgg {
  month: number; monthName: string;
  consumptionKwh: number; tco2: number; efSum: number; hours: number;
}

function parseCsv(text: string): Promise<Array<{ hour: Date; consumptionKwh: number }>> {
  return new Promise((resolve, reject) => {
    const rows: Array<{ hour: Date; consumptionKwh: number }> = [];
    const parser = parse(text, { columns: true, skip_empty_lines: true, trim: true });

    parser.on("data", (r: Record<string, string>) => {
      const ts  = r["hour"] ?? r["timestamp"] ?? r["datetime"] ?? r["Datetime (UTC)"];
      const kwh = parseFloat(r["consumptionKwh"] ?? r["consumption_kwh"] ?? "");
      if (!ts || isNaN(kwh) || kwh < 0) return;
      const h = new Date(ts);
      if (isNaN(h.getTime())) return;
      rows.push({ hour: h, consumptionKwh: kwh });
    });

    parser.on("end",   () => resolve(rows));
    parser.on("error", reject);
  });
}

export const gecRoutes: FastifyPluginAsync = async (app) => {
  if (!app.hasContentTypeParser("multipart/form-data")) {
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } });
  }

  /**
   * POST /gec/calculate
   * Content-Type: multipart/form-data
   * Field: file (CSV, başlıklar: hour, consumptionKwh)
   * Query:  zoneId (default: TR)
   *
   * Stateless — veri kaydedilmez, hesaplama anında döner.
   * tCO₂ = Σ(consumptionKwh × ci_direct) / 1_000_000
   */
  app.post("/gec/calculate", {}, async (request, reply) => {
    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "MISSING_FILE", message: "CSV dosyası gerekli." });

    const chunks: Buffer[] = [];
    for await (const chunk of data.file) chunks.push(chunk);
    const csvText = Buffer.concat(chunks).toString("utf-8");

    const rows = await parseCsv(csvText);
    if (!rows.length) {
      return reply.status(422).send({
        error: "NO_VALID_ROWS",
        message: "Geçerli satır bulunamadı. Beklenen başlıklar: hour, consumptionKwh",
      });
    }

    const zoneId  = (request.query as { zoneId?: string }).zoneId ?? "TR";
    const minHour = rows.reduce((m, r) => r.hour < m ? r.hour : m, rows[0].hour);
    const maxHour = rows.reduce((m, r) => r.hour > m ? r.hour : m, rows[0].hour);

    // Saatlik EF — yalnızca veri aralığını çek
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
        message: `${zoneId} zone için EF verisi bulunamadı. Desteklenen: TR`,
      });
    }

    // Saat → ci_direct lookup ("2024-01-01T00" formatı)
    const efMap = new Map<string, number>();
    for (const ef of efRows) {
      efMap.set(new Date(ef.hour).toISOString().slice(0, 13), Number(ef.ci_direct));
    }

    const monthMap = new Map<number, MonthAgg>();
    let totalConsumptionKwh = 0;
    let totalTco2 = 0;
    let matchedHours = 0;

    for (const row of rows) {
      const key = row.hour.toISOString().slice(0, 13);
      const ci  = efMap.get(key);
      if (ci == null) continue;

      const tco2  = row.consumptionKwh * ci / 1_000_000; // gCO₂ → tCO₂
      const month = row.hour.getUTCMonth() + 1;

      if (!monthMap.has(month)) {
        monthMap.set(month, {
          month, monthName: MONTH_NAMES[month],
          consumptionKwh: 0, tco2: 0, efSum: 0, hours: 0,
        });
      }
      const m = monthMap.get(month)!;
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
        consumptionKwh: Math.round(m.consumptionKwh * 100)    / 100,
        tco2:           Math.round(m.tco2           * 1000)   / 1000,
        avgEfGco2Kwh:   Math.round((m.hours > 0 ? m.efSum / m.hours : 0) * 100) / 100,
        hours:          m.hours,
      }));

    const avgEf = matchedHours > 0
      ? monthly.reduce((s, m) => s + m.avgEfGco2Kwh * m.hours, 0) / matchedHours
      : 0;

    return reply.send({
      zoneId,
      totalConsumptionKwh: Math.round(totalConsumptionKwh * 100) / 100,
      totalTco2:           Math.round(totalTco2 * 1000)          / 1000,
      avgEfGco2Kwh:        Math.round(avgEf    * 100)            / 100,
      matchedHours,
      totalRows:           rows.length,
      monthly,
      methodology: "hourly_consumption_x_location_based_ef",
      unit: { consumption: "kWh", emission: "tCO₂eq", ef: "gCO₂/kWh" },
    });
  });
};
