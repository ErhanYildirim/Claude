import { extractTenantId, assertTenantOwnership, TenantIsolationError } from "./tenant.js";

const TENANT_A = "11111111-1111-1111-1111-111111111111";
const TENANT_B = "22222222-2222-2222-2222-222222222222";

function test(name: string, fn: () => void) {
  try { fn(); console.log(`  [OK] ${name}`); }
  catch (e: unknown) { console.error(`  [FAIL] ${name}: ${(e as Error).message}`); process.exit(1); }
}

console.log("=== Tenant Middleware Testleri ===");

test("geçerli UUID kabul edilir", () => {
  const id = extractTenantId({ "x-tenant-id": TENANT_A });
  if (id !== TENANT_A) throw new Error("ID eşleşmiyor");
});

test("eksik header hata fırlatır", () => {
  try { extractTenantId({}); throw new Error("hata fırlatılmadı"); }
  catch (e: unknown) { if ((e as Error).message.includes("X-Tenant-ID")) return; throw e; }
});

test("geçersiz UUID hata fırlatır", () => {
  try { extractTenantId({ "x-tenant-id": "not-a-uuid" }); throw new Error("hata fırlatılmadı"); }
  catch (e: unknown) { if ((e as Error).message.includes("X-Tenant-ID")) return; throw e; }
});

test("aynı tenant erişimi geçer", () => {
  assertTenantOwnership(TENANT_A, TENANT_A); // hata fırlatmamalı
});

test("farklı tenant erişimi reddedilir", () => {
  try { assertTenantOwnership(TENANT_A, TENANT_B); throw new Error("hata fırlatılmadı"); }
  catch (e: unknown) {
    if (e instanceof TenantIsolationError) return;
    throw e;
  }
});

console.log("\nTüm testler geçti.");
