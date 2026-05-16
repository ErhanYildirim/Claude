// Read-only paylaşım linki sistemi
// JWT tabanlı: 30 gün TTL, revoke edilebilir, ithalatçı auth gerektirmez

import * as crypto from "crypto";

const SHARE_LINK_SECRET = process.env.SHARE_LINK_SECRET ?? "dev-secret-change-in-prod";
const DEFAULT_TTL_DAYS  = 30;

export interface ShareLinkPayload {
  tenantId:       string;
  installationId: string;
  periodId:       string;
  access:         "readonly";
  jti:            string; // unique token ID — revoke için
  iat:            number; // issued at (unix)
  exp:            number; // expiry (unix)
}

export interface ShareLinkRecord {
  token:     string;
  jti:       string;
  tenantId:  string;
  installationId: string;
  periodId:  string;
  expiresAt: Date;
  createdAt: Date;
  revokedAt: Date | null;
}

// ── Token üretimi ────────────────────────────────────────────────────────────
export function createShareToken(
  tenantId: string,
  installationId: string,
  periodId: string,
  ttlDays = DEFAULT_TTL_DAYS,
): { token: string; record: ShareLinkRecord } {
  const now    = Math.floor(Date.now() / 1000);
  const jti    = crypto.randomUUID();
  const exp    = now + ttlDays * 86400;

  const payload: ShareLinkPayload = {
    tenantId, installationId, periodId,
    access: "readonly",
    jti, iat: now, exp,
  };

  const token = encodeJwt(payload);

  const record: ShareLinkRecord = {
    token,
    jti,
    tenantId,
    installationId,
    periodId,
    expiresAt: new Date(exp * 1000),
    createdAt: new Date(),
    revokedAt: null,
  };

  return { token, record };
}

// ── Token doğrulama ───────────────────────────────────────────────────────────
export function verifyShareToken(
  token: string,
  revokedJtis: Set<string>,
): ShareLinkPayload {
  const payload = decodeJwt(token);

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp < now) {
    throw new ShareLinkError("TOKEN_EXPIRED", "Paylaşım linki süresi dolmuş.");
  }

  if (revokedJtis.has(payload.jti)) {
    throw new ShareLinkError("TOKEN_REVOKED", "Paylaşım linki iptal edilmiş.");
  }

  if (payload.access !== "readonly") {
    throw new ShareLinkError("INVALID_TOKEN", "Geçersiz token.");
  }

  return payload;
}

export class ShareLinkError extends Error {
  constructor(public code: string, message: string) {
    super(message);
    this.name = "ShareLinkError";
  }
}

// ── Minimal JWT (HMAC-SHA256, header.payload.sig) ────────────────────────────
// Not: production'da jose/jsonwebtoken kütüphanesi kullanılmalı
function encodeJwt(payload: ShareLinkPayload): string {
  const header  = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body    = b64url(JSON.stringify(payload));
  const sig     = hmacSha256(`${header}.${body}`, SHARE_LINK_SECRET);
  return `${header}.${body}.${sig}`;
}

function decodeJwt(token: string): ShareLinkPayload {
  const parts = token.split(".");
  if (parts.length !== 3) throw new ShareLinkError("INVALID_TOKEN", "Geçersiz token formatı.");

  const [header, body, sig] = parts;
  const expectedSig = hmacSha256(`${header}.${body}`, SHARE_LINK_SECRET);

  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) {
    throw new ShareLinkError("INVALID_TOKEN", "Token imzası geçersiz.");
  }

  return JSON.parse(Buffer.from(body, "base64url").toString());
}

function b64url(s: string): string {
  return Buffer.from(s).toString("base64url");
}

function hmacSha256(data: string, secret: string): string {
  return crypto.createHmac("sha256", secret).update(data).digest("base64url");
}
