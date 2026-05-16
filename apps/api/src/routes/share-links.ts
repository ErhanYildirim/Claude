import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@voltfox/db";
import { createShareToken, verifyShareToken } from "../../../../src/api/share-links.js";

// Kamuya açık handler — server.ts'e root scope'da kayıt edilir (config.public sorununu aşmak için)
export async function publicShareHandler(request: FastifyRequest, reply: FastifyReply) {
  const { token } = request.params as { token: string };

  let payload;
  try {
    const revoked = await prisma.shareLink.findMany({
      where: { revokedAt: { not: null } },
      select: { jti: true },
    });
    const revokedSet = new Set(revoked.map(r => r.jti));
    payload = verifyShareToken(token, revokedSet);
  } catch (e: unknown) {
    const code = (e as { code?: string }).code;
    const status = code === "TOKEN_EXPIRED" || code === "TOKEN_REVOKED" ? 410 : 401;
    return reply.status(status).send({ error: code ?? "INVALID_TOKEN" });
  }

  const result = await prisma.embeddedEmission.findFirst({
    where: { periodId: payload.periodId, period: { installationId: payload.installationId } },
    include: {
      period: {
        include: { installation: { select: { facilityName: true, operator: true } } },
      },
    },
  });

  if (!result) return reply.status(404).send({ error: "NO_RESULT" });
  return reply.send({ access: "readonly", payload, result });
}

export const shareLinksRoutes: FastifyPluginAsync = async (app) => {

  // GET /share/:token — kamuya açık, kimlik doğrulama yok (tenant.ts URL bypass)
  app.get("/share/:token", { config: { public: true } }, publicShareHandler);

  // POST /share-links  — yeni paylaşım linki oluştur (kimlik doğrulama gerekli)
  app.post("/share-links", {
    schema: {
      body: {
        type: "object",
        required: ["installationId", "periodId"],
        properties: {
          installationId: { type: "string", format: "uuid" },
          periodId:       { type: "string", format: "uuid" },
          ttlDays:        { type: "integer", minimum: 1, maximum: 365, default: 30 },
        },
      },
    },
  }, async (request, reply) => {
    const { installationId, periodId, ttlDays = 30 } =
      request.body as { installationId: string; periodId: string; ttlDays?: number };

    // Tenant sahipliği doğrula
    const period = await prisma.reportingPeriod.findFirst({
      where: {
        id: periodId,
        installationId,
        installation: { tenantId: request.tenantId },
      },
    });
    if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

    const { token, record } = createShareToken(
      request.tenantId, installationId, periodId, ttlDays
    );

    // jti'yi DB'ye kaydet (revoke için)
    await prisma.shareLink.create({
      data: {
        jti:           record.jti,
        tenantId:      request.tenantId,
        installationId,
        periodId,
        expiresAt:     record.expiresAt,
      },
    });

    return reply.status(201).send({ token, expiresAt: record.expiresAt });
  });


  // DELETE /share-links/:jti  — token iptal et
  app.delete("/share-links/:jti", async (request, reply) => {
    const { jti } = request.params as { jti: string };

    const link = await prisma.shareLink.findFirst({
      where: { jti, tenantId: request.tenantId },
    });
    if (!link) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.shareLink.update({
      where: { jti },
      data:  { revokedAt: new Date() },
    });

    return reply.status(204).send();
  });
};
