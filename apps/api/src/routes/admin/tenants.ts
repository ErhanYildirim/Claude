import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const adminTenantsRoutes: FastifyPluginAsync = async (app) => {

  // GET /tenants — tüm tenant'ları listele
  app.get("/tenants", async (request, reply) => {
    const { search, limit = "50", offset = "0" } = request.query as {
      search?: string; limit?: string; offset?: string;
    };

    const where = search
      ? { OR: [
          { name: { contains: search, mode: "insensitive" as const } },
          { slug: { contains: search, mode: "insensitive" as const } },
        ]}
      : {};

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit), 100),
        skip: parseInt(offset),
        include: {
          _count: { select: { members: true, installations: true } },
        },
      }),
      prisma.tenant.count({ where }),
    ]);

    return reply.send({ tenants, total });
  });

  // GET /tenants/:id — tenant detayı
  app.get("/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        members:       { select: { userId: true, role: true, createdAt: true } },
        installations: { select: { id: true, facilityName: true, facilityCountry: true } },
        _count:        { select: { members: true, installations: true } },
      },
    });

    if (!tenant) return reply.status(404).send({ error: "NOT_FOUND" });
    return reply.send(tenant);
  });

  // PATCH /tenants/:id — plan veya durum güncelle
  app.patch("/tenants/:id", async (request, reply) => {
    const { id }   = request.params as { id: string };
    const body     = request.body as { plan?: string; disabled?: boolean; name?: string };

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return reply.status(404).send({ error: "NOT_FOUND" });

    const updated = await prisma.tenant.update({
      where: { id },
      data: {
        ...(body.plan     !== undefined ? { plan:     body.plan }     : {}),
        ...(body.disabled !== undefined ? { disabled: body.disabled } : {}),
        ...(body.name     !== undefined ? { name:     body.name }     : {}),
      },
    });

    return reply.send(updated);
  });

  // DELETE /tenants/:id — tenant'ı sil (dikkatli!)
  app.delete("/tenants/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) return reply.status(404).send({ error: "NOT_FOUND" });

    // Cascade: Prisma schema'sında onDelete: Cascade tanımlı olmalı
    await prisma.tenant.delete({ where: { id } });
    return reply.status(204).send();
  });
};
