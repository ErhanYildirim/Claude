/**
 * CBAM Scope 1 Doğrudan Emisyon Hesaplama Motoru
 *
 * Metodoloji: EU 2023/1773 Ek-IV Method A (Hesaplama Bazlı)
 * Formül: DirectEmissions = Σ(Fuel_i × NCV_i × EF_i) + ProcessEmissions
 *
 * Yakıt EF kaynağı : IPCC 2006 GL Vol.2 Table 1.4 (tCO₂/GJ, LHV bazlı)
 * Proses EF kaynağı: Stoikiometrik hesap — IPCC 2006 GL Vol.3 Ch.2
 */

export const CALC_ENGINE_VERSION = "scope1/1.0.0";

// ── Standart Yakıt Emisyon Faktörleri (tCO₂/GJ, LHV bazlı) ──────────────────
// Dönüşüm: 1 TJ = 1000 GJ → EF[tCO₂/GJ] = EF[tCO₂/TJ] / 1000
export const FUEL_EF_TCO2_PER_GJ: Record<string, number> = {
  naturalGas: 0.0561,   // 56.1 tCO₂/TJ
  fuelOil:    0.0773,   // 77.4 tCO₂/TJ (ağır fuel oil)
  coal:       0.0946,   // 94.6 tCO₂/TJ (taş kömürü)
  other:      0.0700,   // muhafazakâr tahmini
};

export const FUEL_LABELS: Record<string, string> = {
  naturalGas: "Doğalgaz",
  fuelOil:    "Fuel Oil (Ağır)",
  coal:       "Kömür (Taş)",
  other:      "Diğer Yakıt",
};

// ── Proses Emisyonu Stoikiometrik Faktörler (tCO₂/tonne malzeme) ─────────────
// CaCO₃ : MW=100.09, CO₂ MW=44.01 → 44.01/100.09 = 0.4397
// Dolomit: CaMg(CO₃)₂, MW=184.41, 2×CO₂ → 2×44.01/184.41 = 0.4773
// Demir cevheri: redüksiyondan kaynaklanan CO₂ yakıt olarak ayrıca girilir
export const PROCESS_STOICH: Record<string, number> = {
  CaCO3:    0.4397,
  dolomite: 0.4773,
  iron_ore: 0.0000,
  other:    0.0000,  // kullanıcı stoichFactor değerini zorunlu olarak girmeli
};

export const MATERIAL_LABELS: Record<string, string> = {
  CaCO3:    "Kireçtaşı (CaCO₃)",
  dolomite: "Dolomit",
  iron_ore: "Demir Cevheri",
  other:    "Diğer Hammadde",
};

// ── Giriş Tipleri ─────────────────────────────────────────────────────────────
export interface FuelInput {
  fuelType:      "naturalGas" | "fuelOil" | "coal" | "other";
  quantityGJ:    number;
  ncvGjPerTonne?: number;   // opsiyonel; miktar tonne cinsinden girilmişse
  efTco2PerGj:   number;    // standart tablodan ya da kullanıcı override'ı
}

export interface ProcessEmissionInput {
  material:      "CaCO3" | "dolomite" | "iron_ore" | "other";
  quantityTonne: number;
  stoichFactor:  number;   // tCO₂/tonne malzeme
}

export interface Scope1Input {
  fuels:            FuelInput[];
  processEmissions: ProcessEmissionInput[];
  calculatedBy?:   string;   // audit trail: kullanıcı id veya servis adı
  calcVersion?:    string;   // versiyon override; yoksa CALC_ENGINE_VERSION
}

// ── Çıkış Tipleri ─────────────────────────────────────────────────────────────
export interface Scope1AuditEntry {
  step:   string;
  field:  string;
  value:  number;
  unit:   string;
  source: string;
  note?:  string;
}

export interface Scope1Result {
  directTco2:   number;
  breakdown:    { fuel: number; process: number };
  auditTrail:   Scope1AuditEntry[];
  warnings:     string[];
  calcVersion:  string;
  calculatedAt: string;
}

// ── Ana Hesaplama ─────────────────────────────────────────────────────────────
export function calculateCbamScope1(input: Scope1Input): Scope1Result {
  const version      = input.calcVersion ?? CALC_ENGINE_VERSION;
  const calculatedAt = new Date().toISOString();
  const auditTrail:  Scope1AuditEntry[] = [];
  const warnings:    string[] = [];

  // 1. Yakıt emisyonları ─────────────────────────────────────────────────────
  let fuelTco2 = 0;
  for (const fuel of input.fuels) {
    if (fuel.quantityGJ < 0) {
      warnings.push(`${fuel.fuelType}: negatif miktar (${fuel.quantityGJ} GJ) yoksayıldı.`);
      continue;
    }
    const tco2       = fuel.quantityGJ * fuel.efTco2PerGj;
    const isOverride = fuel.efTco2PerGj !== FUEL_EF_TCO2_PER_GJ[fuel.fuelType];
    fuelTco2 += tco2;

    auditTrail.push({
      step:   "Yakıt Emisyonları",
      field:  `fuel.${fuel.fuelType}`,
      value:  round(tco2, 6),
      unit:   "tCO₂",
      source: isOverride ? "user_provided" : "IPCC_2006_GL_Vol2_Table1.4",
      note:   `${fuel.quantityGJ} GJ × ${fuel.efTco2PerGj} tCO₂/GJ = ${round(tco2, 4)} tCO₂` +
              (fuel.ncvGjPerTonne ? ` | NCV: ${fuel.ncvGjPerTonne} GJ/tonne` : ""),
    });
  }

  // 2. Proses emisyonları ────────────────────────────────────────────────────
  let processTco2 = 0;
  for (const proc of input.processEmissions) {
    if (proc.quantityTonne < 0) {
      warnings.push(`${proc.material}: negatif miktar (${proc.quantityTonne} tonne) yoksayıldı.`);
      continue;
    }
    if (proc.material === "other" && proc.stoichFactor === 0) {
      warnings.push(`${proc.material}: stoichFactor=0 — lütfen doğru faktörü girin.`);
    }
    const tco2       = proc.quantityTonne * proc.stoichFactor;
    const isOverride = proc.stoichFactor !== PROCESS_STOICH[proc.material];
    processTco2 += tco2;

    auditTrail.push({
      step:   "Proses Emisyonları",
      field:  `process.${proc.material}`,
      value:  round(tco2, 6),
      unit:   "tCO₂",
      source: isOverride ? "user_provided" : "IPCC_2006_GL_Vol3_stoichiometric",
      note:   `${proc.quantityTonne} tonne × ${proc.stoichFactor} tCO₂/tonne = ${round(tco2, 4)} tCO₂`,
    });
  }

  // 3. Toplam ────────────────────────────────────────────────────────────────
  const directTco2 = fuelTco2 + processTco2;
  auditTrail.push({
    step:   "Toplam",
    field:  "scope1.directTco2",
    value:  round(directTco2, 6),
    unit:   "tCO₂",
    source: "calculated",
    note:   `Yakıt: ${round(fuelTco2, 4)} + Proses: ${round(processTco2, 4)} = ${round(directTco2, 4)} tCO₂ | v${version}`,
  });

  if (input.calculatedBy) {
    auditTrail.push({
      step:   "Meta",
      field:  "calculatedBy",
      value:  0,
      unit:   "",
      source: "system",
      note:   `${input.calculatedBy} | ${calculatedAt}`,
    });
  }

  return {
    directTco2:   round(directTco2, 6),
    breakdown:    { fuel: round(fuelTco2, 6), process: round(processTco2, 6) },
    auditTrail,
    warnings,
    calcVersion:  version,
    calculatedAt,
  };
}

function round(v: number, decimals: number): number {
  const f = 10 ** decimals;
  return Math.round(v * f) / f;
}
