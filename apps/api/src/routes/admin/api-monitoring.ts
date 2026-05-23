import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { getCurrentUsage } from "../../lib/api-request-logger.js";

export const adminApiMonitoringRoutes: FastifyPluginAsync = async (app) => {

  // GET /api-keys — tüm tenant'lardaki tüm API anahtarları
  app.get("/api-keys", async (request, reply) => {
    const { search, tenantId, limit = "100", offset = "0" } = request.query as {
      search?: string; tenantId?: string; limit?: string; offset?: string;
    };

    const where: Record<string, unknown> = {};
    if (tenantId) where.tenantId = tenantId;
    if (search) {
      where.OR = [
        { name:   { contains: search, mode: "insensitive" } },
        { prefix: { contains: search, mode: "insensitive" } },
      ];
    }

    const [keys, total] = await Promise.all([
      prisma.apiKey.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take:    Math.min(parseInt(limit), 200),
        skip:    parseInt(offset),
        select: {
          id: true, name: true, prefix: true, scopes: true,
          expiresAt: true, lastUsedAt: true, revokedAt: true,
          createdAt: true, rateLimitPerMin: true, createdBy: true,
          tenant: { select: { id: true, name: true, slug: true, plan: true } },
        },
      }),
      prisma.apiKey.count({ where }),
    ]);

    // Request counts last 24h per key (batch)
    const keyIds = keys.map(k => k.id);
    const since  = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const counts = await prisma.apiRequestLog.groupBy({
      by:    ["apiKeyId"],
      where: { apiKeyId: { in: keyIds }, createdAt: { gte: since } },
      _count: { id: true },
    });
    const countMap = Object.fromEntries(counts.map(c => [c.apiKeyId, c._count.id]));

    const errorCounts = await prisma.apiRequestLog.groupBy({
      by:    ["apiKeyId"],
      where: { apiKeyId: { in: keyIds }, createdAt: { gte: since }, statusCode: { gte: 400 } },
      _count: { id: true },
    });
    const errorMap = Object.fromEntries(errorCounts.map(c => [c.apiKeyId, c._count.id]));

    return reply.send({
      keys: keys.map(k => ({
        ...k,
        requests24h: countMap[k.id] ?? 0,
        errors24h:   errorMap[k.id] ?? 0,
        currentUsage: getCurrentUsage(k.id),
        effectiveLimit: k.rateLimitPerMin ?? 100,
      })),
      total,
    });
  });

  // GET /api-keys/:id — tek key detayı + son saatlik stat
  app.get("/api-keys/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const key = await prisma.apiKey.findUnique({
      where:  { id },
      select: {
        id: true, name: true, prefix: true, scopes: true,
        expiresAt: true, lastUsedAt: true, revokedAt: true,
        createdAt: true, rateLimitPerMin: true, createdBy: true,
        tenant: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!key) return reply.status(404).send({ error: "NOT_FOUND" });

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const since7d  = new Date(Date.now() - 7  * 24 * 60 * 60 * 1000);

    const [total24h, errors24h, topEndpoints, hourlyActivity] = await Promise.all([
      prisma.apiRequestLog.count({ where: { apiKeyId: id, createdAt: { gte: since24h } } }),
      prisma.apiRequestLog.count({ where: { apiKeyId: id, createdAt: { gte: since24h }, statusCode: { gte: 400 } } }),
      prisma.apiRequestLog.groupBy({
        by:     ["endpoint", "method"],
        where:  { apiKeyId: id, createdAt: { gte: since7d } },
        _count: { id: true },
        orderBy:{ _count: { id: "desc" } },
        take:   10,
      }),
      prisma.$queryRaw<{ hour: Date; count: bigint; errors: bigint }[]>`
        SELECT
          DATE_TRUNC('hour', created_at) AS hour,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE status_code >= 400) AS errors
        FROM api_request_logs
        WHERE api_key_id = ${id}::uuid
          AND created_at >= ${since24h}
        GROUP BY hour
        ORDER BY hour ASC
      `,
    ]);

    return reply.send({
      key: {
        ...key,
        currentUsage:   getCurrentUsage(id),
        effectiveLimit: key.rateLimitPerMin ?? 100,
      },
      stats: {
        total24h,
        errors24h,
        errorRate24h: total24h > 0 ? ((errors24h / total24h) * 100).toFixed(1) : "0",
        topEndpoints: topEndpoints.map(e => ({ endpoint: e.endpoint, method: e.method, count: e._count.id })),
        hourlyActivity: hourlyActivity.map(r => ({
          hour:   r.hour.toISOString(),
          count:  Number(r.count),
          errors: Number(r.errors),
        })),
      },
    });
  });

  // GET /requests — global istek logu (filtreli, sayfalı)
  app.get("/requests", async (request, reply) => {
    const {
      apiKeyId, tenantId, endpoint, method,
      status, from, to,
      limit = "50", offset = "0",
    } = request.query as {
      apiKeyId?: string; tenantId?: string; endpoint?: string; method?: string;
      status?: string; from?: string; to?: string;
      limit?: string; offset?: string;
    };

    const where: Record<string, unknown> = {};
    if (apiKeyId) where.apiKeyId = apiKeyId;
    if (tenantId) where.tenantId = tenantId;
    if (method)   where.method   = method.toUpperCase();
    if (endpoint) where.endpoint = { contains: endpoint, mode: "insensitive" };
    if (status === "error")   where.statusCode = { gte: 400 };
    if (status === "success") where.statusCode = { lt: 400 };
    if (from || to) {
      where.createdAt = {
        ...(from ? { gte: new Date(from) } : {}),
        ...(to   ? { lte: new Date(to)   } : {}),
      };
    }

    const take = Math.min(parseInt(limit), 200);
    const skip = parseInt(offset);

    const [logs, total] = await Promise.all([
      prisma.apiRequestLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take,
        skip,
        include: {
          apiKey: { select: { name: true, prefix: true, tenant: { select: { name: true } } } },
        },
      }),
      prisma.apiRequestLog.count({ where }),
    ]);

    return reply.send({ logs, total });
  });

  // GET /stats — özet metrikler
  app.get("/stats", async (_request, reply) => {
    const since1h  = new Date(Date.now() - 60 * 60 * 1000);
    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [
      totalRequests24h,
      errorRequests24h,
      activeKeys,
      totalKeys,
      hourlyBreakdown,
      topTenants,
    ] = await Promise.all([
      prisma.apiRequestLog.count({ where: { createdAt: { gte: since24h } } }),
      prisma.apiRequestLog.count({ where: { createdAt: { gte: since24h }, statusCode: { gte: 400 } } }),
      prisma.apiKey.count({ where: { revokedAt: null, OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }] } }),
      prisma.apiKey.count(),
      prisma.$queryRaw<{ hour: Date; count: bigint; errors: bigint }[]>`
        SELECT
          DATE_TRUNC('hour', created_at) AS hour,
          COUNT(*) AS count,
          COUNT(*) FILTER (WHERE status_code >= 400) AS errors
        FROM api_request_logs
        WHERE created_at >= ${since24h}
        GROUP BY hour
        ORDER BY hour ASC
      `,
      prisma.apiRequestLog.groupBy({
        by:     ["tenantId"],
        where:  { createdAt: { gte: since24h } },
        _count: { id: true },
        orderBy:{ _count: { id: "desc" } },
        take:   10,
      }),
    ]);

    // Tenant names lookup
    const tenantIds = topTenants.map(t => t.tenantId);
    const tenants   = await prisma.tenant.findMany({
      where:  { id: { in: tenantIds } },
      select: { id: true, name: true },
    });
    const tenantNameMap = Object.fromEntries(tenants.map(t => [t.id, t.name]));

    return reply.send({
      requests: {
        total24h:   totalRequests24h,
        errors24h:  errorRequests24h,
        errorRate:  totalRequests24h > 0 ? ((errorRequests24h / totalRequests24h) * 100).toFixed(1) : "0",
        perMinute1h: since1h
          ? Math.round(
              (await prisma.apiRequestLog.count({ where: { createdAt: { gte: since1h } } })) / 60
            )
          : 0,
      },
      keys: { active: activeKeys, total: totalKeys },
      hourlyBreakdown: hourlyBreakdown.map(r => ({
        hour:   r.hour.toISOString(),
        count:  Number(r.count),
        errors: Number(r.errors),
      })),
      topTenants: topTenants.map(t => ({
        tenantId:   t.tenantId,
        tenantName: tenantNameMap[t.tenantId] ?? "—",
        requests:   t._count.id,
      })),
    });
  });

  // PATCH /api-keys/:id/rate-limit — per-key limit güncelle
  app.patch("/api-keys/:id/rate-limit", {
    schema: {
      body: {
        type: "object",
        properties: {
          rateLimitPerMin: { type: ["integer", "null"], minimum: 1, maximum: 10000 },
        },
      },
    },
  }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const { rateLimitPerMin } = request.body as { rateLimitPerMin: number | null };

    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) return reply.status(404).send({ error: "NOT_FOUND" });

    const updated = await prisma.apiKey.update({
      where: { id },
      data:  { rateLimitPerMin: rateLimitPerMin ?? null },
      select: { id: true, name: true, prefix: true, rateLimitPerMin: true },
    });

    return reply.send({ key: updated, effectiveLimit: updated.rateLimitPerMin ?? 100 });
  });

  // DELETE /api-keys/:id — admin override ile key revoke
  app.delete("/api-keys/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const key = await prisma.apiKey.findUnique({ where: { id } });
    if (!key) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.apiKey.update({
      where: { id },
      data:  { revokedAt: new Date() },
    });

    app.log.info({ keyId: id, tenantId: key.tenantId }, "[Admin] API key revoked by super-admin");
    return reply.status(204).send();
  });
};
