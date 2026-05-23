import { prisma } from "@voltfox/db";

// In-memory sliding-window rate limiter — Redis gerekmez
// Map<apiKeyId, timestamp[]>
const rateLimitWindows = new Map<string, number[]>();

// Her 5 dakikada bir eski timestamp'leri temizle
setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [keyId, timestamps] of rateLimitWindows) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) rateLimitWindows.delete(keyId);
    else rateLimitWindows.set(keyId, fresh);
  }
}, 5 * 60 * 1000).unref();

/**
 * Returns true if the request is allowed, false if rate limit exceeded.
 * limitPerMin=null means use global default (100).
 */
export function checkRateLimit(apiKeyId: string, limitPerMin: number | null): boolean {
  const limit   = limitPerMin ?? 100;
  const now     = Date.now();
  const cutoff  = now - 60_000;

  const timestamps = (rateLimitWindows.get(apiKeyId) ?? []).filter(t => t > cutoff);
  if (timestamps.length >= limit) return false;

  timestamps.push(now);
  rateLimitWindows.set(apiKeyId, timestamps);
  return true;
}

/** Returns current request count in the past 60s for a key. */
export function getCurrentUsage(apiKeyId: string): number {
  const cutoff = Date.now() - 60_000;
  return (rateLimitWindows.get(apiKeyId) ?? []).filter(t => t > cutoff).length;
}

export interface RequestLogEntry {
  apiKeyId:   string;
  tenantId:   string;
  method:     string;
  endpoint:   string;
  statusCode: number;
  durationMs: number;
  ipAddress?: string;
  userAgent?: string;
}

/** Fire-and-forget — hataları sessizce yuter. */
export function logApiRequest(entry: RequestLogEntry): void {
  prisma.apiRequestLog.create({ data: entry }).catch(() => {});
}
