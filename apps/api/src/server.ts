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
  console.error("  DATABASE_URL            → Supabase bağlantı dizesi (pgbouncer port 6543)");
  console.error("  SUPABASE_JWT_SECRET     → Supabase JWT doğrulama anahtarı");
  console.error("  SUPABASE_SERVICE_ROLE_KEY → Supabase admin işlemleri için");
  console.error("  .env dosyanızı kontrol edin veya deployment ortam değişkenlerini ayarlayın.");
  process.exit(1);
}

import supabasePlugin     from "./plugins/supabase.js";
import tenantPlugin       from "./plugins/tenant.js";
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
import cron from "node-cron";

const app = Fastify({
  logger: {
    level:     process.env.LOG_LEVEL ?? "info",
    transport: undefined,
  },
  bodyTimeout:    60_000,
  requestTimeout: 120_000,
  routerOptions: { maxParamLength: 500 },
} as Parameters<typeof Fastify>[0]);

// ── Security plugins ─────────────────────────────────────────────────────────
await app.register(cors, {
  origin: process.env.ALLOWED_ORIGINS?.split(",") ?? ["http://localhost:5173"],
  credentials: true,
});
await app.register(helmet, { contentSecurityPolicy: false });

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

// ── Auth / tenant plugins ─────────────────────────────────────────────────────
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
await app.register(adminRoutes,         { prefix: `${v1}/admin` });
await app.register(carbonPricesRoutes,    { prefix: v1 });
await app.register(emissionTargetsRoutes, { prefix: v1 });
await app.register(periodImportRoutes,    { prefix: v1 });

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

// /api/v1/status — kimlik doğrulamasız durum endpoint (frontend kullanır)
app.get(`${v1}/status`, { config: { rateLimit: { max: 30, timeWindow: "1 minute" } } }, async () => ({
  status:  "ok",
  version: "1.0.0",
  ts:      new Date().toISOString(),
}));

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

} catch (err) {
  app.log.error(err);
  process.exit(1);
}
