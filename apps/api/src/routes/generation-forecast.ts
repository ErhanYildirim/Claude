// Task #123 — GET /generation/forecast endpoint'leri
import type { FastifyPluginAsync } from "fastify";
import { prisma, Prisma } from "@voltfox/db";

const VALID_PSR_TYPES   = new Set(["B16", "B18", "B19", "B10", "B11", "B12", "TOTAL_LOAD"]);
const VALID_RECORD_TYPES = new Set(["actual", "forecast"]);

export const generationForecastRoutes: FastifyPluginAsync = async (app) => {

  // GET /generation/forecast — üretim tahmini serisi
  app.get<{
    Querystring: {
      zone?:        string;
      from?:        string;
      to?:          string;
      psr_type?:    string;   // virgülle ayrılmış: B16,B19
      record_type?: string;
      limit?:       string;
    };
  }>(
    "/generation/forecast",
    async (request, reply) => {
      const { zone, from, to, psr_type, record_type, limit } = request.query;

      const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; })();
      const toDate   = to   ? new Date(to)   : (() => { const d = new Date(); d.setDate(d.getDate() + 2); return d; })();

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return reply.status(400).send({ error: "Geçersiz tarih formatı" });
      }

      const psrTypes = psr_type
        ? psr_type.split(",").map(s => s.trim()).filter(s => VALID_PSR_TYPES.has(s))
        : [...VALID_PSR_TYPES];

      if (record_type && !VALID_RECORD_TYPES.has(record_type)) {
        return reply.status(400).send({ error: `Geçersiz record_type: actual | forecast` });
      }

      const pageLimit = Math.min(parseInt(limit ?? "5000", 10), 10000);

      const rows = await prisma.$queryRaw<Array<{
        zone_id: string; hour: Date; psr_type: string; record_type: string;
        quantity_mw: number; source: string; forecast_made_at: Date | null;
        confidence_low: number | null; confidence_high: number | null;
      }>>(Prisma.sql`
        SELECT zone_id, hour, psr_type, record_type, quantity_mw,
               source, forecast_made_at, confidence_low, confidence_high
        FROM generation_forecasts
        WHERE hour       >= ${fromDate}
          AND hour       <= ${toDate}
          AND psr_type    = ANY(${psrTypes}::text[])
          ${zone        ? Prisma.sql`AND zone_id     = ${zone}`        : Prisma.empty}
          ${record_type ? Prisma.sql`AND record_type = ${record_type}` : Prisma.empty}
        ORDER BY zone_id ASC, hour ASC, psr_type ASC
        LIMIT ${pageLimit}
      `);

      return reply.send({
        forecasts: rows.map(r => ({
          zone:           r.zone_id,
          hour:           r.hour.toISOString(),
          psrType:        r.psr_type,
          recordType:     r.record_type,
          quantityMw:     r.quantity_mw,
          source:         r.source,
          forecastMadeAt: r.forecast_made_at?.toISOString() ?? null,
          confidenceLow:  r.confidence_low,
          confidenceHigh: r.confidence_high,
        })),
        meta: {
          zone:     zone ?? "all",
          from:     fromDate.toISOString(),
          to:       toDate.toISOString(),
          psrTypes,
          count:    rows.length,
        },
      });
    }
  );

  // GET /generation/forecast/summary — bugün + yarın özet
  app.get<{ Querystring: { zone?: string } }>(
    "/generation/forecast/summary",
    async (request, reply) => {
      const zone = request.query.zone ?? "DE";

      const now       = new Date();
      const todayStart = new Date(now); todayStart.setUTCHours(0, 0, 0, 0);
      const tomorrowEnd = new Date(todayStart); tomorrowEnd.setUTCDate(tomorrowEnd.getUTCDate() + 2);

      const rows = await prisma.$queryRaw<Array<{
        hour: Date; psr_type: string; record_type: string; quantity_mw: number;
      }>>(Prisma.sql`
        SELECT hour, psr_type, record_type, quantity_mw
        FROM generation_forecasts
        WHERE zone_id = ${zone}
          AND hour >= ${todayStart}
          AND hour <= ${tomorrowEnd}
          AND psr_type IN ('B16', 'B18', 'B19', 'TOTAL_LOAD')
        ORDER BY hour ASC
      `);

      // Saat bazında topla
      const byHour = new Map<string, { solar: number; wind: number; load: number }>();
      for (const r of rows) {
        const key = r.hour.toISOString();
        if (!byHour.has(key)) byHour.set(key, { solar: 0, wind: 0, load: 0 });
        const h = byHour.get(key)!;
        if (r.psr_type === "B16") h.solar += r.quantity_mw;
        if (r.psr_type === "B18" || r.psr_type === "B19") h.wind += r.quantity_mw;
        if (r.psr_type === "TOTAL_LOAD") h.load += r.quantity_mw;
      }

      const entries = [...byHour.entries()].map(([hour, v]) => ({
        hour,
        solarMw: v.solar,
        windMw:  v.wind,
        loadMw:  v.load,
        rePct:   v.load > 0 ? Math.round(((v.solar + v.wind) / v.load) * 1000) / 10 : null,
      }));

      // Peak saatler
      const peakSolar = entries.reduce((best, e) => e.solarMw > (best?.solarMw ?? 0) ? e : best, entries[0]);
      const peakWind  = entries.reduce((best, e) => e.windMw  > (best?.windMw  ?? 0) ? e : best, entries[0]);
      const maxRe     = entries.reduce((best, e) => (e.rePct ?? 0) > (best?.rePct ?? 0) ? e : best, entries[0]);

      return reply.send({
        zone,
        summary: {
          peakSolarHour:  peakSolar?.hour ?? null,
          peakSolarMw:    peakSolar?.solarMw ?? null,
          peakWindHour:   peakWind?.hour ?? null,
          peakWindMw:     peakWind?.windMw ?? null,
          maxRePctHour:   maxRe?.hour ?? null,
          maxRePct:       maxRe?.rePct ?? null,
          avgRePct:       avg(entries.map(e => e.rePct)),
        },
        series: entries,
        updatedAt: now.toISOString(),
      });
    }
  );

  // GET /generation/actual — gerçekleşen üretim
  app.get<{
    Querystring: { zone?: string; from?: string; to?: string; psr_type?: string };
  }>(
    "/generation/actual",
    async (request, reply) => {
      const { zone, from, to, psr_type } = request.query;

      const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 7); return d; })();
      const toDate   = to   ? new Date(to)   : new Date();

      const psrTypes = psr_type
        ? psr_type.split(",").map(s => s.trim()).filter(s => VALID_PSR_TYPES.has(s))
        : ["B16", "B18", "B19", "B10", "B11", "B12"];

      const rows = await prisma.$queryRaw<Array<{
        zone_id: string; hour: Date; psr_type: string; quantity_mw: number; source: string;
      }>>(Prisma.sql`
        SELECT zone_id, hour, psr_type, quantity_mw, source
        FROM generation_forecasts
        WHERE record_type = 'actual'
          AND hour       >= ${fromDate}
          AND hour       <= ${toDate}
          AND psr_type    = ANY(${psrTypes}::text[])
          ${zone ? Prisma.sql`AND zone_id = ${zone}` : Prisma.empty}
        ORDER BY zone_id ASC, hour ASC, psr_type ASC
        LIMIT 10000
      `);

      return reply.send({
        actuals: rows.map(r => ({
          zone:       r.zone_id,
          hour:       r.hour.toISOString(),
          psrType:    r.psr_type,
          quantityMw: r.quantity_mw,
          source:     r.source,
        })),
        meta: { zone: zone ?? "all", from: fromDate.toISOString(), to: toDate.toISOString(), count: rows.length },
      });
    }
  );
};

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 10) / 10;
}
