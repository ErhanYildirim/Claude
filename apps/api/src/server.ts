import "dotenv/config";
import Fastify from "fastify";
import { prisma } from "@voltfox/db";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import rateLimit from "@fastify/rate-limit";

// ── Ortam değişkeni doğrulama ─────────────────────────────────────────────────
const REQUIRED_ENV = ["DATABASE_URL", "SUPABASE_JWT_SECRET", "SUPABASE_SERVICE_ROLE_KEY"] as const;
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
  console.error(`[FATAL] Zorunlu ortam değişkenleri eksik: ${missing.join(", ")}`);
  console.error("  DATABASE_URL              → Supabase bağlantı dizesi (pgbouncer port 6543)");
  console.error("  SUPABASE_JWT_SECRET       → Supabase JWT doğrulama anahtarı");
  console.error("  SUPABASE_SERVICE_ROLE_KEY → Supabase admin işlemleri için");
  console.error("  .env dosyanızı kontrol edin veya deployment ortam değişkenlerini ayarlayın.");
  process.exit(1);
}

// ── Güvenlik kontrol listesi ──────────────────────────────────────────────────
const isProd = process.env.NODE_ENV === "production";
const warnings: string[] = [];

if (!isProd) {
  warnings.push("NODE_ENV production değil — güvenlik özellikleri devre dışı olabilir");
}

const jwtSecret = process.env.SUPABASE_JWT_SECRET ?? "";
if (jwtSecret.length < 32) {
  warnings.push(`SUPABASE_JWT_SECRET çok kısa (${jwtSecret.length} karakter, min 32)`);
}

if (!process.env.ALLOWED_ORIGINS && isProd) {
  warnings.push("ALLOWED_ORIGINS ayarlanmamış — CORS tüm origin'lere açık");
}

if (!process.env.ADMIN_IP_ALLOWLIST && isProd) {
  warnings.push("ADMIN_IP_ALLOWLIST ayarlanmamış — admin panel tüm IP'lere açık");
}

if (process.env.DATABASE_URL?.includes("localhost") && isProd) {
  warnings.push("DATABASE_URL localhost içeriyor — production DB bağlantısını kontrol edin");
}

if (warnings.length > 0) {
  const label = isProd ? "[SECURITY WARNING]" : "[Dev Info]";
  for (const w of warnings) console.warn(`${label} ${w}`);
  if (isProd && warnings.some(w => w.includes("kısa"))) {
    console.error("[FATAL] Production güvenlik kriterleri karşılanmadı. Sunucu başlatılmıyor.");
    process.exit(1);
  }
}

import supabasePlugin     from "./plugins/supabase.js";
import tenantPlugin       from "./plugins/tenant.js";
import requestIdPlugin    from "./plugins/request-id.js";
import errorHandlerPlugin from "./plugins/error-handler.js";
import { installationsRoutes } from "./routes/installations.js";
import { periodsRoutes }       from "./routes/periods.js";
import { shareLinksRoutes }    from "./routes/share-links.js";
import { defaultsRoutes }      from "./routes/defaults.js";
import { reportsRoutes }       from "./routes/reports.js";
import { auditRoutes }         from "./routes/audit.js";
import { membersRoutes }       from "./routes/members.js";
import { cfeRoutes }           from "./routes/cfe.js";
import { cfeImportRoutes }     from "./routes/cfe-import.js";
import { apiKeysRoutes }       from "./routes/api-keys.js";
import { webhooksRoutes }      from "./routes/webhooks.js";
import { onboardingRoutes }    from "./routes/onboarding.js";
import { efRoutes, runEfImport } from "./routes/ef.js";
import { gecRoutes }           from "./routes/gec.js";
import { tenantRoutes }        from "./routes/tenant.js";
import { notificationsRoutes } from "./routes/notifications.js";
import { invitesRoutes }       from "./routes/invites.js";
import { searchRoutes }        from "./routes/search.js";
import { adminRoutes }         from "./routes/admin/index.js";
import { carbonPricesRoutes }  from "./routes/carbon-prices.js";
import { emissionTargetsRoutes } from "./routes/emission-targets.js";
import { periodImportRoutes }   from "./routes/period-import.js";
import { benchmarkRoutes }      from "./routes/benchmark.js";
import { cbamProductRoutes }    from "./routes/cbam-products.js";
import cron from "node-cron";

const MB = 1024 * 1024;

const app = Fastify({
  logger: {
    level:     process.env.LOG_LEVEL ?? "info",
    transport: undefined,
    // requestId her log satırında görünsün
    genReqId: (req: { headers: Record<string, string | string[] | undefined> }) => {
      const incoming = req.headers["x-request-id"];
      return (typeof incoming === "string" && incoming.length > 0 && incoming.length <= 64)
        ? incoming
        : crypto.randomUUID();
    },
    serializers: {
      req: (req: { method: string; url: string; id: string; socket?: { remoteAddress?: string } }) => ({
        method:    req.method,
        url:       req.url,
        requestId: req.id,
        ip:        req.socket?.remoteAddress,
      }),
      res: (res: { statusCode: number }) => ({
        statusCode: res.statusCode,
      }),
    },
  },
  bodyTimeout:    60_000,
  requestTimeout: 120_000,
  bodyLimit:      10 * MB,   // JSON/form: 10 MB; CSV upload rotaları override eder
  routerOptions:  { maxParamLength: 500 },
} as Parameters<typeof Fastify>[0]);

// ── Security plugins ─────────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://localhost:5175",
  ],
  credentials: true,
});
await app.register(helmet, {
  contentSecurityPolicy: {
    directives: {
      defaultSrc:  ["'none'"],
      scriptSrc:   ["'none'"],
      styleSrc:    ["'none'"],
      imgSrc:      ["'none'"],
      connectSrc:  ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  hsts: {
    maxAge:            63_072_000, // 2 yıl
    includeSubDomains: true,
    preload:           true,
  },
  referrerPolicy:         { policy: "strict-origin-when-cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "cross-origin" }, // API: farklı origin'lerden erişim var
});

// ── Rate limiting ─────────────────────────────────────────────────────────────
await app.register(rateLimit, {
  global: true,
  max: 100,
  timeWindow: "1 minute",
  keyGenerator: (req) => {
    // API key kullanıcıları Authorization: Bearer vf_... header'ı ile tanınır
    const auth = req.headers.authorization ?? "";
    if (auth.startsWith("Bearer vf_")) return `apikey:${auth.slice(7, 18)}`;
    return req.ip;
  },
  errorResponseBuilder: (_req, context) => ({
    error: "RATE_LIMIT_EXCEEDED",
    message: `Çok fazla istek. ${context.after} sonra tekrar deneyin.`,
    limit: context.max,
    remaining: 0,
  }),
});

// ── Core plugins ─────────────────────────────────────────────────────────────
await app.register(requestIdPlugin);
await app.register(errorHandlerPlugin);
await app.register(supabasePlugin);
await app.register(tenantPlugin);

// ── Routes ────────────────────────────────────────────────────────────────────
const v1 = "/api/v1";

await app.register(installationsRoutes, { prefix: v1 });
await app.register(periodsRoutes,       { prefix: v1 });
await app.register(cfeRoutes,           { prefix: v1 });
await app.register(cfeImportRoutes,     { prefix: v1 });
await app.register(shareLinksRoutes,    { prefix: v1 });
await app.register(defaultsRoutes,      { prefix: v1 });
await app.register(reportsRoutes,       { prefix: v1 });
await app.register(auditRoutes,         { prefix: v1 });
await app.register(membersRoutes,       { prefix: v1 });
await app.register(apiKeysRoutes,       { prefix: v1 });
await app.register(webhooksRoutes,      { prefix: v1 });
await app.register(onboardingRoutes,    { prefix: v1 });
await app.register(efRoutes,            { prefix: v1 });
await app.register(gecRoutes,           { prefix: v1 });
await app.register(tenantRoutes,        { prefix: v1 });
await app.register(notificationsRoutes, { prefix: v1 });
await app.register(invitesRoutes,       { prefix: v1 });
await app.register(searchRoutes,        { prefix: v1 });
await app.register(adminRoutes,         {
  prefix: `${v1}/admin`,
  // @ts-expect-error — config alanı FastifyRegisterOptions'da yok ama Fastify bunu destekler
  config: { rateLimit: { max: 30, timeWindow: "1 minute" } },
});
await app.register(carbonPricesRoutes,    { prefix: v1 });
await app.register(emissionTargetsRoutes, { prefix: v1 });
await app.register(periodImportRoutes,    { prefix: v1 });
await app.register(benchmarkRoutes,       { prefix: v1 });
await app.register(cbamProductRoutes,     { prefix: v1 });

// Health check — kamuya açık, detaylı DB + uygulama durumu
app.get("/health", { config: { public: true } }, async (_req, reply) => {
  let db: "ok" | "error" = "ok";
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch {
    db = "error";
  }
  const status = db === "ok" ? "ok" : "degraded";
  return reply.status(db === "error" ? 503 : 200).send({
    status,
    version:    "1.0.0",
    db,
    ts:         new Date().toISOString(),
    uptime:     Math.floor(process.uptime()),
  });
});

// Admin rotaları için sıkı rate limit — route-config override
// Admin prefix'indeki tüm rotalar { config: { rateLimit: { max: 30 } } } alır

// /api/v1/status — kimlik doğrulamasız durum endpoint (frontend kullanır)
app.get(`${v1}/status`, { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async () => ({
  status:  "ok",
  version: "1.0.0",
  ts:      new Date().toISOString(),
}));

// ── Process error handlers ────────────────────────────────────────────────────
process.on("unhandledRejection", (reason) => {
  app.log.error({ reason }, "[FATAL] unhandledRejection — süreç sonlandırılıyor");
  process.exit(1);
});

process.on("uncaughtException", (err) => {
  app.log.error({ err }, "[FATAL] uncaughtException — süreç sonlandırılıyor");
  process.exit(1);
});

// ── Graceful shutdown ────────────────────────────────────────────────────────
async function shutdown(signal: string) {
  app.log.info(`[Shutdown] ${signal} alındı — sunucu kapatılıyor…`);
  try {
    await app.close();           // in-flight request'leri draining ile kapat
    await prisma.$disconnect();  // DB bağlantısını temizle
    app.log.info("[Shutdown] Temiz kapatma tamamlandı.");
    process.exit(0);
  } catch (err) {
    app.log.error({ err }, "[Shutdown] Kapatma sırasında hata");
    process.exit(1);
  }
}

process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGINT",  () => shutdown("SIGINT"));

// ── Start ─────────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? "3000");

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Voltfox API port ${port}'de çalışıyor`);

  // EF otomatik güncelleme — her gün 02:00 UTC
  cron.schedule("0 2 * * *", async () => {
    app.log.info("[EF Cron] Günlük EF import başlıyor…");
    await runEfImport().catch(err => app.log.error({ err }, "[EF Cron] Import hatası"));
    app.log.info("[EF Cron] Tamamlandı.");
  }, { timezone: "UTC" });

  // API key expiry uyarısı — her gün 08:00 UTC
  cron.schedule("0 8 * * *", async () => {
    const warnWindow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const expiringKeys = await prisma.apiKey.findMany({
      where: {
        revokedAt: null,
        expiresAt: { lte: warnWindow, gte: new Date() },
      },
      include: { tenant: { select: { id: true, name: true } } },
    });
    if (expiringKeys.length === 0) return;
    app.log.warn({ count: expiringKeys.length }, "[KeyExpiry] Yakında dolacak API anahtarları var");
    // Bildirim oluştur (tenant başına grupla)
    const grouped = new Map<string, typeof expiringKeys>();
    for (const k of expiringKeys) {
      const arr = grouped.get(k.tenantId) ?? [];
      arr.push(k);
      grouped.set(k.tenantId, arr);
    }
    for (const [tenantId, keys] of grouped) {
      // Tenant'ın admin/owner üyelerini bul
      const admins = await prisma.tenantMember.findMany({
        where: { tenantId, role: { in: ["admin", "owner"] } },
        select: { userId: true },
      });
      if (admins.length === 0) continue;

      const notifications = keys.flatMap(k =>
        admins.map((m: { userId: string }) => ({
          tenantId,
          userId:     m.userId,
          type:       "API_KEY_EXPIRING",
          title:      "API Anahtarı Süresi Doluyor",
          body:       `"${k.name}" anahtarının süresi ${k.expiresAt!.toLocaleDateString("tr-TR")}'de doluyor. Lütfen yenileyin.`,
          resource:   "ApiKey",
          resourceId: k.id,
        })),
      );

      await prisma.notification.createMany({
        data: notifications,
        skipDuplicates: true,
      });
    }
  }, { timezone: "UTC" });

} catch (err) {
  app.log.error(err);
  process.exit(1);
}
