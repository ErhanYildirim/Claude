import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";

/**
 * Super-admin kimlik doğrulama — Supabase app_metadata.is_super_admin === true kontrolü.
 * Tenant plugin'i admin route'ları atladığı için bu fonksiyon kendi JWT doğrulamasını yapar.
 * request.userId'yi set eder, false döndürürse reply zaten gönderilmiştir.
 */
export async function requireSuperAdmin(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  if (!app.hasDecorator("supabase")) {
    reply.status(503).send({ error: "SERVICE_UNAVAILABLE", message: "Auth servisi başlatılmamış." });
    return false;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    reply.status(401).send({ error: "UNAUTHORIZED", message: "Bearer token gerekli." });
    return false;
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await app.supabase.auth.getUser(token);

  if (error || !user) {
    reply.status(401).send({ error: "UNAUTHORIZED", message: "Geçersiz token." });
    return false;
  }

  if (user.app_metadata?.is_super_admin !== true) {
    reply.status(403).send({ error: "FORBIDDEN", message: "Super-admin yetkisi gerekli." });
    return false;
  }

  request.userId = user.id;
  return true;
}
