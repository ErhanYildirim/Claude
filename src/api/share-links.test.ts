import { createShareToken, verifyShareToken, ShareLinkError } from "./share-links.js";

const TENANT = "11111111-1111-1111-1111-111111111111";
const INST   = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const PERIOD = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

function test(name: string, fn: () => void) {
  try { fn(); console.log(`  [OK] ${name}`); }
  catch (e: unknown) { console.error(`  [FAIL] ${name}: ${(e as Error).message}`); process.exit(1); }
}

console.log("=== Share Link Testleri ===");

const { token, record } = createShareToken(TENANT, INST, PERIOD, 30);

test("token üretildi", () => {
  if (!token || token.split(".").length !== 3) throw new Error("geçersiz token formatı");
});

test("token doğrulandı", () => {
  const payload = verifyShareToken(token, new Set());
  if (payload.tenantId !== TENANT) throw new Error("tenantId eşleşmiyor");
  if (payload.access !== "readonly") throw new Error("access claim yanlış");
});

test("revoke edilmiş token reddedilir", () => {
  const revoked = new Set([record.jti]);
  try { verifyShareToken(token, revoked); throw new Error("hata fırlatılmadı"); }
  catch (e: unknown) {
    if (e instanceof ShareLinkError && e.code === "TOKEN_REVOKED") return;
    throw e;
  }
});

test("tampered token reddedilir", () => {
  const parts = token.split(".");
  parts[1] = Buffer.from(JSON.stringify({ tenantId: "hacker", access: "admin" })).toString("base64url");
  try { verifyShareToken(parts.join("."), new Set()); throw new Error("hata fırlatılmadı"); }
  catch (e: unknown) {
    if (e instanceof ShareLinkError && e.code === "INVALID_TOKEN") return;
    throw e;
  }
});

test("süresi dolmuş token reddedilir", () => {
  // TTL = -1 gün → hemen süresi dolar
  const { token: expired } = createShareToken(TENANT, INST, PERIOD, -1);
  try { verifyShareToken(expired, new Set()); throw new Error("hata fırlatılmadı"); }
  catch (e: unknown) {
    if (e instanceof ShareLinkError && e.code === "TOKEN_EXPIRED") return;
    throw e;
  }
});

test("record doğru TTL içeriyor", () => {
  const diffDays = (record.expiresAt.getTime() - record.createdAt.getTime()) / 86400000;
  if (Math.round(diffDays) !== 30) throw new Error(`TTL ${diffDays} gün, 30 beklendi`);
});

console.log("\nTüm testler geçti.");
