/**
 * cbam-scope1-calc unit testleri — Node.js built-in test runner
 * Çalıştırma: node --import tsx/esm --test src/lib/cbam-scope1-calc.test.ts
 */

import { test } from "node:test";
import assert from "node:assert/strict";
import {
  calculateCbamScope1,
  FUEL_EF_TCO2_PER_GJ,
  PROCESS_STOICH,
} from "./cbam-scope1-calc.js";

// ── Senaryo 1: Sadece doğalgaz ───────────────────────────────────────────────
test("sadece gaz — 1000 GJ doğalgaz → 56.1 tCO₂", () => {
  const result = calculateCbamScope1({
    fuels: [{
      fuelType:    "naturalGas",
      quantityGJ:  1000,
      efTco2PerGj: FUEL_EF_TCO2_PER_GJ.naturalGas,  // 0.0561
    }],
    processEmissions: [],
  });

  // 1000 × 0.0561 = 56.1
  assert.equal(result.breakdown.fuel, 56.1, "yakıt tco2 56.1 olmalı");
  assert.equal(result.breakdown.process, 0, "proses sıfır olmalı");
  assert.equal(result.directTco2, 56.1, "toplam directTco2 56.1 olmalı");
  assert.ok(result.warnings.length === 0, "uyarı olmamalı");
  assert.ok(result.auditTrail.length >= 2, "audit trail en az 2 satır içermeli");
  assert.ok(
    result.auditTrail.some(e => e.field === "fuel.naturalGas" && e.source === "IPCC_2006_GL_Vol2_Table1.4"),
    "standart kaynak belgelenmeli"
  );
});

// ── Senaryo 2: Sadece proses emisyonu ────────────────────────────────────────
test("sadece proses — 100 tonne CaCO3 → ~43.97 tCO₂", () => {
  const result = calculateCbamScope1({
    fuels: [],
    processEmissions: [{
      material:      "CaCO3",
      quantityTonne: 100,
      stoichFactor:  PROCESS_STOICH.CaCO3,  // 0.4397
    }],
  });

  // 100 × 0.4397 = 43.97
  assert.equal(result.breakdown.fuel, 0, "yakıt sıfır olmalı");
  assert.ok(
    Math.abs(result.breakdown.process - 43.97) < 0.001,
    `proses tco2 ~43.97 olmalı, ${result.breakdown.process} alındı`
  );
  assert.ok(
    Math.abs(result.directTco2 - 43.97) < 0.001,
    `toplam ~43.97 olmalı, ${result.directTco2} alındı`
  );
  assert.ok(
    result.auditTrail.some(e => e.field === "process.CaCO3"),
    "CaCO3 audit satırı bulunmalı"
  );
});

// ── Senaryo 3: Karma — çelik tesisi (kömür + doğalgaz + dolomit) ─────────────
test("karma — çelik tesisi: 500 GJ kömür + 200 GJ gaz + 50 t dolomit", () => {
  const result = calculateCbamScope1({
    fuels: [
      { fuelType: "coal",       quantityGJ: 500, efTco2PerGj: FUEL_EF_TCO2_PER_GJ.coal },
      { fuelType: "naturalGas", quantityGJ: 200, efTco2PerGj: FUEL_EF_TCO2_PER_GJ.naturalGas },
    ],
    processEmissions: [
      { material: "dolomite", quantityTonne: 50, stoichFactor: PROCESS_STOICH.dolomite },
    ],
    calculatedBy: "test-suite",
  });

  // Yakıt: 500×0.0946 + 200×0.0561 = 47.3 + 11.22 = 58.52
  const expectedFuel = 500 * 0.0946 + 200 * 0.0561;
  // Proses: 50×0.4773 = 23.865
  const expectedProc = 50 * PROCESS_STOICH.dolomite;
  const expectedTotal = expectedFuel + expectedProc;

  assert.ok(
    Math.abs(result.breakdown.fuel - expectedFuel) < 0.001,
    `yakıt ${result.breakdown.fuel} ≠ beklenen ${expectedFuel}`
  );
  assert.ok(
    Math.abs(result.breakdown.process - expectedProc) < 0.001,
    `proses ${result.breakdown.process} ≠ beklenen ${expectedProc}`
  );
  assert.ok(
    Math.abs(result.directTco2 - expectedTotal) < 0.01,
    `toplam ${result.directTco2} ≠ beklenen ${expectedTotal}`
  );

  // Audit trail: calculatedBy kaydı olmalı
  assert.ok(
    result.auditTrail.some(e => e.field === "calculatedBy" && e.note?.includes("test-suite")),
    "calculatedBy audit satırı bulunmalı"
  );

  // calcVersion dolu olmalı
  assert.ok(result.calcVersion.length > 0, "calcVersion boş olmamalı");
  assert.ok(result.calculatedAt.length > 0, "calculatedAt boş olmamalı");
});
