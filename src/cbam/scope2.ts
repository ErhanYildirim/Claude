// Scope 2 — Dolaylı emisyon hesaplama motoru
// Voltfox değeri: saatlik yenilenebilir eşleştirme oranı (0–100%) ile efektif EF hesabı
//
// effectiveEf = (matchRate × renewableEf) + ((1 − matchRate) × baselineEf)
// IndirectEmissions = consumedMwh × effectiveEf

import type { PurchasedElectricityInput, Scope2Result, AuditEntry } from "./types.js";

const CALC_ENGINE_VERSION = "1.0.0";

export function calculateScope2(
  electricity: PurchasedElectricityInput,
  timestamp?: string,
): Scope2Result {
  const now = timestamp ?? new Date().toISOString();

  if (electricity.consumedKwh < 0) throw new Error("Elektrik tüketimi negatif olamaz.");
  if (electricity.matchingRatePct < 0 || electricity.matchingRatePct > 100) {
    throw new Error("Eşleşme oranı 0–100 arasında olmalı.");
  }

  const consumedMwh = electricity.consumedKwh / 1000;
  const matchRate   = electricity.matchingRatePct / 100;

  // Efektif EF: eşleşen kısım renewableEf, eşleşmeyen kısım baselineEf
  const effectiveEf    = matchRate * electricity.renewableEf + (1 - matchRate) * electricity.baselineEf;
  const effectiveTco2  = consumedMwh * effectiveEf;

  // Baseline (0% eşleşme — Voltfox olmadan)
  const baselineTco2   = consumedMwh * electricity.baselineEf;

  // Azaltım
  const reductionTco2  = baselineTco2 - effectiveTco2;
  const reductionPct   = baselineTco2 > 0 ? (reductionTco2 / baselineTco2) * 100 : 0;

  const auditTrail: AuditEntry[] = [
    {
      field: "scope2.electricity_consumed_mwh",
      source: "user_input",
      value: consumedMwh,
      unit: "MWh",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
    },
    {
      field: "scope2.baseline_ef",
      source: electricity.baselineEfSource,
      value: electricity.baselineEf,
      unit: "tCO₂/MWh",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
      note: electricity.baselineEfVersion ?? undefined,
    },
    {
      field: "scope2.baseline_tco2",
      source: electricity.baselineEfSource,
      value: baselineTco2,
      unit: "tCO₂",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
      note: `${consumedMwh.toFixed(2)} MWh × ${electricity.baselineEf} (0% eşleşme)`,
    },
    {
      field: "scope2.matching_rate_pct",
      source: "voltfox_gec_hourly",
      value: electricity.matchingRatePct,
      unit: "%",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
      note: electricity.gecDataVersion ?? undefined,
    },
    {
      field: "scope2.renewable_ef",
      source: "voltfox_gec_hourly",
      value: electricity.renewableEf,
      unit: "tCO₂/MWh",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
    },
    {
      field: "scope2.effective_ef",
      source: "voltfox_gec_hourly",
      value: effectiveEf,
      unit: "tCO₂/MWh",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
      note: `${electricity.matchingRatePct}% × ${electricity.renewableEf} + ${(100 - electricity.matchingRatePct)}% × ${electricity.baselineEf}`,
    },
    {
      field: "scope2.effective_tco2",
      source: "voltfox_gec_hourly",
      value: effectiveTco2,
      unit: "tCO₂",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
      note: `azaltım: ${reductionTco2.toFixed(2)} tCO₂ (%${reductionPct.toFixed(1)})`,
    },
  ];

  return {
    // voltfoxTco2 → effectiveTco2 olarak yeniden adlandırıldı (matching rate bazlı)
    voltfoxTco2: effectiveTco2,
    voltfoxEf: effectiveEf,
    baselineTco2,
    baselineEf: electricity.baselineEf,
    baselineEfSource: electricity.baselineEfSource,
    consumedKwh: electricity.consumedKwh,
    auditTrail,
    // Ek alanlar
    matchingRatePct: electricity.matchingRatePct,
    reductionTco2,
    reductionPct,
  };
}
