// Task #124 — GET /ef/live + /ef/forecast + /ef/optimal-window
import type { FastifyPluginAsync } from "fastify";
import { prisma, Prisma } from "@voltfox/db";

export const efLiveRoutes: FastifyPluginAsync = async (app) => {

  // GET /ef/live — son 2 saatin gerçekleşen CI + trend
  app.get<{ Querystring: { zone?: string } }>(
    "/ef/live",
    async (request, reply) => {
      const zone = request.query.zone ?? "DE";
      const now  = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
      const oneDayAgo   = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      // Son 24 saat EF
      const rows = await prisma.$queryRaw<Array<{
        hour: Date; ci_direct: number; re_pct: number; cfe_pct: number;
      }>>(Prisma.sql`
        SELECT hour, ci_direct, re_pct, cfe_pct
        FROM emission_factors
        WHERE zone_id = ${zone}
          AND hour   >= ${oneDayAgo}
          AND hour   <= ${now}
        ORDER BY hour DESC
        LIMIT 25
      `);

      if (rows.length === 0) {
        return reply.send({
          zone,
          currentCi:   null,
          updatedAt:   null,
          trend1h:     null,
          trend24h:    null,
          last24h:     [],
        });
      }

      const latest = rows[0];
      const oneHourAgo = rows.find(r => r.hour.getTime() <= (latest.hour.getTime() - 60 * 60 * 1000));
      const dayBefore  = rows[rows.length - 1];

      const trend1h  = oneHourAgo  ? Math.round((latest.ci_direct - oneHourAgo.ci_direct) * 10) / 10  : null;
      const trend24h = dayBefore   ? Math.round((latest.ci_direct - dayBefore.ci_direct) * 10) / 10   : null;

      return reply.send({
        zone,
        currentCi:  Math.round(latest.ci_direct * 10) / 10,
        currentRePct: latest.re_pct,
        currentCfePct: latest.cfe_pct,
        updatedAt:  latest.hour.toISOString(),
        trend1h,
        trend24h,
        last24h: rows.slice(0, 24).reverse().map(r => ({
          hour:   r.hour.toISOString(),
          ci:     Math.round(r.ci_direct * 10) / 10,
          rePct:  r.re_pct,
          cfePct: r.cfe_pct,
        })),
      });
    }
  );

  // GET /ef/forecast — CI tahmin serisi (ci_forecasts tablosu)
  app.get<{
    Querystring: { zone?: string; hours?: string; method?: string };
  }>(
    "/ef/forecast",
    async (request, reply) => {
      const zone   = request.query.zone   ?? "DE";
      const hours  = Math.min(parseInt(request.query.hours ?? "48", 10), 168);  // max 7 gün
      const method = request.query.method ?? "generation-mix";

      const now = new Date();
      const endTime = new Date(now.getTime() + hours * 60 * 60 * 1000);

      // En son yapılan tahmini al (forecast_made_at DESC ile)
      const forecasts = await prisma.$queryRaw<Array<{
        hour: Date; ci_gco2_kwh: number; horizon_h: number;
        confidence_low: number | null; confidence_high: number | null;
        forecast_made_at: Date;
      }>>(Prisma.sql`
        SELECT DISTINCT ON (hour)
          hour, ci_gco2_kwh, horizon_h, forecast_made_at,
          NULL::float8 AS confidence_low, NULL::float8 AS confidence_high
        FROM ci_forecasts
        WHERE zone_id  = ${zone}
          AND hour    >= ${now}
          AND hour    <= ${endTime}
          AND method  = ${method}
        ORDER BY hour ASC, forecast_made_at DESC
      `);

      return reply.send({
        zone,
        method,
        hours,
        forecasts: forecasts.map(f => ({
          hour:           f.hour.toISOString(),
          ciGco2Kwh:      Math.round(f.ci_gco2_kwh * 10) / 10,
          horizonH:       f.horizon_h,
          forecastMadeAt: f.forecast_made_at.toISOString(),
        })),
        meta: {
          count:     forecasts.length,
          updatedAt: now.toISOString(),
        },
      });
    }
  );

  // GET /ef/optimal-window — en düşük CI saatlerini bul (shift scheduling)
  app.get<{
    Querystring: { zone?: string; duration_h?: string; look_ahead_h?: string };
  }>(
    "/ef/optimal-window",
    async (request, reply) => {
      const zone        = request.query.zone        ?? "DE";
      const durationH   = Math.min(parseInt(request.query.duration_h   ?? "4",  10), 24);
      const lookAheadH  = Math.min(parseInt(request.query.look_ahead_h ?? "48", 10), 168);

      const now     = new Date();
      const endTime = new Date(now.getTime() + lookAheadH * 60 * 60 * 1000);

      // Hem gerçekleşen EF hem forecast CI'yi birleştir
      const actuals = await prisma.$queryRaw<Array<{ hour: Date; ci: number }>>(Prisma.sql`
        SELECT hour, ci_direct AS ci
        FROM emission_factors
        WHERE zone_id = ${zone}
          AND hour   >= ${now}
          AND hour   <= ${endTime}
        ORDER BY hour ASC
      `);

      const forecasts = await prisma.$queryRaw<Array<{ hour: Date; ci: number }>>(Prisma.sql`
        SELECT DISTINCT ON (hour) hour, ci_gco2_kwh AS ci
        FROM ci_forecasts
        WHERE zone_id = ${zone}
          AND hour   >= ${now}
          AND hour   <= ${endTime}
        ORDER BY hour ASC, forecast_made_at DESC
      `);

      // Birleştir (actual önce, forecast gap doldurur)
      const ciMap = new Map<number, number>();
      for (const r of [...forecasts, ...actuals]) {
        ciMap.set(r.hour.getTime(), r.ci);
      }

      const sortedHours = [...ciMap.entries()]
        .sort(([a], [b]) => a - b)
        .map(([ts, ci]) => ({ hour: new Date(ts), ci }));

      if (sortedHours.length < durationH) {
        return reply.send({
          zone,
          durationH,
          windows:   [],
          message:   "Yeterli tahmin verisi yok",
        });
      }

      // Kayan pencere: durationH uzunluğundaki en düşük ortalama CI bloğu
      const windows: Array<{ startHour: string; endHour: string; avgCi: number; minCi: number }> = [];

      for (let i = 0; i <= sortedHours.length - durationH; i++) {
        const window = sortedHours.slice(i, i + durationH);
        const avgCi  = window.reduce((s, r) => s + r.ci, 0) / durationH;
        const minCi  = Math.min(...window.map(r => r.ci));
        windows.push({
          startHour: window[0].hour.toISOString(),
          endHour:   window[window.length - 1].hour.toISOString(),
          avgCi:     Math.round(avgCi * 10) / 10,
          minCi:     Math.round(minCi * 10) / 10,
        });
      }

      // En iyi 5 pencereyi döndür (avgCi'ya göre sırala)
      const topWindows = windows
        .sort((a, b) => a.avgCi - b.avgCi)
        .slice(0, 5);

      return reply.send({
        zone,
        durationH,
        lookAheadH,
        windows:   topWindows,
        updatedAt: now.toISOString(),
      });
    }
  );

  // GET /ef/history — tarihi EF serisi (emission_factors tablosu)
  app.get<{
    Querystring: { zone?: string; from?: string; to?: string };
  }>(
    "/ef/history",
    async (request, reply) => {
      const zone = request.query.zone ?? "DE";
      const from = request.query.from ? new Date(request.query.from) : (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
      const to   = request.query.to   ? new Date(request.query.to)   : new Date();

      const rows = await prisma.$queryRaw<Array<{
        hour: Date; ci_direct: number; cfe_pct: number; re_pct: number;
      }>>(Prisma.sql`
        SELECT hour, ci_direct, cfe_pct, re_pct
        FROM emission_factors
        WHERE zone_id = ${zone}
          AND hour   >= ${from}
          AND hour   <= ${to}
        ORDER BY hour ASC
        LIMIT 8760
      `);

      return reply.send({
        zone,
        history: rows.map(r => ({
          hour:   r.hour.toISOString(),
          ci:     Math.round(r.ci_direct * 10) / 10,
          cfePct: r.cfe_pct,
          rePct:  r.re_pct,
        })),
        meta: { from: from.toISOString(), to: to.toISOString(), count: rows.length },
      });
    }
  );
};
