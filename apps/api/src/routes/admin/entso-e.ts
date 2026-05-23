import type { FastifyPluginAsync } from "fastify";
import { ENTSO_ZONES, importEntsoeZone } from "../../services/entso-e.js";
import { prisma } from "@voltfox/db";

export const adminEntsoeRoutes: FastifyPluginAsync = async (app) => {

  // GET /entso-e/zones — desteklenen ENTSO-E zone listesi
  app.get("/entso-e/zones", async (_request, reply) => {
    return reply.send({
      zones: ENTSO_ZONES.map(z => ({
        code:    z.code,
        eicCode: z.eicCode,
        name:    z.name,
        country: z.country,
      })),
      count: ENTSO_ZONES.length,
    });
  });

  // POST /entso-e/import — ENTSO-E zone import tetikle
  // Body: { token: string; zoneCode: string; startDate: string; endDate: string }
  app.post("/entso-e/import", async (request, reply) => {
    const { token, zoneCode, startDate, endDate } = request.body as {
      token?: string; zoneCode?: string; startDate?: string; endDate?: string;
    };

    if (!token)     return reply.status(400).send({ error: "MISSING_TOKEN",     message: "ENTSO-E API token gerekli." });
    if (!zoneCode)  return reply.status(400).send({ error: "MISSING_ZONE",      message: "zoneCode gerekli." });
    if (!startDate) return reply.status(400).send({ error: "MISSING_START",     message: "startDate gerekli (ISO8601)." });
    if (!endDate)   return reply.status(400).send({ error: "MISSING_END",       message: "endDate gerekli (ISO8601)." });

    const start = new Date(startDate);
    const end   = new Date(endDate);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return reply.status(400).send({ error: "INVALID_DATE", message: "startDate/endDate geçersiz ISO8601 formatı." });
    }
    if (end <= start) {
      return reply.status(400).send({ error: "DATE_ORDER", message: "endDate, startDate'den sonra olmalı." });
    }
    // Limit to 31 days per request to prevent abuse
    const diffDays = (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
    if (diffDays > 31) {
      return reply.status(400).send({ error: "RANGE_TOO_LARGE", message: "Maksimum 31 günlük veri çekilebilir." });
    }

    // Fire and return — import runs in background for large date ranges
    reply.send({ message: "ENTSO-E import başlatıldı.", zoneCode, startDate, endDate });

    importEntsoeZone(token, zoneCode, start, end).catch(err => {
      app.log.error({ err, zoneCode }, "[ENTSO-E Import] Hata");
    });
  });

  // GET /entso-e/import-logs — son 20 ENTSO-E import logu
  app.get("/entso-e/import-logs", async (_request, reply) => {
    const logs = await prisma.efImportLog.findMany({
      where:   { zoneId: { not: null } },
      orderBy: { createdAt: "desc" },
      take:    20,
    });
    return reply.send({
      logs: logs.map(l => ({
        id:        l.id,
        year:      l.year,
        zoneId:    l.zoneId,
        rowsAdded: l.rowsAdded,
        status:    l.status,
        message:   l.message,
        startedAt: l.startedAt.toISOString(),
        endedAt:   l.endedAt.toISOString(),
        createdAt: l.createdAt.toISOString(),
      })),
    });
  });
};
