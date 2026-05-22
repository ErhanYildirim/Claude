import type { FastifyPluginAsync, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@voltfox/db";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { createShareToken, verifyShareToken } from "../../../../src/api/share-links.js";

// ── Password helpers ──────────────────────────────────────────────────────────
function hashPassword(plain: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(plain, salt, 64).toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(plain: string, stored: string): boolean {
  const parts = stored.split(":");
  if (parts.length !== 2) return false;
  const [salt, hash] = parts;
  try {
    const buf = scryptSync(plain, salt, 64);
    return timingSafeEqual(buf, Buffer.from(hash, "hex"));
  } catch {
    return false;
  }
}

// ── Public share handler ──────────────────────────────────────────────────────
export async function publicShareHandler(request: FastifyRequest, reply: FastifyReply) {
  const { token } = request.params as { token: string };
  const { pw }    = request.query as { pw?: string };

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

  // Fetch share link record (for password check)
  const link = await prisma.shareLink.findUnique({
    where: { jti: payload.jti },
    select: { password: true },
  });

  if (link?.password) {
    if (!pw) {
      return reply.status(401).send({ error: "PASSWORD_REQUIRED" });
    }
    if (!verifyPassword(pw, link.password)) {
      return reply.status(401).send({ error: "INVALID_PASSWORD" });
    }
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

  // POST /share-links  — yeni paylaşım linki oluştur
  app.post("/share-links", {
    schema: {
      body: {
        type: "object",
        required: ["installationId", "periodId"],
        properties: {
          installationId: { type: "string", format: "uuid" },
          periodId:       { type: "string", format: "uuid" },
          ttlDays:        { type: "integer", minimum: 1, maximum: 365, default: 30 },
          password:       { type: "string", minLength: 1, maxLength: 128 },
        },
      },
    },
  }, async (request, reply) => {
    const { installationId, periodId, ttlDays = 30, password } =
      request.body as { installationId: string; periodId: string; ttlDays?: number; password?: string };

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

    await prisma.shareLink.create({
      data: {
        jti:           record.jti,
        tenantId:      request.tenantId,
        installationId,
        periodId,
        expiresAt:     record.expiresAt,
        password:      password ? hashPassword(password) : null,
      },
    });

    return reply.status(201).send({
      token,
      expiresAt:         record.expiresAt,
      passwordProtected: !!password,
    });
  });

  // PATCH /share-links/:jti — şifre veya son kullanma tarihi güncelle
  app.patch("/share-links/:jti", {
    schema: {
      body: {
        type: "object",
        properties: {
          password:  { type: ["string", "null"], maxLength: 128 },
          expiresAt: { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    const { jti } = request.params as { jti: string };
    const { password, expiresAt } = request.body as { password?: string | null; expiresAt?: string };

    const link = await prisma.shareLink.findFirst({
      where: { jti, tenantId: request.tenantId },
    });
    if (!link) return reply.status(404).send({ error: "NOT_FOUND" });

    const data: { password?: string | null; expiresAt?: Date } = {};
    if (password !== undefined) {
      data.password = password ? hashPassword(password) : null;
    }
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (isNaN(d.getTime())) return reply.status(400).send({ error: "INVALID_DATE" });
      data.expiresAt = d;
    }

    await prisma.shareLink.update({ where: { jti }, data });
    return reply.status(204).send();
  });

  // DELETE /share-links/:jti — token iptal et
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
