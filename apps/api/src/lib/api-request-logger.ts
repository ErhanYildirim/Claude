import { prisma } from "@voltfox/db";

// ── Per-key rate limiter (sliding window) ─────────────────────────────────────
const rateLimitWindows = new Map<string, number[]>();

setInterval(() => {
  const cutoff = Date.now() - 60_000;
  for (const [keyId, timestamps] of rateLimitWindows) {
    const fresh = timestamps.filter(t => t > cutoff);
    if (fresh.length === 0) rateLimitWindows.delete(keyId);
    else rateLimitWindows.set(keyId, fresh);
  }
}, 5 * 60 * 1000).unref();

/** Returns true if allowed, false if rate limit exceeded. */
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

// ── Brute-force koruması (API key doğrulama hataları) ──────────────────────────
// Map<key_prefix_or_ip, {count, bannedUntil}>
const bruteForceMap = new Map<string, { count: number; bannedUntil: number }>();

const BRUTE_MAX_ATTEMPTS = 5;
const BRUTE_BAN_MS       = 15 * 60 * 1000; // 15 dakika
const BRUTE_WINDOW_MS    = 5  * 60 * 1000; // 5 dakika pencere

setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of bruteForceMap) {
    if (entry.bannedUntil < now && entry.count === 0) bruteForceMap.delete(key);
  }
}, 10 * 60 * 1000).unref();

/** Returns true if IP/key is currently banned. */
export function isBruteForced(identifier: string): boolean {
  const entry = bruteForceMap.get(identifier);
  if (!entry) return false;
  if (entry.bannedUntil > Date.now()) return true;
  // Ban süresi geçmiş — sıfırla
  bruteForceMap.delete(identifier);
  return false;
}

/** Returns remaining ban time in ms (0 if not banned). */
export function getBanRemainingMs(identifier: string): number {
  const entry = bruteForceMap.get(identifier);
  if (!entry || entry.bannedUntil <= Date.now()) return 0;
  return entry.bannedUntil - Date.now();
}

/** Başarısız auth denemesini kaydet; limit aşılırsa ban uygula. */
export function recordAuthFailure(identifier: string): void {
  const now   = Date.now();
  const entry = bruteForceMap.get(identifier) ?? { count: 0, bannedUntil: 0 };

  // Önceki ban geçmişse sıfırla
  if (entry.bannedUntil > 0 && entry.bannedUntil < now) {
    entry.count      = 0;
    entry.bannedUntil = 0;
  }

  entry.count++;
  if (entry.count >= BRUTE_MAX_ATTEMPTS) {
    entry.bannedUntil = now + BRUTE_BAN_MS;
  }

  bruteForceMap.set(identifier, entry);

  // Pencere sonunda sayacı sıfırla (ban değilse)
  if (entry.bannedUntil === 0) {
    setTimeout(() => {
      const e = bruteForceMap.get(identifier);
      if (e && e.bannedUntil === 0) bruteForceMap.delete(identifier);
    }, BRUTE_WINDOW_MS).unref();
  }
}

/** Başarılı auth — sayacı sıfırla. */
export function recordAuthSuccess(identifier: string): void {
  bruteForceMap.delete(identifier);
}

// ── Request log ───────────────────────────────────────────────────────────────
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
