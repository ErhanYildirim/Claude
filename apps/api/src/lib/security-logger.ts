import { prisma } from "@voltfox/db";

export type SecurityEvent =
  | "AUTH_FAILURE"       // Geçersiz JWT
  | "AUTH_SUCCESS"
  | "RATE_LIMIT_HIT"     // Global rate limit
  | "ADMIN_ACCESS"       // Admin panel başarılı erişim
  | "ADMIN_AUTH_FAILURE" // Admin panel başarısız erişim
  | "TENANT_VIOLATION"   // Cross-tenant erişim girişimi
  | "BRUTE_FORCE_BAN"    // IP ban
  | "API_KEY_REVOKED";   // Key iptal edildi

export interface SecurityLogPayload {
  event:      SecurityEvent;
  tenantId?:  string;
  userId?:    string;
  ipAddress?: string;
  userAgent?: string;
  details?:   Record<string, unknown>;
  url?:       string;
  method?:    string;
}

const SYSTEM_TENANT = "00000000-0000-0000-0000-000000000000";

/** Fire-and-forget güvenlik olayı kaydeder. AuditLog tablosuna yazar. */
export function logSecurityEvent(payload: SecurityLogPayload): void {
  const tenantId = payload.tenantId ?? SYSTEM_TENANT;

  prisma.auditLog.create({
    data: {
      tenantId,
      userId:     payload.userId ?? undefined,
      action:     payload.event,
      resource:   "Security",
      resourceId: null,
      payload: {
        event:    payload.event,
        url:      payload.url ?? null,
        method:   payload.method ?? null,
        details:  (payload.details as Record<string, string | number | boolean | null>) ?? null,
      },
      ipAddress: payload.ipAddress ?? null,
    },
  }).catch(() => {});
}
