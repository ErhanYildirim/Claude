// scope1.ts testleri — IPCC 2006 bazlı yakıt EF hesaplama
import { calculateScope1FromFuelBreakdown, FUEL_EF_TCO2_PER_MWH } from "./scope1.js";

const now = new Date().toISOString();
const VER = "1.0.0";
let pass = 0; let fail = 0;

function check(label: string, ok: boolean, detail?: string) {
  if (ok) { console.log(`[PASS] ${label}`); pass++; }
  else     { console.error(`[FAIL] ${label}${detail ? " — " + detail : ""}`); fail++; }
}

// Test 1: Tek yakıt — doğalgaz
{
  const res = calculateScope1FromFuelBreakdown(
    [{ fuelType: "natural_gas", consumedMwh: 1000 }],
    VER, now,
  );
  const expected = 1000 * FUEL_EF_TCO2_PER_MWH.natural_gas;
  check("Doğalgaz 1000 MWh", Math.abs(res.totalTco2 - expected) < 0.001, `got ${res.totalTco2}`);
  check("1 audit trail satırı", res.auditTrail.length === 1);
  check("Uyarı yok", res.warnings.length === 0);
}

// Test 2: Çoklu yakıt toplamı
{
  const res = calculateScope1FromFuelBreakdown(
    [
      { fuelType: "natural_gas", consumedMwh: 500 },
      { fuelType: "hard_coal",   consumedMwh: 200 },
    ],
    VER, now,
  );
  const expected = 500 * 0.202 + 200 * 0.341;
  check("Doğalgaz + kömür toplam", Math.abs(res.totalTco2 - expected) < 0.001);
  check("2 audit satırı", res.auditTrail.length === 2);
}

// Test 3: Biyokütle — 0 tCO₂ ama uyarı var
{
  const res = calculateScope1FromFuelBreakdown(
    [{ fuelType: "wood_biomass", consumedMwh: 300 }],
    VER, now,
  );
  check("Biyokütle tCO₂=0", res.totalTco2 === 0);
  check("Biyokütle uyarısı", res.warnings.some(w => w.includes("biogenic")));
}

// Test 4: Kullanıcı EF override
{
  const customEf = 0.150;
  const res = calculateScope1FromFuelBreakdown(
    [{ fuelType: "natural_gas", consumedMwh: 1000, emissionFactorOverride: customEf }],
    VER, now,
  );
  check("EF override uygulandı", Math.abs(res.totalTco2 - 1000 * customEf) < 0.001);
  check("Override audit kaynağı", res.auditTrail[0].source === "user_provided");
  check("IPCC default not used", res.lines[0].efUsed === customEf);
}

// Test 5: Negatif tüketim yoksayılır
{
  const res = calculateScope1FromFuelBreakdown(
    [
      { fuelType: "natural_gas", consumedMwh: -100 },
      { fuelType: "diesel",      consumedMwh:  200 },
    ],
    VER, now,
  );
  check("Negatif yoksayıldı", Math.abs(res.totalTco2 - 200 * 0.266) < 0.001);
  check("Negatif uyarısı", res.warnings.some(w => w.includes("negatif")));
}

// Test 6: Boş liste
{
  const res = calculateScope1FromFuelBreakdown([], VER, now);
  check("Boş liste → totalTco2=0", res.totalTco2 === 0);
}

console.log(`\n✓ Scope 1 testleri tamamlandı (${pass} geçti, ${fail} başarısız)`);
if (fail > 0) process.exit(1);
