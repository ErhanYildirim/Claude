import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { requireRole, ROLE_RANK } from "../plugins/rbac.js";

const VALID_ROLES = ["owner", "admin", "analyst", "viewer"] as const;

export const membersRoutes: FastifyPluginAsync = async (app) => {

  // GET /members — tenant üyelerini listele (admin+)
  app.get("/members", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const members = await prisma.tenantMember.findMany({
      where:   { tenantId: request.tenantId },
      orderBy: { createdAt: "asc" },
      select:  { id: true, userId: true, role: true, createdAt: true },
    });

    return reply.send({ members });
  });

  // POST /members — yeni üye ekle (admin+)
  app.post("/members", {
    schema: {
      body: {
        type: "object",
        required: ["userId", "role"],
        properties: {
          userId: { type: "string", format: "uuid" },
          role:   { type: "string", enum: VALID_ROLES as unknown as string[] },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { userId, role } = request.body as { userId: string; role: string };

    // owner rolü sadece owner verebilir
    if (role === "owner" && !await requireRole(request, reply, "owner")) return;

    const member = await prisma.tenantMember.upsert({
      where:  { tenantId_userId: { tenantId: request.tenantId, userId } },
      create: { tenantId: request.tenantId, userId, role },
      update: { role },
    });

    return reply.status(201).send(member);
  });

  // PATCH /members/:userId — rol güncelle (admin+, owner rolü sadece owner değiştirebilir)
  app.patch("/members/:userId", {
    schema: {
      body: {
        type: "object",
        required: ["role"],
        properties: { role: { type: "string", enum: VALID_ROLES as unknown as string[] } },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { userId } = request.params as { userId: string };
    const { role }   = request.body as { role: string };

    const existing = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

    // owner rolüne terfi veya owner'ı değiştirme sadece owner yapabilir
    const targetRank  = ROLE_RANK[role] ?? 0;
    const currentRank = ROLE_RANK[existing.role] ?? 0;
    if (targetRank >= ROLE_RANK["owner"] || currentRank >= ROLE_RANK["owner"]) {
      if (!await requireRole(request, reply, "owner")) return;
    }

    const updated = await prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
      data:  { role },
    });

    return reply.send(updated);
  });

  // DELETE /members/:userId — üyeyi çıkar (owner only)
  app.delete("/members/:userId", async (request, reply) => {
    if (!await requireRole(request, reply, "owner")) return;

    const { userId } = request.params as { userId: string };

    const existing = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.tenantMember.delete({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });

    return reply.status(204).send();
  });

  // GET /members/me — kendi rolünü öğren
  app.get("/members/me", async (request, reply) => {
    if (!request.userId) {
      return reply.send({ role: "owner", note: "dev-bypass — no JWT auth" });
    }

    const member = await prisma.tenantMember.findUnique({
      where:  { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
      select: { role: true },
    });

    if (!member) return reply.status(403).send({ error: "NOT_MEMBER" });
    return reply.send({ role: member.role });
  });
};
