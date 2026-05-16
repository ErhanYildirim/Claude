/**
 * Voltfox API uçtan uca smoke test
 * Çalıştır: npx tsx _api_smoke.ts
 * Server'ın localhost:3000'de ayakta olması gerekiyor.
 */

const BASE = "http://localhost:3000/api/v1";
const DEV_TENANT = "11111111-1111-1111-1111-111111111111";
const HEADERS = {
  "Content-Type": "application/json",
  "X-Tenant-ID":  DEV_TENANT,
  "Connection":   "close",
};

interface HealthRes    { status: string; }
interface CountriesRes { countries: Array<{ name: string; iso2: string }>; }
interface CnCodesRes   { cnCodes: Array<{ code: string; description: string }>; }
interface InstRes      { id: string; facilityName: string; operator: string; facilityCountry: string; facilityRef: string | null; createdAt: string; }
interface PeriodRes    { id: string; installationId: string; periodName: string; startDate: string; endDate: string; }
interface CalcRes      {
  scope2?: { reductionPct: number };
  see?:    { seeBaseline: number; seeVoltfox: number | null };
  comparison?: { annualSavingsEur: number } | null;
}
interface ResultRes    { seeVoltfox: number; seeBaseline: number; }
interface ShareLinkRes { token: string; expiresAt: string; }
interface PublicShareRes { access: string; result: unknown; }

function ok(label: string, val: unknown) {
  console.log("  [OK]", label, typeof val === "object" ? "" : val);
}
function fail(label: string, err: unknown): never {
  console.error("[FAIL]", label, err);
  process.exit(1);
}

async function run() {
  console.log("\n=== Voltfox API Smoke Test ===\n");

  // ── 1. Health ─────────────────────────────────────────────────────────────
  const health = await fetch("http://localhost:3000/health").then(r => r.json()) as HealthRes;
  if (health.status !== "ok") fail("health", health);
  ok("GET /health", health.status);

  // ── 2. Defaults ───────────────────────────────────────────────────────────
  const countries = await fetch(`${BASE}/defaults/countries`).then(r => r.json()) as CountriesRes;
  if (!countries.countries?.length) fail("defaults/countries", countries);
  ok("GET /defaults/countries", `${countries.countries.length} ülke`);

  const turkey = await fetch(`${BASE}/defaults/countries/Türkiye/cn-codes`).then(r => r.json()) as CnCodesRes;
  if (!turkey.cnCodes?.length) fail("türkiye cn-codes", turkey);
  ok("GET /defaults/countries/Türkiye/cn-codes", `${turkey.cnCodes.length} CN kodu`);

  // ── 3. Installation oluştur ───────────────────────────────────────────────
  const instRes = await fetch(`${BASE}/installations`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      facilityName:    "Test Çelik Fabrikası",
      operator:        "Test A.Ş.",
      facilityCountry: "Türkiye",
      facilityRef:     "TEST-001",
    }),
  });
  if (!instRes.ok) fail("POST /installations", await instRes.text());
  const inst = await instRes.json() as InstRes;
  ok("POST /installations", `id=${inst.id}`);

  // ── 4. Üretim dönemi oluştur ──────────────────────────────────────────────
  const periodRes = await fetch(`${BASE}/installations/${inst.id}/periods`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({
      periodName:       "2024 Yıllık Test",
      startDate:        "2024-01-01",
      endDate:          "2024-12-31",
      reportYear:       2024,
      importCountry:    "Türkiye",
      cnCode:           "72061000",
      prodVolumeTonne:  50000,
      scope2Exempt:     false,

      scope1DirectTco2: 82959,
      scope1Quality:    "measured",
      scope1AuditNote:  "Doğal gaz sayaç verisi",

      electricityKwh:   15000000,
      electricitySource:"smart_meter",
      baselineEf:       0.474,
      renewableEf:      0.02,
      matchingRatePct:  75,
      gecConnected:     true,
      carbonPriceEur:   65,
    }),
  });
  if (!periodRes.ok) fail("POST /periods", await periodRes.text());
  const period = await periodRes.json() as PeriodRes;
  ok("POST /installations/:id/periods", `id=${period.id}`);

  // ── 5. SEE hesapla ────────────────────────────────────────────────────────
  const calcRes = await fetch(
    `${BASE}/installations/${inst.id}/periods/${period.id}/calculate`,
    { method: "POST", headers: { "X-Tenant-ID": DEV_TENANT, "Connection": "close" } }
  );
  if (!calcRes.ok) fail("POST /calculate", await calcRes.text());
  const calc = await calcRes.json() as CalcRes;
  ok("POST .../calculate", "");
  ok("  scope2.reductionPct",    calc.scope2?.reductionPct?.toFixed(1) + "%");
  ok("  see.seeBaseline",        calc.see?.seeBaseline?.toFixed(4) + " tCO₂e/t");
  ok("  see.seeVoltfox",         (calc.see?.seeVoltfox ?? calc.see?.seeBaseline)?.toFixed(4) + " tCO₂e/t");
  ok("  comparison.savings",     "€" + calc.comparison?.annualSavingsEur?.toFixed(0));

  // ── 6. Sonucu getir ───────────────────────────────────────────────────────
  const resultRes = await fetch(
    `${BASE}/installations/${inst.id}/periods/${period.id}/result`,
    { headers: HEADERS }
  );
  if (!resultRes.ok) fail("GET /result", await resultRes.text());
  const result = await resultRes.json() as ResultRes;
  ok("GET .../result (DB'den)",  `seeVoltfox=${result.seeVoltfox?.toFixed(4)}`);

  // ── 7. Share link ─────────────────────────────────────────────────────────
  const shareRes = await fetch(`${BASE}/share-links`, {
    method: "POST",
    headers: HEADERS,
    body: JSON.stringify({ installationId: inst.id, periodId: period.id, ttlDays: 7 }),
  });
  if (!shareRes.ok) fail("POST /share-links", await shareRes.text());
  const share = await shareRes.json() as ShareLinkRes;
  ok("POST /share-links", `expires=${new Date(share.expiresAt).toLocaleDateString("tr-TR")}`);

  const publicRes = await fetch(`${BASE.replace("/api/v1","")}/api/v1/share/${share.token}`);
  if (!publicRes.ok) fail("GET /share/:token", await publicRes.text());
  const pub = await publicRes.json() as PublicShareRes;
  ok("GET /share/:token (public)", `access=${pub.access}`);

  console.log("\nTüm testler başarılı. Platform hazır.\n");
}

run().catch(e => { console.error(e); process.exit(1); });
