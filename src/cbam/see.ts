// SEE (Specific Embedded Emission) hesaplama motoru
// EU 2023/1773 Ek-IV Method A
// SEE = (Scope1_müşteri_verisi + Scope2_Voltfox) / ProductionVolume
//
// Voltfox değeri: Scope 2 EF'ini saatlik GEC eşleştirmesiyle düşürerek SEE'yi azaltmak

import type { ReportingPeriod, SEEResult } from "./types.js";
import { calculateScope2 } from "./scope2.js";
import { calculateScope1FromFuelBreakdown } from "./scope1.js";

const CALC_ENGINE_VERSION = "1.0.0";

export function calculateSEE(period: ReportingPeriod): SEEResult {
  if (period.productionVolumeTonnes <= 0) {
    throw new Error(`Üretim hacmi sıfır veya negatif olamaz. Dönem: ${period.label}`);
  }
  if (period.scope1DirectTco2 < 0) {
    throw new Error("Scope 1 emisyonu negatif olamaz.");
  }

  const now = new Date().toISOString();
  const warnings: string[] = [];

  // scope2Exempt=true: bu CN kodu geçiş döneminde dolaylı emisyondan muaf
  // CBAM Ek-IV: muaf CN kodlarında IndirectEmissions = 0 olarak raporlanır
  const scope2Exempt = period.scope2Exempt ?? false;

  // Scope 1: yakıt breakdown verilmişse hesapla, yoksa müşteri toplamını kullan
  let scope1Tco2 = period.scope1DirectTco2;
  if (period.fuelBreakdown && period.fuelBreakdown.length > 0) {
    const s1 = calculateScope1FromFuelBreakdown(period.fuelBreakdown, CALC_ENGINE_VERSION, now);
    scope1Tco2 = s1.totalTco2;
    warnings.push(...s1.warnings);
    // audit trail entries are merged below
  }

  const scope2 = calculateScope2(period.purchasedElectricity, now);

  let scope2BaselineTco2 = scope2.baselineTco2;
  let scope2VoltfoxTco2  = scope2.voltfoxTco2;

  if (scope2Exempt) {
    scope2BaselineTco2 = 0;
    scope2VoltfoxTco2  = 0;
    warnings.push(
      "Bu CN kodu CBAM geçiş döneminde (2026–2028) Scope 2'den muaf tutulmuştur. " +
      "Dolaylı emisyon = 0 olarak raporlanmıştır (Ek-IV, Madde 4(2)).",
    );
  }

  // SEE baseline: Scope 1 + Scope 2 baseline (GEC olmadan)
  const totalBaseline = scope1Tco2 + scope2BaselineTco2;
  const seeBaseline = totalBaseline / period.productionVolumeTonnes;

  // SEE Voltfox: Scope 1 + Scope 2 Voltfox GEC (saatlik eşleşme)
  let seeVoltfox: number | null = null;
  if (scope2.voltfoxTco2 !== null) {
    const totalVoltfox = scope1Tco2 + scope2VoltfoxTco2;
    seeVoltfox = totalVoltfox / period.productionVolumeTonnes;
  } else {
    warnings.push(
      "Voltfox GEC saatlik eşleştirme verisi yok. " +
      "Baseline olarak ülke yıllık ortalama EF kullanıldı. " +
      "GEC entegrasyonuyla daha düşük SEE elde edebilirsiniz.",
    );
  }

  if (period.scope1DataQuality === "estimated") {
    warnings.push(
      "Scope 1 verisi 'tahmini' kalitesinde. " +
      "Audit için ölçüm bazlı veriyle değiştirmeniz önerilir.",
    );
  }

  // Scope 1 audit trail: fuel breakdown varsa breakdown satırları, yoksa passthrough
  const scope1AuditEntries = period.fuelBreakdown && period.fuelBreakdown.length > 0
    ? calculateScope1FromFuelBreakdown(period.fuelBreakdown, CALC_ENGINE_VERSION, now).auditTrail
    : [{
        field: "scope1.direct_tco2",
        source: "user_input" as const,
        value: scope1Tco2,
        unit: "tCO₂",
        timestamp: now,
        calcEngineVersion: CALC_ENGINE_VERSION,
        note: period.scope1AuditNote ?? "Müşteri tarafından sağlandı",
      }];

  const auditTrail = [
    ...scope1AuditEntries,
    ...scope2.auditTrail,
    ...(scope2Exempt ? [{
      field: "scope2.exempt_override",
      source: "cbam_annex4" as const,
      value: 0,
      unit: "tCO₂",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
      note: "CN kodu geçiş döneminde Scope 2 muafiyeti uygulandı (Ek-IV Md.4(2))",
    }] : []),
    {
      field: "see.baseline",
      source: "user_input" as const,
      value: seeBaseline,
      unit: "tCO₂e/tonne",
      timestamp: now,
      calcEngineVersion: CALC_ENGINE_VERSION,
      note: `(${scope1Tco2.toFixed(4)} + ${scope2BaselineTco2.toFixed(4)}) / ${period.productionVolumeTonnes}`,
    },
    ...(seeVoltfox !== null
      ? [{
          field: "see.voltfox_gec",
          source: "voltfox_gec_hourly" as const,
          value: seeVoltfox,
          unit: "tCO₂e/tonne",
          timestamp: now,
          calcEngineVersion: CALC_ENGINE_VERSION,
          note: `GEC eşleştirmesiyle Scope 2 EF: ${scope2.voltfoxEf} tCO₂/MWh`,
        }]
      : []),
  ];

  // scope2Exempt durumunda dış dünyaya dönen scope2 objesini de sıfırlanmış değerlerle sun
  const scope2Out = scope2Exempt
    ? { ...scope2, baselineTco2: 0, voltfoxTco2: 0, reductionTco2: 0, reductionPct: 0 }
    : scope2;

  return {
    scope1DirectTco2: scope1Tco2,
    scope1DataQuality: period.scope1DataQuality,
    scope2: scope2Out,
    seeBaseline,
    seeVoltfox,
    unit: "tCO2e/tonne",
    productionVolumeTonnes: period.productionVolumeTonnes,
    calcEngineVersion: CALC_ENGINE_VERSION,
    calculatedAt: now,
    auditTrail,
    warnings,
  };
}
