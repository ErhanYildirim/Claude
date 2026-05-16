import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const installationsRoutes: FastifyPluginAsync = async (app) => {

  const VALID_SECTORS = ["steel", "aluminium", "cement", "fertilizer", "electricity"] as const;

  // POST /installations
  app.post("/installations", {
    schema: {
      body: {
        type: "object",
        required: ["facilityName", "operator", "facilityCountry", "sector"],
        properties: {
          facilityName:    { type: "string", minLength: 1 },
          operator:        { type: "string", minLength: 1 },
          facilityCountry: { type: "string", minLength: 1 },
          facilityRef:     { type: "string" },
          sector: {
            type: "string",
            enum: ["steel", "aluminium", "cement", "fertilizer", "electricity"],
          },
        },
      },
    },
  }, async (request, reply) => {
    const { facilityName, operator, facilityCountry, facilityRef, sector } =
      request.body as {
        facilityName: string; operator: string;
        facilityCountry: string; facilityRef?: string;
        sector: string;
      };

    const installation = await prisma.installation.create({
      data: {
        tenantId: request.tenantId,
        facilityName, operator, facilityCountry,
        facilityRef: facilityRef ?? null,
        sector,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "CREATE",
        resource:   "Installation",
        resourceId: installation.id,
      },
    });

    return reply.status(201).send(installation);
  });

  // GET /installations
  app.get("/installations", async (request, reply) => {
    const installations = await prisma.installation.findMany({
      where: { tenantId: request.tenantId },
      orderBy: { createdAt: "desc" },
      include: { _count: { select: { periods: true } } },
    });
    return reply.send(installations);
  });

  // GET /installations/:id
  app.get("/installations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const installation = await prisma.installation.findFirst({
      where: { id, tenantId: request.tenantId },
      include: { periods: { orderBy: { createdAt: "desc" }, include: { result: true } } },
    });
    if (!installation) return reply.status(404).send({ error: "NOT_FOUND" });
    return reply.send(installation);
  });

  // DELETE /installations/:id
  app.delete("/installations/:id", async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await prisma.installation.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.installation.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "DELETE",
        resource:   "Installation",
        resourceId: id,
      },
    });

    return reply.status(204).send();
  });
};
