import { createHash, randomBytes } from "crypto";
import type { FastifyPluginAsync, FastifyRequest } from "fastify";
import { prisma } from "@voltfox/db";
import { requireRole } from "../plugins/rbac.js";
import { checkRateLimit, logApiRequest } from "../lib/api-request-logger.js";

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

export interface ApiKeyVerifyResult {
  tenantId:       string;
  keyId:          string;
  rateLimitPerMin: number | null;
}

export interface ApiKeyVerifyError {
  error: "NOT_FOUND" | "REVOKED" | "EXPIRED" | "SCOPE" | "RATE_LIMIT";
  retryAfterMs?: number;
}

// Harici middleware: API key doğrulama (Data Service endpoint'leri için)
export async function verifyApiKey(
  rawKey: string,
  requiredScope: string,
  request?: FastifyRequest,
): Promise<ApiKeyVerifyResult | ApiKeyVerifyError> {
  const hash = hashKey(rawKey);

  const key = await prisma.apiKey.findUnique({
    where:  { keyHash: hash },
    select: { id: true, tenantId: true, scopes: true, revokedAt: true, expiresAt: true, rateLimitPerMin: true },
  });

  if (!key)            return { error: "NOT_FOUND" };
  if (key.revokedAt)   return { error: "REVOKED" };
  if (key.expiresAt && key.expiresAt < new Date()) return { error: "EXPIRED" };
  if (!key.scopes.includes(requiredScope))          return { error: "SCOPE" };

  // Per-key rate limit kontrolü
  if (!checkRateLimit(key.id, key.rateLimitPerMin)) {
    return { error: "RATE_LIMIT", retryAfterMs: 60_000 };
  }

  // lastUsedAt güncelle (fire-and-forget)
  prisma.apiKey.update({
    where: { id: key.id },
    data:  { lastUsedAt: new Date() },
  }).catch(() => {});

  return {
    tenantId:        key.tenantId,
    keyId:           key.id,
    rateLimitPerMin: key.rateLimitPerMin,
  };
}

/**
 * Fastify route handler için kullanılacak yardımcı:
 * Authorization: Bearer vf_... header'ını doğrular,
 * hata varsa reply'a 401/429 gönderir ve false döndürür.
 * Başarılıysa request logging tetikler ve true döndürür.
 */
export async function requireApiKey(
  request: FastifyRequest,
  reply: import("fastify").FastifyReply,
  requiredScope: string,
): Promise<{ tenantId: string; keyId: string } | null> {
  const startMs = Date.now();
  const auth = request.headers.authorization ?? "";
  if (!auth.startsWith("Bearer vf_")) {
    reply.status(401).send({ error: "UNAUTHORIZED", message: "API anahtarı gerekli. Bearer vf_... formatında gönderin." });
    return null;
  }

  const raw    = auth.slice(7);
  const result = await verifyApiKey(raw, requiredScope, request);

  if ("error" in result) {
    const msgs: Record<string, [number, string]> = {
      NOT_FOUND:  [401, "API anahtarı bulunamadı."],
      REVOKED:    [401, "API anahtarı iptal edilmiş."],
      EXPIRED:    [401, "API anahtarının süresi dolmuş."],
      SCOPE:      [403, `Bu işlem için '${requiredScope}' kapsamı gerekli.`],
      RATE_LIMIT: [429, "Hız limiti aşıldı. Lütfen bekleyin."],
    };
    const [status, message] = msgs[result.error] ?? [401, "Yetkisiz erişim."];
    if (result.error === "RATE_LIMIT" && result.retryAfterMs) {
      reply.header("Retry-After", Math.ceil(result.retryAfterMs / 1000).toString());
    }
    reply.status(status).send({ error: result.error, message });
    return null;
  }

  // Request log (fire-and-forget) — URL'den sadece path ve ilk 2 segment al
  const endpoint = request.url.split("?")[0].replace(/\/[0-9a-f-]{36}/gi, "/:id");
  logApiRequest({
    apiKeyId:   result.keyId,
    tenantId:   result.tenantId,
    method:     request.method,
    endpoint,
    statusCode: 200, // optimistic; gerçek kod hook'ta güncellenebilir
    durationMs: Date.now() - startMs,
    ipAddress:  request.ip,
    userAgent:  request.headers["user-agent"]?.slice(0, 255),
  });

  return { tenantId: result.tenantId, keyId: result.keyId };
}
