// Task #125 — WebSocket /ws/live: gerçek zamanlı CI + fiyat streaming
import type { FastifyPluginAsync } from "fastify";
import type { WebSocket }          from "@fastify/websocket";
import { prisma, Prisma }           from "@voltfox/db";

// ── Payload types ─────────────────────────────────────────────────────────────

interface LiveUpdate {
  type:          "update";
  zone:          string;
  ts:            string;
  ci:            number | null;
  ciTrend1h:     number | null;
  rePct:         number | null;
  price:         number | null;
  priceForecast: number | null;
  priceSource:   string | null;
}

interface ErrorMsg   { type: "error";   code: string; message: string; }
interface PongMsg    { type: "pong";    ts: string; }
interface WelcomeMsg { type: "welcome"; zone: string; ts: string; interval: number; }

type OutMsg = LiveUpdate | ErrorMsg | PongMsg | WelcomeMsg;

function send(ws: WebSocket, msg: OutMsg) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ── Live data query ───────────────────────────────────────────────────────────

async function fetchLiveData(zone: string): Promise<Omit<LiveUpdate, "type" | "ts">> {
  const now    = new Date();
  const ago2h  = new Date(now.getTime() - 2 * 60 * 60 * 1000);

  // Karbon yoğunluğu — emission_factors raw tablo (Prisma şemasında yok)
  const efRows = await prisma.$queryRaw<Array<{
    ci_direct: number; re_pct: number; prev_ci: number | null;
  }>>(Prisma.sql`
    SELECT
      ci_direct,
      re_pct,
      LAG(ci_direct) OVER (ORDER BY hour) AS prev_ci
    FROM emission_factors
    WHERE zone_id = ${zone}
      AND hour   >= ${ago2h}
      AND hour   <= ${now}
    ORDER BY hour DESC
    LIMIT 2
  `);

  const currentCi  = efRows[0]?.ci_direct ?? null;
  const rePct      = efRows[0]?.re_pct    ?? null;
  const prevCi     = efRows[0]?.prev_ci   ?? efRows[1]?.ci_direct ?? null;
  const ciTrend1h  = (currentCi != null && prevCi != null)
    ? Math.round((currentCi - prevCi) * 10) / 10
    : null;

  // DAM fiyatı — en güncel gerçekleşen
  const actualPrice = await prisma.marketPrice.findFirst({
    where:   { zoneId: zone, priceType: "dam_actual", hour: { gte: ago2h } },
    orderBy: { hour: "desc" },
    select:  { priceEurMwh: true, source: true },
  });

  // D+1 tahmin — sonraki saat
  const forecastPrice = await prisma.marketPrice.findFirst({
    where:   { zoneId: zone, priceType: "dam_forecast", hour: { gte: now } },
    orderBy: { hour: "asc" },
    select:  { priceEurMwh: true },
  });

  return {
    zone,
    ci:            currentCi != null ? Math.round(currentCi * 10) / 10 : null,
    ciTrend1h,
    rePct:         rePct     != null ? Math.round(rePct * 10) / 10     : null,
    price:         actualPrice?.priceEurMwh  ?? null,
    priceForecast: forecastPrice?.priceEurMwh ?? null,
    priceSource:   actualPrice?.source ?? null,
  };
}

// ── Route ─────────────────────────────────────────────────────────────────────

const PUSH_INTERVAL_MS = 30_000; // 30 saniye

export const wsLiveRoutes: FastifyPluginAsync = async (app) => {
  app.get(
    "/ws/live",
    { websocket: true, config: { public: true } },
    async (socket, request) => {
      // ── Kimlik doğrulama — token query param (WS upgrade'de header yok) ──
      const query = request.query as Record<string, string>;
      const token = query.token;
      let zone    = (query.zone ?? "DE").toUpperCase();

      if (!token) {
        send(socket, { type: "error", code: "UNAUTHORIZED", message: "token query param gerekli" });
        socket.close(1008, "Unauthorized");
        return;
      }

      if (app.hasDecorator("supabase")) {
        const { data: { user }, error } = await app.supabase.auth.getUser(token);
        if (error || !user) {
          send(socket, { type: "error", code: "UNAUTHORIZED", message: "Geçersiz token" });
          socket.close(1008, "Unauthorized");
          return;
        }
      }

      // ── Karşılama mesajı ─────────────────────────────────────────────────
      send(socket, { type: "welcome", zone, ts: new Date().toISOString(), interval: PUSH_INTERVAL_MS });

      // ── İlk veri itkisi ──────────────────────────────────────────────────
      try {
        const data = await fetchLiveData(zone);
        send(socket, { type: "update", ts: new Date().toISOString(), ...data });
      } catch (err) {
        app.log.warn({ err, zone }, "[WS] İlk veri yüklenemedi");
      }

      // ── Periyodik push ────────────────────────────────────────────────────
      const timer = setInterval(async () => {
        if (socket.readyState !== socket.OPEN) {
          clearInterval(timer);
          return;
        }
        try {
          const data = await fetchLiveData(zone);
          send(socket, { type: "update", ts: new Date().toISOString(), ...data });
        } catch (err) {
          app.log.warn({ err, zone }, "[WS] Periyodik güncelleme hatası");
        }
      }, PUSH_INTERVAL_MS);

      // ── İstemci mesajları ─────────────────────────────────────────────────
      socket.on("message", (raw: Buffer | string) => {
        try {
          const msg = JSON.parse(raw.toString()) as { type: string; zone?: string };

          if (msg.type === "ping") {
            send(socket, { type: "pong", ts: new Date().toISOString() });
            return;
          }

          if (msg.type === "subscribe" && typeof msg.zone === "string") {
            zone = msg.zone.toUpperCase().slice(0, 16);
            send(socket, { type: "welcome", zone, ts: new Date().toISOString(), interval: PUSH_INTERVAL_MS });
            fetchLiveData(zone)
              .then(data => send(socket, { type: "update", ts: new Date().toISOString(), ...data }))
              .catch(() => null);
          }
        } catch {
          // Geçersiz JSON — yoksay
        }
      });

      // ── Temizle ──────────────────────────────────────────────────────────
      socket.on("close", () => {
        clearInterval(timer);
        app.log.debug({ zone }, "[WS] Bağlantı kapandı");
      });

      socket.on("error", (err: Error) => {
        clearInterval(timer);
        app.log.warn({ err, zone }, "[WS] Socket hatası");
      });
    },
  );
};
