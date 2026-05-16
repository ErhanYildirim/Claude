import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const auditRoutes: FastifyPluginAsync = async (app) => {

  // GET /audit-logs?resource=&resourceId=&action=&limit=&cursor=
  app.get("/audit-logs", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          resource:   { type: "string" },
          resourceId: { type: "string" },
          action:     { type: "string" },
          limit:      { type: "integer", minimum: 1, maximum: 200, default: 50 },
          cursor:     { type: "string" }, // ISO timestamp — sayfala
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
    };

    const limit = q.limit ?? 50;

    const logs = await prisma.auditLog.findMany({
      where: {
        tenantId:   request.tenantId,
        ...(q.resource   ? { resource:   q.resource }   : {}),
        ...(q.resourceId ? { resourceId: q.resourceId } : {}),
        ...(q.action     ? { action:     q.action }     : {}),
        ...(q.cursor     ? { createdAt:  { lt: new Date(q.cursor) } } : {}),
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
