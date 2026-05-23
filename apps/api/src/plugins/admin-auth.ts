import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "@voltfox/db";

// ADMIN_IP_ALLOWLIST=1.2.3.4,5.6.7.8 — boşsa tüm IP'lere izin ver
const ALLOWED_IPS: Set<string> | null = (() => {
  const raw = process.env.ADMIN_IP_ALLOWLIST?.trim();
  if (!raw) return null;
  const ips = raw.split(",").map(s => s.trim()).filter(Boolean);
  return ips.length > 0 ? new Set(ips) : null;
})();

function clientIp(request: FastifyRequest): string {
  // Reverse proxy arkasındaysa x-forwarded-for'u kontrol et
  const xff = request.headers["x-forwarded-for"];
  if (typeof xff === "string") return xff.split(",")[0].trim();
  return request.ip;
}

async function logAdminAccess(
  userId: string,
  ip: string,
  success: boolean,
  reason: string,
  request: FastifyRequest,
) {
  try {
    await prisma.auditLog.create({
      data: {
        tenantId:   "00000000-0000-0000-0000-000000000000", // system tenant
        userId:     userId || undefined,
        action:     success ? "ADMIN_ACCESS" : "ADMIN_AUTH_FAILURE",
        resource:   "Admin",
        resourceId: null,
        payload: {
          ip,
          method:  request.method,
          url:     request.url,
          reason,
          success,
        },
        ipAddress: ip,
      },
    });
  } catch {
    // audit log hatası sistemi durdurmasın
  }
}

/**
 * Super-admin kimlik doğrulama — Supabase app_metadata.is_super_admin === true kontrolü.
 * IP allowlist ve başarısız giriş audit logging içerir.
 */
export async function requireSuperAdmin(
  app: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<boolean> {
  const ip = clientIp(request);

  // ── IP allowlist kontrolü ────────────────────────────────────────────────
  if (ALLOWED_IPS !== null && !ALLOWED_IPS.has(ip)) {
    app.log.warn({ ip, url: request.url }, "[Admin] IP allowlist ihlali");
    await logAdminAccess("", ip, false, "IP_NOT_ALLOWED", request);
    reply.status(403).send({ error: "FORBIDDEN", message: "Bu IP adresinden admin paneline erişim yasak." });
    return false;
  }

  if (!app.hasDecorator("supabase")) {
    reply.status(503).send({ error: "SERVICE_UNAVAILABLE", message: "Auth servisi başlatılmamış." });
    return false;
  }

  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    await logAdminAccess("", ip, false, "MISSING_TOKEN", request);
    reply.status(401).send({ error: "UNAUTHORIZED", message: "Bearer token gerekli." });
    return false;
  }

  const token = authHeader.slice(7);
  const { data: { user }, error } = await app.supabase.auth.getUser(token);

  if (error || !user) {
    await logAdminAccess("", ip, false, "INVALID_TOKEN", request);
    reply.status(401).send({ error: "UNAUTHORIZED", message: "Geçersiz token." });
    return false;
  }

  if (user.app_metadata?.is_super_admin !== true) {
    await logAdminAccess(user.id, ip, false, "NOT_SUPER_ADMIN", request);
    app.log.warn({ userId: user.id, ip }, "[Admin] Super-admin olmayan erişim girişimi");
    reply.status(403).send({ error: "FORBIDDEN", message: "Super-admin yetkisi gerekli." });
    return false;
  }

  request.userId = user.id;
  await logAdminAccess(user.id, ip, true, "OK", request);
  return true;
}
