// Scope 1 yakıt bazlı emisyon hesaplama
// Referans: IPCC 2006 Guidelines, Volume 2, Table 1.4
// Birim dönüşümü: tCO₂/TJ × 0.0036 = tCO₂/MWh (LHV bazlı, EN 16258)
// GHG Protocol: biyokütle biogenic CO₂ Scope 1'den hariç tutulur

import type { FuelType, FuelEntry, AuditEntry } from "./types.js";

// IPCC 2006 kaynaklı varsayılan emisyon faktörleri (tCO₂/MWh, LHV)
export const FUEL_EF_TCO2_PER_MWH: Record<FuelType, number> = {
  natural_gas:    0.202,  // 56.1 tCO₂/TJ → × 0.0036
  hard_coal:      0.341,  // 94.6 tCO₂/TJ
  lignite:        0.361,  // 100.3 tCO₂/TJ
  diesel:         0.266,  // 73.9 tCO₂/TJ
  heavy_fuel_oil: 0.282,  // 78.2 tCO₂/TJ
  lpg:            0.227,  // 63.1 tCO₂/TJ
  coke:           0.386,  // 107.2 tCO₂/TJ
  wood_biomass:   0.0,    // biogenic — GHG Protocol Scope 1'den hariç
  other:          0.250,  // muhafazakâr tahmini değer
};

export const FUEL_EF_SOURCE = "IPCC 2006 GL Vol.2 Table 1.4 / EN 16258 LHV";
export const FUEL_EF_VERSION = "IPCC2006-v1";

export interface Scope1BreakdownResult {
  totalTco2: number;
  lines: Array<{
    fuelType: FuelType;
    consumedMwh: number;
    efUsed: number;           // tCO₂/MWh
    efSource: string;
    tco2: number;
    biogenic: boolean;
  }>;
  auditTrail: AuditEntry[];
  warnings: string[];
}

export function calculateScope1FromFuelBreakdown(
  entries: FuelEntry[],
  calcEngineVersion: string,
  now: string,
): Scope1BreakdownResult {
  const warnings: string[] = [];
  const lines: Scope1BreakdownResult["lines"] = [];
  const auditTrail: AuditEntry[] = [];

  let totalTco2 = 0;

  for (const entry of entries) {
    if (entry.consumedMwh < 0) {
      warnings.push(`${entry.fuelType}: negatif tüketim değeri yoksayıldı.`);
      continue;
    }

    const efUsed = entry.emissionFactorOverride ?? FUEL_EF_TCO2_PER_MWH[entry.fuelType];
    const efSource = entry.emissionFactorOverride
      ? "user_provided"
      : FUEL_EF_SOURCE;
    const isBiogenic = entry.fuelType === "wood_biomass";
    const tco2 = entry.consumedMwh * efUsed;

    if (isBiogenic && entry.consumedMwh > 0) {
      warnings.push(
        "Biyokütle (wood_biomass) biogenic CO₂ emisyonları GHG Protocol kapsamında " +
        "Scope 1 hesabına dahil edilmemiştir. Ayrı raporlama gerekebilir.",
      );
    }

    lines.push({ fuelType: entry.fuelType, consumedMwh: entry.consumedMwh, efUsed, efSource, tco2, biogenic: isBiogenic });
    totalTco2 += tco2;

    auditTrail.push({
      field: `scope1.fuel.${entry.fuelType}`,
      source: entry.emissionFactorOverride ? "user_provided" : "cbam_annex4_default",
      value: tco2,
      unit: "tCO₂",
      timestamp: now,
      calcEngineVersion,
      note: `${entry.consumedMwh} MWh × ${efUsed} tCO₂/MWh = ${tco2.toFixed(4)} tCO₂` +
            (entry.note ? ` (${entry.note})` : "") +
            (isBiogenic ? " [biogenic — hariç]" : ""),
    });
  }

  return { totalTco2, lines, auditTrail, warnings };
}
