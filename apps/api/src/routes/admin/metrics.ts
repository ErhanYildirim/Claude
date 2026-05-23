import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const adminMetricsRoutes: FastifyPluginAsync = async (app) => {

  // GET /admin/metrics — platform geneli KPI özeti
  app.get("/metrics", async (_request, reply) => {
    const now   = new Date();
    const day30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    const [
      tenantCount,
      installationCount,
      periodCount,
      cfeCount,
      auditCount30d,
      newTenants30d,
    ] = await Promise.all([
      prisma.tenant.count(),
      prisma.installation.count(),
      prisma.reportingPeriod.count(),
      prisma.cFEMatchingResult.count(),
      prisma.auditLog.count({ where: { createdAt: { gte: day30 } } }),
      prisma.tenant.count({ where: { createdAt: { gte: day30 } } }),
    ]);

    // Son 30 günlük günlük audit log sayısı (grafik için)
    const dailyActivity = await prisma.$queryRaw<{ day: string; count: bigint }[]>`
      SELECT DATE_TRUNC('day', "created_at") AS day, COUNT(*) AS count
      FROM audit_logs
      WHERE "created_at" >= ${day30}
      GROUP BY day
      ORDER BY day ASC
    `;

    return reply.send({
      tenantCount,
      installationCount,
      periodCount,
      cfeCount,
      auditCount30d,
      newTenants30d,
      dailyActivity: dailyActivity.map(r => ({
        day:   r.day,
        count: Number(r.count),
      })),
      asOf: now.toISOString(),
    });
  });
};
