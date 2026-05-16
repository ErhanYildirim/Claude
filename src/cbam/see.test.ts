// SEE motor test — Türk çelik üreticisi, Q1 2026
// Scope 1: müşteri kendi hesabını sağlıyor (passthrough)
// Scope 2: Voltfox GEC saatlik eşleştirme vs. ülke ortalaması karşılaştırması
import { calculateSEE } from "./see.js";
import type { ReportingPeriod } from "./types.js";

const period: ReportingPeriod = {
  id: "test-period-1",
  label: "Q1 2026",
  startDate: "2026-01-01",
  endDate: "2026-03-31",
  productionVolumeTonnes: 50_000,

  // Scope 1: müşteri ERP/üretim raporundan sağlıyor — Voltfox sadece alıyor
  scope1DirectTco2: 82_959,
  scope1DataQuality: "measured",
  scope1AuditNote: "ERP sistemi Q1 2026 yakıt + proses raporu",

  purchasedElectricity: {
    consumedKwh: 15_000_000, // 15 GWh

    // Voltfox GEC saatlik eşleştirme: %100 eşleşme, renewableEf=0.12
    matchingRatePct: 100,
    renewableEf: 0.12,           // tCO₂/MWh — GEC eşleştirme sonucu
    gecDataVersion: "GEC-2026Q1-TR",

    // Baseline: Türkiye 2024 yıllık ortalaması
    baselineEf: 0.474,
    baselineEfSource: "country_annual_avg",
    baselineEfVersion: "TR_2024_annual",

    dataQuality: "measured",
  },
};

function run() {
  const result = calculateSEE(period);

  console.log("=== SEE HESAP SONUCU ===");
  console.log(`Dönem:             ${period.label}`);
  console.log(`Üretim:            ${period.productionVolumeTonnes.toLocaleString()} tonne`);
  console.log(`Elektrik:          ${(period.purchasedElectricity.consumedKwh / 1e6).toFixed(1)} GWh`);
  console.log("");
  console.log(`Scope 1 (müşteri): ${result.scope1DirectTco2.toLocaleString()} tCO₂ [${result.scope1DataQuality}]`);
  console.log(`Scope 2 baseline:  ${result.scope2.baselineTco2.toFixed(2)} tCO₂  (EF: ${result.scope2.baselineEf} tCO₂/MWh)`);
  if (result.scope2.voltfoxTco2 !== null) {
    console.log(`Scope 2 Voltfox:   ${result.scope2.voltfoxTco2.toFixed(2)} tCO₂  (EF: ${result.scope2.voltfoxEf} tCO₂/MWh)`);
    const s2saving = result.scope2.baselineTco2 - result.scope2.voltfoxTco2;
    console.log(`  → Scope 2 tasarrufu: ${s2saving.toFixed(2)} tCO₂ (%${((s2saving / result.scope2.baselineTco2) * 100).toFixed(1)})`);
  }
  console.log("");
  console.log(`SEE baseline:      ${result.seeBaseline.toFixed(4)} tCO₂e/tonne`);
  if (result.seeVoltfox !== null) {
    const seeSaving = result.seeBaseline - result.seeVoltfox;
    console.log(`SEE Voltfox GEC:   ${result.seeVoltfox.toFixed(4)} tCO₂e/tonne`);
    console.log(`SEE iyileştirme:   -${seeSaving.toFixed(4)} tCO₂e/tonne (%${((seeSaving / result.seeBaseline) * 100).toFixed(1)})`);
  }
  console.log(`Calc engine:       v${result.calcEngineVersion}`);

  if (result.warnings.length > 0) {
    console.log("\n=== UYARILAR ===");
    result.warnings.forEach((w, i) => console.log(`[${i + 1}] ${w}`));
  }

  console.log(`\n=== AUDİT TRAIL (${result.auditTrail.length} kayıt) ===`);
  for (const e of result.auditTrail) {
    console.log(`  ${e.field.padEnd(38)} ${String(e.value.toFixed(4)).padStart(12)} ${e.unit.padEnd(14)} [${e.source}]`);
  }

  // Guard testleri
  try {
    calculateSEE({ ...period, productionVolumeTonnes: 0 });
    console.error("HATA: Sıfır üretim guard çalışmadı!"); process.exit(1);
  } catch (e: unknown) {
    console.log(`\n[Guard OK] Sıfır üretim: ${(e as Error).message}`);
  }

  try {
    calculateSEE({ ...period, scope1DirectTco2: -1 });
    console.error("HATA: Negatif Scope 1 guard çalışmadı!"); process.exit(1);
  } catch (e: unknown) {
    console.log(`[Guard OK] Negatif Scope 1: ${(e as Error).message}`);
  }
}

run();
