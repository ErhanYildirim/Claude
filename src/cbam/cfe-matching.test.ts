import { calculateCFEMatching } from "./cfe-matching.js";
import type { HourlySlot } from "./cfe-matching.js";

function makeSlots(count: number, consumption: number, production: number): HourlySlot[] {
  return Array.from({ length: count }, (_, i) => ({
    hour:           `2025-01-01T${String(i % 24).padStart(2, "0")}:00:00Z`,
    consumptionKwh: consumption,
    productionKwh:  production,
  }));
}

// ── Test 1: Tam eşleşme (100% CFE) ───────────────────────────────────────────
{
  const slots = makeSlots(24, 100, 100);
  const result = calculateCFEMatching({ installationId: "t1", periodLabel: "Test", slots });
  console.assert(result.cfeScore === 100, `[FAIL] 100% eşleşme — cfeScore: ${result.cfeScore}`);
  console.assert(result.totalMatchedKwh === 2400, `[FAIL] totalMatchedKwh: ${result.totalMatchedKwh}`);
  console.assert(result.matchedHours === 24, `[FAIL] matchedHours: ${result.matchedHours}`);
  console.log("[PASS] Tam eşleşme (100% CFE)");
}

// ── Test 2: Sıfır üretim (0% CFE) ────────────────────────────────────────────
{
  const slots = makeSlots(8, 100, 0);
  const result = calculateCFEMatching({ installationId: "t2", periodLabel: "Test", slots });
  console.assert(result.cfeScore === 0, `[FAIL] 0% CFE — cfeScore: ${result.cfeScore}`);
  console.assert(result.unmatchedHours === 8, `[FAIL] unmatchedHours: ${result.unmatchedHours}`);
  console.log("[PASS] Sıfır üretim (0% CFE)");
}

// ── Test 3: Kısmi eşleşme (%50 CFE) ─────────────────────────────────────────
{
  const slots = makeSlots(10, 200, 100);
  const result = calculateCFEMatching({ installationId: "t3", periodLabel: "Test", slots });
  console.assert(Math.abs(result.cfeScore - 50) < 0.001, `[FAIL] 50% CFE — cfeScore: ${result.cfeScore}`);
  console.assert(result.partialHours === 10, `[FAIL] partialHours: ${result.partialHours}`);
  console.assert(result.totalMatchedKwh === 1000, `[FAIL] totalMatchedKwh: ${result.totalMatchedKwh}`);
  console.log("[PASS] Kısmi eşleşme (50% CFE)");
}

// ── Test 4: PPA fazlası ───────────────────────────────────────────────────────
{
  const slots = makeSlots(5, 100, 150); // 50 kWh fazla her saatte
  const result = calculateCFEMatching({ installationId: "t4", periodLabel: "Test", slots });
  console.assert(result.cfeScore === 100, `[FAIL] PPA fazlası CFE — cfeScore: ${result.cfeScore}`);
  console.assert(result.ppaSurplusKwh === 250, `[FAIL] ppaSurplusKwh: ${result.ppaSurplusKwh}`);
  console.assert(result.ppaDeficitKwh === 0, `[FAIL] ppaDeficitKwh: ${result.ppaDeficitKwh}`);
  console.log("[PASS] PPA fazlası — cfeScore=100, surplus doğru");
}

// ── Test 5: Aylık breakdown ───────────────────────────────────────────────────
{
  const jan = Array.from({ length: 5 }, (_, i) => ({
    hour: `2025-01-01T0${i}:00:00Z`, consumptionKwh: 100, productionKwh: 80,
  }));
  const feb = Array.from({ length: 5 }, (_, i) => ({
    hour: `2025-02-01T0${i}:00:00Z`, consumptionKwh: 100, productionKwh: 100,
  }));
  const result = calculateCFEMatching({ installationId: "t5", periodLabel: "Test", slots: [...jan, ...feb] });
  const janMb  = result.monthlyBreakdown.find(m => m.month === "2025-01");
  const febMb  = result.monthlyBreakdown.find(m => m.month === "2025-02");
  console.assert(janMb && Math.abs(janMb.cfeRate - 80) < 0.01, `[FAIL] Ocak cfeRate: ${janMb?.cfeRate}`);
  console.assert(febMb && Math.abs(febMb.cfeRate - 100) < 0.01, `[FAIL] Şubat cfeRate: ${febMb?.cfeRate}`);
  console.log("[PASS] Aylık breakdown — Ocak %80, Şubat %100");
}

// ── Test 6: Negatif değer hatası ─────────────────────────────────────────────
{
  let threw = false;
  try {
    calculateCFEMatching({
      installationId: "t6", periodLabel: "Test",
      slots: [{ hour: "2025-01-01T00:00:00Z", consumptionKwh: -1, productionKwh: 100 }],
    });
  } catch { threw = true; }
  console.assert(threw, "[FAIL] Negatif değer için hata fırlatılmadı");
  console.log("[PASS] Negatif değer → hata");
}

// ── Test 7: Boş slot hatası ───────────────────────────────────────────────────
{
  let threw = false;
  try {
    calculateCFEMatching({ installationId: "t7", periodLabel: "Test", slots: [] });
  } catch { threw = true; }
  console.assert(threw, "[FAIL] Boş slots için hata fırlatılmadı");
  console.log("[PASS] Boş slots → hata");
}

console.log("\n✓ CFE Matching testleri tamamlandı");
