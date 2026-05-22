import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const auditRoutes: FastifyPluginAsync = async (app) => {

  // GET /audit-logs?resource=&resourceId=&action=&limit=&cursor=&from=&to=
  app.get("/audit-logs", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          resource:   { type: "string" },
          resourceId: { type: "string" },
          action:     { type: "string" },
          limit:      { type: "integer", minimum: 1, maximum: 200, default: 50 },
          cursor:     { type: "string" },
          from:       { type: "string" }, // ISO date — başlangıç filtresi
          to:         { type: "string" }, // ISO date — bitiş filtresi
        },
      },
    },
  }, async (request, reply) => {
    const q = request.query as {
      resource?:   string;
      resourceId?: string;
      action?:     string;
      limit?:      number;
      cursor?:     string;
      from?:       string;
      to?:         string;
    };

    const limit = q.limit ?? 50;
    const fromDate = q.from ? new Date(q.from) : undefined;
    const toDate   = q.to   ? new Date(q.to + "T23:59:59Z") : undefined;

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId:   request.tenantId,
        ...(q.resource   ? { resource:   q.resource }   : {}),
        ...(q.resourceId ? { resourceId: q.resourceId } : {}),
        ...(q.action     ? { action:     q.action }     : {}),
        ...(q.cursor || fromDate || toDate ? {
          createdAt: {
            ...(q.cursor ? { lt:  new Date(q.cursor) } : {}),
            ...(fromDate ? { gte: fromDate }           : {}),
            ...(toDate   ? { lte: toDate }             : {}),
          },
        } : {}),
      },
      orderBy: { createdAt: "desc" },
      take:    limit + 1,
      select: {
        id: true, action: true, resource: true, resourceId: true,
        userId: true, payload: true, ipAddress: true, createdAt: true,
      },
    });

    const hasMore = logs.length > limit;
    if (hasMore) logs.pop();

    const nextCursor = hasMore ? logs[logs.length - 1]?.createdAt.toISOString() : null;

    return reply.send({ logs, nextCursor, count: logs.length });
  });
};
