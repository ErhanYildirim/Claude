import fp from "fastify-plugin";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { logSecurityEvent } from "../lib/security-logger.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

declare module "fastify" {
  interface FastifyRequest {
    tenantId: string;
    userId:   string | null;
  }
  interface FastifyContextConfig {
    public?: boolean; // route'u auth'dan muaf tut
  }
}

const tenantPlugin: FastifyPluginAsync = async (app) => {
  app.decorateRequest("tenantId", "");
  app.decorateRequest("userId",   null);

  app.addHook("preHandler", async (request, reply) => {
    // Kamuya açık route'lar (share link erişimi vb.)
    // Public route bypass: config.public veya URL pattern
    if (
      request.routeOptions?.config?.public === true ||
      request.url.startsWith("/api/v1/share/") ||
      request.url.startsWith("/api/v1/admin") ||
      request.url === "/health"
    ) return;

    // ── 1. Supabase JWT doğrulama ──────────────────────────────────────────
    const authHeader = request.headers.authorization;
    if (authHeader?.startsWith("Bearer ") && app.hasDecorator("supabase")) {
      const token = authHeader.slice(7);
      const { data: { user }, error } = await app.supabase.auth.getUser(token);

      if (error || !user) {
        logSecurityEvent({
          event:     "AUTH_FAILURE",
          ipAddress: request.ip,
          url:       request.url,
          method:    request.method,
          details:   { reason: error?.message ?? "user_not_found" },
        });
        return reply.status(401).send({ error: "UNAUTHORIZED", message: "Geçersiz oturum." });
      }

      const tenantId: string | undefined =
        user.app_metadata?.["tenant_id"] ?? user.user_metadata?.["tenant_id"];

      if (!tenantId || !UUID_RE.test(tenantId)) {
        logSecurityEvent({
          event:    "TENANT_VIOLATION",
          userId:   user.id,
          ipAddress: request.ip,
          url:      request.url,
          method:   request.method,
          details:  { reason: "no_tenant_assigned" },
        });
        return reply.status(403).send({ error: "NO_TENANT", message: "Kullanıcıya tenant atanmamış." });
      }

      request.tenantId = tenantId;
      request.userId   = user.id;
      return;
    }

    // ── 2. Dev bypass: X-Tenant-ID header ─────────────────────────────────
    if (process.env.NODE_ENV !== "production") {
      const hdr = request.headers["x-tenant-id"] as string | undefined;
      if (hdr && UUID_RE.test(hdr)) {
        // Dev'de tenant yoksa otomatik oluştur
        await prisma.tenant.upsert({
          where:  { id: hdr },
          create: { id: hdr, name: "Dev Tenant", slug: `dev-${hdr.slice(0, 8)}` },
          update: {},
        });
        request.tenantId = hdr;
        request.userId   = null;
        return;
      }
    }

    return reply.status(401).send({ error: "UNAUTHORIZED", message: "Kimlik doğrulama gerekli." });
  });
};

export default fp(tenantPlugin, { name: "tenant", dependencies: [] });
