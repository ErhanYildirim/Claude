// CBAM Actual Emissions — veri modeli
// EU 2023/1773 Ek-IV Method A
//
// Voltfox kapsam notu:
//   Scope 1 (yakıt + proses emisyonları) → müşterinin kendi hesabı, Voltfox passthrough alır
//   Scope 2 (dolaylı emisyonlar) → Voltfox değeri: saatlik yenilenebilir eşleştirmeyle EF düşürme

export type Sector = "steel" | "aluminium" | "cement" | "fertilizer" | "electricity";

export type EFSource =
  | "voltfox_gec_hourly"   // Granular Emission Calculation — saatlik granüler
  | "country_annual_avg"   // Ülke yıllık ortalama — düşük hassasiyet
  | "user_provided"        // Kullanıcı manuel girdi
  | "cbam_annex4_default"; // CBAM Ek-IV default değeri

export type DataQuality = "measured" | "estimated" | "calculated" | "default";

// ── Scope 1 yakıt tipi ────────────────────────────────────────────────────
// IPCC 2006 Guidelines, Volume 2, Table 1.4 fuel categories
export type FuelType =
  | "natural_gas"
  | "hard_coal"
  | "lignite"
  | "diesel"
  | "heavy_fuel_oil"
  | "lpg"
  | "coke"
  | "wood_biomass"  // biogenic — GHG Protocol'e göre Scope 1'den hariç
  | "other";

export interface FuelEntry {
  fuelType: FuelType;
  consumedMwh: number;                    // LHV bazlı enerji içeriği (EN 16258)
  emissionFactorOverride?: number;        // tCO₂/MWh — girilmezse IPCC 2006 tablosu
  note?: string;
}

export interface AuditEntry {
  field: string;
  source: EFSource | "user_input" | "cbam_annex4";
  value: number;
  unit: string;
  timestamp: string; // ISO 8601
  calcEngineVersion: string;
  note?: string;
}

// ── Satın alınan elektrik (Scope 2) — Voltfox'un hesap alanı ─────────────
//
// Voltfox değer mekanizması:
//   Saatlik yenilenebilir eşleştirme oranı (matchingRatePct) arttıkça
//   efektif grid EF düşer → Scope 2 emisyonu azalır → SEE azalır → CBAM maliyeti azalır.
//
//   effectiveEf = matchingRatePct/100 × renewableEf + (1 - matchingRatePct/100) × baselineEf
export interface PurchasedElectricityInput {
  consumedKwh: number;

  // Voltfox 24/7 CFE eşleştirme parametreleri
  matchingRatePct: number;   // 0–100: saatlik yenilenebilir eşleşme yüzdesi
  renewableEf: number;       // tCO₂/MWh — yenilenebilir kaynakların EF'i (artık/residual)
  gecDataVersion?: string;   // GEC veri versiyonu, örn: "GEC-2026Q1-TR"

  // Baseline: eşleştirme yapılmadan grid ortalaması
  baselineEf: number;        // tCO₂/MWh — country_annual_avg veya user_provided
  baselineEfSource: EFSource;
  baselineEfVersion?: string;

  dataQuality: DataQuality;
}

// ── Raporlama dönemi ─────────────────────────────────────────────────────
export interface ReportingPeriod {
  id: string;
  label: string;    // "Q1 2026", "2025 Annual"
  startDate: string;
  endDate: string;
  productionVolumeTonnes: number;

  // Scope 1: müşteri kendi hesabını yapıp toplamı verir — Voltfox sadece alır
  scope1DirectTco2: number;       // tCO₂ — müşteri tarafından sağlanan
  scope1DataQuality: DataQuality;
  scope1AuditNote?: string;       // kaynak açıklaması (ör: "ERP sistemi Q1 raporu")
  fuelBreakdown?: FuelEntry[];    // v1.1 — girilirse scope1DirectTco2 bu listeden hesaplanır

  // Scope 2: Voltfox hesaplar
  scope2Exempt?: boolean;         // CBAM geçiş dönemi Ek-IV Md.4(2) muafiyeti
  purchasedElectricity: PurchasedElectricityInput;
}

// ── Tesis ────────────────────────────────────────────────────────────────
export interface Installation {
  id: string;
  tenantId: string; // zorunlu — tenant isolation
  name: string;
  country: string;  // ISO 3166-1 alpha-2
  sector: Sector;
  cnCode: string;
  periods: ReportingPeriod[];
}

// ── Scope 2 hesap çıktısı ────────────────────────────────────────────────
export interface Scope2Result {
  // Efektif değerler (eşleşme oranı uygulanmış)
  voltfoxTco2: number;    // tCO₂ — effectiveEf × consumedMwh
  voltfoxEf: number;      // tCO₂/MWh — efektif EF

  // Baseline (0% eşleşme — Voltfox olmadan)
  baselineTco2: number;
  baselineEf: number;
  baselineEfSource: EFSource;

  // Eşleşme metrikleri
  matchingRatePct: number;  // 0–100
  reductionTco2: number;    // baseline - effective
  reductionPct: number;     // % azaltım

  consumedKwh: number;
  auditTrail: AuditEntry[];
}

// ── SEE hesap çıktısı ────────────────────────────────────────────────────
export interface SEEResult {
  // Scope 1: passthrough (müşteri verisi)
  scope1DirectTco2: number;
  scope1DataQuality: DataQuality;

  // Scope 2: Voltfox hesabı
  scope2: Scope2Result;

  // SEE — iki senaryo
  seeBaseline: number;         // tCO₂e/tonne (GEC olmadan — country avg EF)
  seeVoltfox: number | null;   // tCO₂e/tonne (Voltfox GEC ile) — null: GEC müşterisi değil

  unit: "tCO2e/tonne";
  productionVolumeTonnes: number;
  calcEngineVersion: string;
  calculatedAt: string;
  auditTrail: AuditEntry[];
  warnings: string[];
}
