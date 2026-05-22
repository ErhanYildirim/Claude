import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { Prisma } from "@voltfox/db";

// ── EF Veri Servisi — Granular Emission Factors API ───────────────────────────
// All endpoints are public (no auth required) — reference data, not tenant data.

type EFZoneRow   = { zone_id: string; zone_name: string; country: string; row_count: bigint };
type EFSumRow    = { zone_id: string; zone_name: string; country: string; avg_ci_direct: number; min_ci_direct: number; max_ci_direct: number; avg_cfe_pct: number; avg_re_pct: number; row_count: bigint };
type EFHourRow   = { hour: Date; ci_direct: number; ci_lifecycle: number; cfe_pct: number; re_pct: number; data_estimated: boolean };
type EFMonthRow  = { month: number; avg_ci: number; avg_cfe: number; avg_re: number; data_points: bigint };
type ExistsRow   = { exists: boolean };

export const efRoutes: FastifyPluginAsync = async (app) => {

  // GET /ef/zones — list all available zones with metadata
  app.get("/ef/zones", { config: { public: true } }, async (_req, reply) => {
    const zones = await prisma.$queryRaw(Prisma.sql`
      SELECT
        zone_id,
        MAX(zone_name)   AS zone_name,
        MAX(country)     AS country,
        COUNT(*)::bigint AS row_count
      FROM emission_factors
      WHERE granularity = 'hourly'
      GROUP BY zone_id
      ORDER BY country, zone_id
    `) as EFZoneRow[];

    return reply.send({
      count: zones.length,
      zones: zones.map((z: EFZoneRow) => ({
        zoneId:   z.zone_id,
        zoneName: z.zone_name,
        country:  z.country,
        rowCount: Number(z.row_count),
      })),
    });
  });

  // GET /ef/zones/:zoneId — zone summary stats (min, max, avg CI for 2024)
  app.get("/ef/zones/:zoneId", { config: { public: true } }, async (request, reply) => {
    const { zoneId } = request.params as { zoneId: string };

    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        zone_id, MAX(zone_name) as zone_name, MAX(country) as country,
        ROUND(AVG(ci_direct)::numeric, 2)    as avg_ci_direct,
        ROUND(MIN(ci_direct)::numeric, 2)    as min_ci_direct,
        ROUND(MAX(ci_direct)::numeric, 2)    as max_ci_direct,
        ROUND(AVG(cfe_pct)::numeric, 2)      as avg_cfe_pct,
        ROUND(AVG(re_pct)::numeric, 2)       as avg_re_pct,
        COUNT(*)::bigint                     as row_count
      FROM emission_factors
      WHERE zone_id = ${zoneId} AND granularity = 'hourly'
      GROUP BY zone_id
    `) as EFSumRow[];

    if (!rows.length) return reply.status(404).send({ error: "ZONE_NOT_FOUND" });
    const z: EFSumRow = rows[0];

    return reply.send({
      zoneId:       z.zone_id,
      zoneName:     z.zone_name,
      country:      z.country,
      year:         2024,
      granularity:  "hourly",
      ciDirect:     { avg: Number(z.avg_ci_direct), min: Number(z.min_ci_direct), max: Number(z.max_ci_direct) },
      cfePct:       { avg: Number(z.avg_cfe_pct) },
      rePct:        { avg: Number(z.avg_re_pct) },
      rowCount:     Number(z.row_count),
      unit:         "gCO2eq/kWh",
    });
  });

  // GET /ef/zones/:zoneId/hourly?start=2024-01-01&end=2024-01-07
  app.get("/ef/zones/:zoneId/hourly", { config: { public: true } }, async (request, reply) => {
    const { zoneId } = request.params as { zoneId: string };
    const { start, end } = request.query as { start?: string; end?: string };

    const startTs = start ? new Date(start) : new Date("2024-01-01T00:00:00Z");
    const endTs   = end   ? new Date(end)   : new Date("2024-12-31T23:59:59Z");

    if (isNaN(startTs.getTime()) || isNaN(endTs.getTime())) {
      return reply.status(400).send({ error: "INVALID_DATE", message: "start/end must be ISO8601" });
    }

    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT hour, ci_direct, ci_lifecycle, cfe_pct, re_pct, data_estimated
      FROM emission_factors
      WHERE zone_id = ${zoneId}
        AND granularity = 'hourly'
        AND hour >= ${startTs}
        AND hour <= ${endTs}
      ORDER BY hour
      LIMIT 8784
    `) as EFHourRow[];

    if (!rows.length) {
      const exists = await prisma.$queryRaw(Prisma.sql`
        SELECT EXISTS(SELECT 1 FROM emission_factors WHERE zone_id = ${zoneId}) as exists
      `) as ExistsRow[];
      if (!exists[0]?.exists) return reply.status(404).send({ error: "ZONE_NOT_FOUND" });
    }

    return reply.send({
      zoneId,
      start:  startTs.toISOString(),
      end:    endTs.toISOString(),
      count:  rows.length,
      unit:   "gCO2eq/kWh",
      data:   rows.map((r: EFHourRow) => ({
        hour:          r.hour,
        ciDirect:      r.ci_direct,
        ciLifecycle:   r.ci_lifecycle,
        cfePct:        r.cfe_pct,
        rePct:         r.re_pct,
        dataEstimated: r.data_estimated,
      })),
    });
  });

  // GET /ef/coverage — zone × year data coverage matrix
  app.get("/ef/coverage", { config: { public: true } }, async (_req, reply) => {
    type CovRow = { zone_id: string; zone_name: string; country: string; year: number; row_count: bigint };

    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        zone_id,
        MAX(zone_name)          AS zone_name,
        MAX(country)            AS country,
        EXTRACT(YEAR FROM hour)::int AS year,
        COUNT(*)::bigint        AS row_count
      FROM emission_factors
      WHERE granularity = 'hourly'
      GROUP BY zone_id, EXTRACT(YEAR FROM hour)
      ORDER BY zone_id, year
    `) as CovRow[];

    // Expected hours per year (leap year = 8784, normal = 8760)
    function expectedHours(yr: number) {
      return (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0 ? 8784 : 8760;
    }

    // Group by zone
    const byZone = new Map<string, { zoneName: string; country: string; years: { year: number; rowCount: number; complete: boolean }[] }>();
    for (const r of rows) {
      if (!byZone.has(r.zone_id)) {
        byZone.set(r.zone_id, { zoneName: r.zone_name, country: r.country, years: [] });
      }
      const cnt = Number(r.row_count);
      byZone.get(r.zone_id)!.years.push({
        year:     r.year,
        rowCount: cnt,
        complete: cnt >= expectedHours(r.year) * 0.99, // 99% threshold
      });
    }

    const zones = Array.from(byZone.entries()).map(([zoneId, v]) => ({
      zoneId,
      zoneName: v.zoneName,
      country:  v.country,
      years:    v.years,
    }));

    const allYears = [...new Set(rows.map(r => r.year))].sort();

    return reply.send({ zones, availableYears: allYears });
  });

  // GET /ef/zones/:zoneId/monthly?year=2024 — monthly aggregates
  app.get("/ef/zones/:zoneId/monthly", { config: { public: true } }, async (request, reply) => {
    const { zoneId } = request.params as { zoneId: string };
    const { year } = request.query as { year?: string };
    const y = parseInt(year ?? "2024", 10);

    const rows = await prisma.$queryRaw(Prisma.sql`
      SELECT
        EXTRACT(MONTH FROM hour)::int         AS month,
        ROUND(AVG(ci_direct)::numeric, 2)     AS avg_ci,
        ROUND(AVG(cfe_pct)::numeric, 2)       AS avg_cfe,
        ROUND(AVG(re_pct)::numeric, 2)        AS avg_re,
        COUNT(*)::bigint                      AS data_points
      FROM emission_factors
      WHERE zone_id = ${zoneId}
        AND granularity = 'hourly'
        AND EXTRACT(YEAR FROM hour) = ${y}
      GROUP BY EXTRACT(MONTH FROM hour)
      ORDER BY month
    `) as EFMonthRow[];

    if (!rows.length) return reply.status(404).send({ error: "ZONE_NOT_FOUND" });

    const MONTH_NAMES = ["","Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

    return reply.send({
      zoneId,
      year: y,
      months: rows.map((r: EFMonthRow) => ({
        month:      r.month,
        monthName:  MONTH_NAMES[r.month],
        avgCiDirect: Number(r.avg_ci),
        avgCfePct:   Number(r.avg_cfe),
        avgRePct:    Number(r.avg_re),
        dataPoints:  Number(r.data_points),
      })),
    });
  });
};
