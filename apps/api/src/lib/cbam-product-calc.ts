/**
 * CBAM Ürün Bazlı Gömülü Emisyon Hesaplama Motoru
 *
 * Metodoloji: EU 2023/956 + CBAM Uygulama Yönetmeliği (2023/1773) Ek IV
 *
 * Temel kural:
 *   - Yenilenebilir enerji ile eşleşen kısım → kaynağın yaşam-döngüsü EF'i
 *   - Eşleşmeyen kısım → min(CBAM Annex IV ülke EF, tesis ülkesi yıllık ızgara EF)
 *
 * Enerji dağıtım modları:
 *   - "facility": yenilenebilir üretim tesis geneline aittir; her ürüne tüketim
 *                 payıyla orantılı dağıtılır.
 *   - "band"    : her üretim bandı kendi sayacına sahiptir; doğrudan atanır.
 *
 * Scope 1 entegrasyonu: calculateCbamScope1 motoru scope1Inputs üzerinden çağrılır.
 * Ham scope1DirectTco2 değeri hâlâ kabul edilir (legacy / harici doğrulama durumları).
 */

import { calculateCbamScope1, type Scope1Input } from "./cbam-scope1-calc.js";

// ── Yenilenebilir kaynak EF'leri (tCO₂/MWh) — IPCC AR6 medyan ─────────────
export const RENEWABLE_SOURCE_EF: Record<string, number> = {
  solar:         0.045,
  wind_onshore:  0.011,
  wind_offshore: 0.012,
  hydro:         0.024,
  nuclear:       0.012,
  biomass:       0.230,
  geothermal:    0.038,
};

export const RENEWABLE_SOURCE_LABELS: Record<string, string> = {
  solar:         "Güneş (Solar PV)",
  wind_onshore:  "Rüzgar (Kara)",
  wind_offshore: "Rüzgar (Deniz)",
  hydro:         "Hidroelektrik",
  nuclear:       "Nükleer",
  biomass:       "Biyokütle",
  geothermal:    "Jeotermal",
};

// ── CBAM Annex IV ülke elektrik EF'leri (tCO₂/MWh) ─────────────────────────
// Kaynak: Komisyon Uygulama Tüzüğü (EU) 2023/1773, Ek IV Tablo 2
// Bu değerler CBAM Dolaylı Emisyon bildirimi için resmi düzenleyici referanstır.
// 2026 Q2 itibarıyla resmi bir Ek IV güncelleme tüzüğü yayımlanmamıştır; bu değerler günceldir.
//
// Not: Cbam_hesaplama/cbam-defaults.json ürün bazlı gömülü emisyon varsayılanlarını
// (tCO₂/tonne, CN kodu × ülke) içerir ve elektrik EF tablosuyla karşılaştırılamaz.
// cbam-engine.js GRID_EF_TABLE ulusal TSO 2023 ölçüm verileri içerir ve yalnızca
// GEC/CFE hesaplamalarında kullanılır; CBAM beyan EF'i bu tablo değildir.
export const CBAM_COUNTRY_EF: Record<string, number> = {
  TR: 0.4943,  // Türkiye
  DE: 0.3660,  // Almanya
  FR: 0.0519,  // Fransa (nükleer ağırlıklı)
  NL: 0.3720,
  BE: 0.1620,
  PL: 0.7730,
  CZ: 0.4510,
  SK: 0.1290,
  HU: 0.2390,
  RO: 0.2890,
  BG: 0.5870,
  GR: 0.4580,
  IT: 0.3190,
  ES: 0.1980,
  PT: 0.1950,
  AT: 0.1020,
  CH: 0.0280,
  SE: 0.0180,
  NO: 0.0280,
  FI: 0.1230,
  DK: 0.1550,
  EE: 0.6530,
  LV: 0.1220,
  LT: 0.1950,
  SI: 0.2480,
  HR: 0.1660,
  RS: 0.6830,
  BA: 0.7480,
  ME: 0.5820,
  MK: 0.6910,
  AL: 0.0340,
  UA: 0.2110,
  CN: 0.5810,
  IN: 0.7080,
  US: 0.3860,
  GB: 0.2330,
  AU: 0.6310,
  JP: 0.4670,
  KR: 0.4150,
};

// ── Giriş / Çıkış Tipleri ───────────────────────────────────────────────────
export interface CbamCalcInput {
  energyAllocationMode: "facility" | "band";

  // BAND modu
  bandElectricityKwh?: number;
  bandRenewableKwh?:   number;

  // FACILITY modu
  facilityTotalKwh?:     number;
  facilityRenewableKwh?: number;
  productShareKwh?:      number;  // bu ürünün elektrik tüketim payı

  // Yenilenebilir kaynak
  renewableSource?:   string;
  renewableSourceEf?: number;  // otomatik doldurulur; override için girilir

  // Referans EF'ler (eşleşmeyen kısım için)
  cbamDefaultEf?: number;  // CBAM Annex IV elektrik EF (tCO₂/MWh)
  countryGridEf?: number;  // Ülke yıllık ızgara EF (tCO₂/MWh)

  // Emisyonlar — ya scope1DirectTco2 ya da scope1Inputs girilmeli
  scope1DirectTco2: number;     // doğrudan ham değer (scope1Inputs varsa bu override edilir)
  scope1Inputs?: Scope1Input;   // varsa calculateCbamScope1 ile hesaplanır; audit trail üretilir
  productionVolumeTonne: number;
}

export interface CbamCalcResult {
  allocatedElecKwh:      number;
  allocatedRenewKwh:     number;
  matchedKwh:            number;
  unmatchedKwh:          number;
  renewableSourceEfUsed: number;  // tCO₂/MWh
  matchedIndirectTco2:   number;
  unmatchedEfUsed:       number;  // tCO₂/MWh — min(cbam, country)
  unmatchedEfSource:     "cbam_default" | "country_grid" | "none";
  unmatchedIndirectTco2: number;
  totalIndirectTco2:     number;
  totalEmbeddedTco2:     number;
  see:                   number;  // tCO₂/tonne
  effectiveEf:           number;  // ağırlıklı ortalama tCO₂/MWh
}

// ── Ana Hesaplama ────────────────────────────────────────────────────────────
export function calculateCbamProductEmission(input: CbamCalcInput): CbamCalcResult {
  const {
    energyAllocationMode,
    bandElectricityKwh = 0,
    bandRenewableKwh   = 0,
    facilityTotalKwh     = 0,
    facilityRenewableKwh = 0,
    productShareKwh      = 0,
    renewableSource,
    renewableSourceEf: overrideEf,
    cbamDefaultEf = 0,
    countryGridEf = 0,
    scope1Inputs,
    productionVolumeTonne,
  } = input;

  // Scope 1: motor üzerinden hesapla ya da ham değeri kullan
  const scope1DirectTco2 = scope1Inputs
    ? calculateCbamScope1(scope1Inputs).directTco2
    : input.scope1DirectTco2;

  // 1. Ürüne atanan elektrik ve yenilenebilir miktarını belirle ───────────────
  let allocatedElecKwh: number;
  let allocatedRenewKwh: number;

  if (energyAllocationMode === "band") {
    allocatedElecKwh  = bandElectricityKwh;
    allocatedRenewKwh = bandRenewableKwh;
  } else {
    // Facility: orantılı dağıtım (tüketim payına göre)
    allocatedElecKwh  = productShareKwh;
    allocatedRenewKwh = facilityTotalKwh > 0
      ? (productShareKwh / facilityTotalKwh) * facilityRenewableKwh
      : 0;
  }

  // 2. Eşleşme hesabı ─────────────────────────────────────────────────────────
  const matchedKwh   = Math.min(allocatedElecKwh, allocatedRenewKwh);
  const unmatchedKwh = Math.max(0, allocatedElecKwh - matchedKwh);

  // 3. Yenilenebilir kaynak EF ─────────────────────────────────────────────────
  const renewableSourceEfUsed = overrideEf
    ?? (renewableSource ? (RENEWABLE_SOURCE_EF[renewableSource] ?? 0.045) : 0.045);

  // 4. Eşleşen kısım emisyonu ──────────────────────────────────────────────────
  // kWh → MWh: /1000  |  tCO₂/MWh → tCO₂: × MWh
  const matchedIndirectTco2 = (matchedKwh / 1000) * renewableSourceEfUsed;

  // 5. Eşleşmeyen kısım EF: min(CBAM Annex IV, ülke ızgara) ──────────────────
  let unmatchedEfUsed: number;
  let unmatchedEfSource: "cbam_default" | "country_grid" | "none";

  if (cbamDefaultEf > 0 && countryGridEf > 0) {
    if (cbamDefaultEf <= countryGridEf) {
      unmatchedEfUsed   = cbamDefaultEf;
      unmatchedEfSource = "cbam_default";
    } else {
      unmatchedEfUsed   = countryGridEf;
      unmatchedEfSource = "country_grid";
    }
  } else if (cbamDefaultEf > 0) {
    unmatchedEfUsed   = cbamDefaultEf;
    unmatchedEfSource = "cbam_default";
  } else if (countryGridEf > 0) {
    unmatchedEfUsed   = countryGridEf;
    unmatchedEfSource = "country_grid";
  } else {
    unmatchedEfUsed   = 0;
    unmatchedEfSource = "none";
  }

  // 6. Eşleşmeyen kısım emisyonu ───────────────────────────────────────────────
  const unmatchedIndirectTco2 = (unmatchedKwh / 1000) * unmatchedEfUsed;

  // 7. Toplam gömülü emisyon ve SEE ────────────────────────────────────────────
  const totalIndirectTco2  = matchedIndirectTco2 + unmatchedIndirectTco2;
  const totalEmbeddedTco2  = scope1DirectTco2 + totalIndirectTco2;
  const see = productionVolumeTonne > 0 ? totalEmbeddedTco2 / productionVolumeTonne : 0;

  // 8. Ağırlıklı ortalama efektif EF ──────────────────────────────────────────
  const effectiveEf = allocatedElecKwh > 0
    ? (totalIndirectTco2 / (allocatedElecKwh / 1000))
    : 0;

  return {
    allocatedElecKwh:      round(allocatedElecKwh, 2),
    allocatedRenewKwh:     round(allocatedRenewKwh, 2),
    matchedKwh:            round(matchedKwh, 2),
    unmatchedKwh:          round(unmatchedKwh, 2),
    renewableSourceEfUsed: round(renewableSourceEfUsed, 6),
    matchedIndirectTco2:   round(matchedIndirectTco2, 6),
    unmatchedEfUsed:       round(unmatchedEfUsed, 6),
    unmatchedEfSource,
    unmatchedIndirectTco2: round(unmatchedIndirectTco2, 6),
    totalIndirectTco2:     round(totalIndirectTco2, 6),
    totalEmbeddedTco2:     round(totalEmbeddedTco2, 6),
    see:                   round(see, 8),
    effectiveEf:           round(effectiveEf, 6),
  };
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
