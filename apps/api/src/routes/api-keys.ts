import { createHash, randomBytes } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { requireRole } from "../plugins/rbac.js";

const VALID_SCOPES = ["ef:read", "calculation:read", "calculation:write", "report:read"] as const;

function generateApiKey(): { raw: string; hash: string; prefix: string } {
  const raw    = "vf_" + randomBytes(32).toString("hex");
  const hash   = createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 11); // "vf_" + 8 chars
  return { raw, hash, prefix };
}

function hashKey(raw: string): string {
  return createHash("sha256").update(raw).digest("hex");
}

export const apiKeysRoutes: FastifyPluginAsync = async (app) => {

  // POST /api-keys — yeni API key oluştur (admin+)
  app.post("/api-keys", {
    schema: {
      body: {
        type: "object",
        required: ["name", "scopes"],
        properties: {
          name:      { type: "string", minLength: 1, maxLength: 100 },
          scopes:    { type: "array", items: { type: "string", enum: VALID_SCOPES as unknown as string[] } },
          expiresAt: { type: "string", format: "date-time" },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { name, scopes, expiresAt } = request.body as {
      name: string; scopes: string[]; expiresAt?: string;
    };

    const { raw, hash, prefix } = generateApiKey();

    const apiKey = await prisma.apiKey.create({
      data: {
        tenantId:  request.tenantId,
        name,
        keyHash:   hash,
        prefix,
        scopes,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "CREATE",
        resource:   "ApiKey",
        resourceId: apiKey.id,
        payload:    { name, scopes },
      },
    });

    // raw key sadece bir kez döner — DB'de saklanmaz
    return reply.status(201).send({
      id:        apiKey.id,
      name:      apiKey.name,
      prefix:    apiKey.prefix,
      scopes:    apiKey.scopes,
      expiresAt: apiKey.expiresAt,
      createdAt: apiKey.createdAt,
      key:       raw, // TEK SEFERLIK — kaydet
    });
  });

  // GET /api-keys — tenant'ın key listesi (admin+)
  app.get("/api-keys", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const keys = await prisma.apiKey.findMany({
      where:   { tenantId: request.tenantId, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, name: true, prefix: true, scopes: true,
        expiresAt: true, lastUsedAt: true, createdAt: true,
      },
    });

    return reply.send({ keys });
  });

  // DELETE /api-keys/:id — key iptal et (admin+)
  app.delete("/api-keys/:id", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { id } = request.params as { id: string };

    const key = await prisma.apiKey.findFirst({
      where: { id, tenantId: request.tenantId, revokedAt: null },
    });
    if (!key) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.apiKey.update({
      where: { id },
      data:  { revokedAt: new Date() },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "REVOKE",
        resource:   "ApiKey",
        resourceId: id,
      },
    });

    return reply.status(204).send();
  });
};

// Harici middleware: API key doğrulama (Data Service endpoint'leri için)
export async function verifyApiKey(
  rawKey: string,
  requiredScope: string,
): Promise<{ tenantId: string; keyId: string } | null> {
  const hash = hashKey(rawKey);

  const key = await prisma.apiKey.findUnique({
    where: { keyHash: hash },
  });

  if (!key) return null;
  if (key.revokedAt) return null;
  if (key.expiresAt && key.expiresAt < new Date()) return null;
  if (!key.scopes.includes(requiredScope)) return null;

  // lastUsedAt güncelle (fire-and-forget)
  prisma.apiKey.update({
    where: { id: key.id },
    data:  { lastUsedAt: new Date() },
  }).catch(() => {});

  return { tenantId: key.tenantId, keyId: key.id };
}
