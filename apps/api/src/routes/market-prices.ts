// Task #122 — GET /market-prices endpoint'leri
import type { FastifyPluginAsync } from "fastify";
import { prisma, Prisma } from "@voltfox/db";
import { ENTSO_ZONES } from "../services/entso-e-utils.js";

const VALID_PRICE_TYPES = new Set(["dam_actual", "dam_forecast", "intraday"]);
const VALID_SOURCES     = new Set(["entso-e", "epias", "model"]);
const MAX_RANGE_DAYS    = 365;

export const marketPricesRoutes: FastifyPluginAsync = async (app) => {

  // GET /market-prices — fiyat serisi (tarihi + canlı + D+1 forecast)
  app.get<{
    Querystring: {
      zone?: string;
      from?: string;
      to?: string;
      type?: string;
      source?: string;
      limit?: string;
    };
  }>(
    "/market-prices",
    {
      schema: {
        querystring: {
          type: "object",
          properties: {
            zone:   { type: "string" },
            from:   { type: "string" },
            to:     { type: "string" },
            type:   { type: "string" },
            source: { type: "string" },
            limit:  { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const { zone, from, to, type, source, limit } = request.query;

      const fromDate = from ? new Date(from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
      const toDate   = to   ? new Date(to)   : (() => { const d = new Date(); d.setDate(d.getDate() + 2); return d; })();

      if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
        return reply.status(400).send({ error: "Geçersiz tarih formatı (ISO 8601 bekleniyor)" });
      }

      const rangeDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
      if (rangeDays > MAX_RANGE_DAYS) {
        return reply.status(400).send({ error: `Maksimum sorgu aralığı ${MAX_RANGE_DAYS} gündür` });
      }

      if (type && !VALID_PRICE_TYPES.has(type)) {
        return reply.status(400).send({ error: `Geçersiz price_type. Geçerliler: ${[...VALID_PRICE_TYPES].join(", ")}` });
      }
      if (source && !VALID_SOURCES.has(source)) {
        return reply.status(400).send({ error: `Geçersiz source. Geçerliler: ${[...VALID_SOURCES].join(", ")}` });
      }

      const pageLimit = Math.min(parseInt(limit ?? "2000", 10), 5000);

      const prices = await prisma.$queryRaw<Array<{
        zone_id: string; hour: Date; price_eur_mwh: number | null;
        price_try_mwh: number | null; currency: string; price_type: string;
        source: string; forecast_made_at: Date | null;
        confidence_low: number | null; confidence_high: number | null;
      }>>(Prisma.sql`
        SELECT zone_id, hour, price_eur_mwh, price_try_mwh, currency,
               price_type, source, forecast_made_at, confidence_low, confidence_high
        FROM market_prices
        WHERE hour >= ${fromDate}
          AND hour <= ${toDate}
          ${zone   ? Prisma.sql`AND zone_id    = ${zone}`   : Prisma.empty}
          ${type   ? Prisma.sql`AND price_type = ${type}`   : Prisma.empty}
          ${source ? Prisma.sql`AND source     = ${source}` : Prisma.empty}
        ORDER BY zone_id ASC, hour ASC
        LIMIT ${pageLimit}
      `);

      return reply.send({
        prices: prices.map(p => ({
          zone:           p.zone_id,
          hour:           p.hour.toISOString(),
          priceEurMwh:    p.price_eur_mwh,
          priceTryMwh:    p.price_try_mwh,
          currency:       p.currency,
          priceType:      p.price_type,
          source:         p.source,
          forecastMadeAt: p.forecast_made_at?.toISOString() ?? null,
          confidenceLow:  p.confidence_low,
          confidenceHigh: p.confidence_high,
        })),
        meta: {
          zone:     zone ?? "all",
          from:     fromDate.toISOString(),
          to:       toDate.toISOString(),
          count:    prices.length,
          limit:    pageLimit,
        },
      });
    }
  );

  // GET /market-prices/zones — aktif zone listesi
  app.get("/market-prices/zones", async (_request, reply) => {
    const activeCodes = await prisma.$queryRaw<Array<{ zone_id: string }>>(Prisma.sql`
      SELECT DISTINCT zone_id FROM market_prices ORDER BY zone_id
    `);
    const activeSet = new Set(activeCodes.map(r => r.zone_id));

    const zones = ENTSO_ZONES.map(z => ({
      code:    z.code,
      name:    z.name,
      country: z.country,
      hasData: activeSet.has(z.code),
    }));

    return reply.send({ zones });
  });

  // GET /market-prices/latest — son 24h + D+1 özet
  app.get<{ Querystring: { zone?: string } }>(
    "/market-prices/latest",
    async (request, reply) => {
      const zone = request.query.zone ?? "DE";

      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const tomorrow  = new Date(now.getTime() + 48 * 60 * 60 * 1000);

      const rows = await prisma.$queryRaw<Array<{
        hour: Date; price_eur_mwh: number | null; price_type: string; source: string;
      }>>(Prisma.sql`
        SELECT hour, price_eur_mwh, price_type, source
        FROM market_prices
        WHERE zone_id = ${zone}
          AND hour   >= ${yesterday}
          AND hour   <= ${tomorrow}
        ORDER BY hour ASC
      `);

      const actual   = rows.filter(r => r.price_type === "dam_actual");
      const forecast = rows.filter(r => r.price_type === "dam_forecast");

      const avgActual   = avg(actual.map(r => r.price_eur_mwh));
      const avgForecast = avg(forecast.map(r => r.price_eur_mwh));

      return reply.send({
        zone,
        current: {
          actual:   rows.find(r => r.price_type === "dam_actual"   && r.hour <= now)?.price_eur_mwh ?? null,
          forecast: rows.find(r => r.price_type === "dam_forecast" && r.hour >= now)?.price_eur_mwh ?? null,
        },
        summary: {
          avgActual24h:   avgActual,
          avgForecast24h: avgForecast,
          minActual:      actual.length   ? Math.min(...actual.map(r => r.price_eur_mwh ?? Infinity))   : null,
          maxActual:      actual.length   ? Math.max(...actual.map(r => r.price_eur_mwh ?? -Infinity))  : null,
        },
        series: rows.map(r => ({
          hour:        r.hour.toISOString(),
          priceEurMwh: r.price_eur_mwh,
          priceType:   r.price_type,
          source:      r.source,
        })),
        updatedAt: now.toISOString(),
      });
    }
  );
};

function avg(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (!nums.length) return null;
  return Math.round((nums.reduce((s, v) => s + v, 0) / nums.length) * 100) / 100;
}
