import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const searchRoutes: FastifyPluginAsync = async (app) => {

  // GET /search?q=&type=&sector=&country=
  app.get("/search", {
    schema: {
      querystring: {
        type: "object",
        properties: {
          q:       { type: "string", maxLength: 100 },
          type:    { type: "string", enum: ["installation", "period", "all"] },
          sector:  { type: "string" },
          country: { type: "string" },
          limit:   { type: "integer", minimum: 1, maximum: 50, default: 10 },
        },
      },
    },
  }, async (request, reply) => {
    const q = request.query as {
      q?: string; type?: string; sector?: string; country?: string; limit?: number;
    };

    const term    = (q.q ?? "").trim();
    const type    = q.type ?? "all";
    const limit   = q.limit ?? 10;
    const perType = Math.ceil(limit / 2);

    const installations =
      type === "period" ? [] :
      await prisma.installation.findMany({
        where: {
          tenantId: request.tenantId,
          ...(term ? {
            OR: [
              { facilityName:    { contains: term, mode: "insensitive" } },
              { operator:        { contains: term, mode: "insensitive" } },
              { facilityCountry: { contains: term, mode: "insensitive" } },
              { facilityRef:     { contains: term, mode: "insensitive" } },
            ],
          } : {}),
          ...(q.sector  ? { sector:          q.sector  } : {}),
          ...(q.country ? { facilityCountry: q.country } : {}),
        },
        orderBy: { updatedAt: "desc" },
        take:    perType,
        include: { _count: { select: { periods: true } } },
      });

    const periods =
      type === "installation" ? [] :
      await prisma.reportingPeriod.findMany({
        where: {
          installation: {
            tenantId:  request.tenantId,
            ...(q.sector  ? { sector:          q.sector  } : {}),
            ...(q.country ? { facilityCountry: q.country } : {}),
          },
          ...(term ? {
            OR: [
              { periodName:    { contains: term, mode: "insensitive" } },
              { cnCode:        { contains: term, mode: "insensitive" } },
              { importCountry: { contains: term, mode: "insensitive" } },
            ],
          } : {}),
        },
        orderBy: { createdAt: "desc" },
        take:    perType,
        include: {
          installation: { select: { id: true, facilityName: true, facilityCountry: true } },
          result:        { select: { seeVoltfox: true } },
        },
      });

    return reply.send({
      installations,
      periods,
      query: term,
      total: installations.length + periods.length,
    });
  });
};
