import Fastify from "fastify";
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

const app = Fastify({
  logger: {
    level:     process.env.LOG_LEVEL ?? "info",
    transport: undefined,
  },
  bodyTimeout:    60_000,
  requestTimeout: 120_000,
  routerOptions: { maxParamLength: 500 },
});

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

// Health check — kamuya açık
app.get("/health", { config: { public: true } }, async () => ({
  status:  "ok",
  version: "1.0.0",
  ts:      new Date().toISOString(),
}));

// ── Start ─────────────────────────────────────────────────────────────────────
const port = parseInt(process.env.PORT ?? "3000");

try {
  await app.listen({ port, host: "0.0.0.0" });
  app.log.info(`Voltfox API port ${port}'de çalışıyor`);
} catch (err) {
  app.log.error(err);
  process.exit(1);
}
