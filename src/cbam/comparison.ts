// Default vs. actual karşılaştırma motoru + Euro tasarruf hesabı
// PRD F-06 / US-3

import type { SEEResult } from "./types.js";

export interface DefaultValues {
  cnCode: string;
  country: string;
  directDefault: number | null;   // tCO₂e/tonne
  indirectDefault: number | null;
  totalDefault: number;           // tCO₂e/tonne
  dataVersion: string;
}

export interface ComparisonResult {
  // Değerler
  actualSee: number;        // tCO₂e/tonne (hesaplanan)
  defaultSee: number;       // tCO₂e/tonne (AB default)
  differenceAbs: number;    // default - actual (pozitif = actual daha iyi)
  differencePercent: number; // % fark

  // Finansal analiz
  productionVolumeTonnes: number;
  carbonPriceEur: number;         // €/tCO₂ (EU ETS)
  totalActualTco2: number;
  totalDefaultTco2: number;
  annualSavingsEur: number;       // yıllık tasarruf

  // Bağlam
  cnCode: string;
  country: string;
  defaultDataVersion: string;
  comparedAt: string;
  recommendation: string;
}

export function compareWithDefault(
  seeResult: SEEResult,
  defaults: DefaultValues,
  carbonPriceEur: number,         // EU ETS spot fiyatı
): ComparisonResult {
  if (carbonPriceEur <= 0) {
    throw new Error("Karbon fiyatı pozitif olmalı.");
  }

  const actualSee = seeResult.seeVoltfox ?? seeResult.seeBaseline;
  const defaultSee = defaults.totalDefault;
  const differenceAbs = defaultSee - actualSee;
  const differencePercent = (differenceAbs / defaultSee) * 100;

  const vol = seeResult.productionVolumeTonnes;
  const totalActualTco2 = actualSee * vol;
  const totalDefaultTco2 = defaultSee * vol;
  const annualSavingsEur = (totalDefaultTco2 - totalActualTco2) * carbonPriceEur;

  let recommendation: string;
  if (differencePercent >= 30) {
    recommendation =
      `Actual değeriniz default'un %${differencePercent.toFixed(0)} altında. ` +
      `Yıllık €${annualSavingsEur.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} tasarruf potansiyeli — ` +
      `AB ithalatçınıza Voltfox teknik dosyasını gönderin.`;
  } else if (differencePercent > 0) {
    recommendation =
      `Actual değeriniz default'tan %${differencePercent.toFixed(1)} düşük. ` +
      `Veri kalitesini artırarak (saatlik EF, ölçüm verisi) tasarrufu büyütebilirsiniz.`;
  } else {
    recommendation =
      `Actual değeriniz default değerden yüksek. ` +
      `Enerji verimliliği veya EF kaynağı gözden geçirilmeli.`;
  }

  return {
    actualSee,
    defaultSee,
    differenceAbs,
    differencePercent,
    productionVolumeTonnes: vol,
    carbonPriceEur,
    totalActualTco2,
    totalDefaultTco2,
    annualSavingsEur,
    cnCode: defaults.cnCode,
    country: defaults.country,
    defaultDataVersion: defaults.dataVersion,
    comparedAt: new Date().toISOString(),
    recommendation,
  };
}

// ISO2 kodu → CBAM defaults tam ülke adı eşlemesi (ef-data.ts'den türetilmiş)
// cbam-defaults.json tam isim key kullanıyor ("Turkey"), API ISO2 gönderiyor ("TR")
const ISO2_TO_NAME: Record<string, string> = {
  AL:"Albania",AM:"Armenia",AT:"Austria",AU:"Australia",AZ:"Azerbaijan",
  BA:"Bosnia and Herzegovina",BD:"Bangladesh",BE:"Belgium",BG:"Bulgaria",
  BR:"Brazil",BY:"Belarus",CA:"Canada",CH:"Switzerland",CN:"China",
  CY:"Cyprus",CZ:"Czech Republic",DE:"Germany",DK:"Denmark",DZ:"Algeria",
  EE:"Estonia",EG:"Egypt",ES:"Spain",FI:"Finland",FR:"France",
  GB:"United Kingdom",GE:"Georgia",GH:"Ghana",GR:"Greece",HR:"Croatia",
  HU:"Hungary",ID:"Indonesia",IE:"Ireland",IN:"India",IQ:"Iraq",
  IR:"Iran",IT:"Italy",JP:"Japan",KR:"South Korea",KZ:"Kazakhstan",
  LT:"Lithuania",LU:"Luxembourg",LV:"Latvia",LY:"Libya",MA:"Morocco",
  MD:"Moldova",ME:"Montenegro",MK:"North Macedonia",MT:"Malta",
  MX:"Mexico",NG:"Nigeria",NL:"Netherlands",NO:"Norway",PK:"Pakistan",
  PL:"Poland",PT:"Portugal",RO:"Romania",RS:"Serbia",RU:"Russia",
  SA:"Saudi Arabia",SE:"Sweden",SI:"Slovenia",SK:"Slovakia",
  TH:"Thailand",TN:"Tunisia",TR:"Turkey",UA:"Ukraine",
  AE:"United Arab Emirates",US:"United States",UZ:"Uzbekistan",
  VN:"Vietnam",ZA:"South Africa",AR:"Argentina",
};

// cbam-defaults.js'den belirli ülke + CN kodu için default değeri çek
// country: ISO2 kodu ("TR") veya tam isim ("Turkey") kabul eder
export function lookupDefault(
  cbamData: {
    meta?: { version?: string };
    countries: Record<string, Array<[string, number | null, number | null, number, number, number, number]>>;
  },
  country: string,
  cnCode: string,
): DefaultValues | null {
  // Önce doğrudan dene (tam isim geldiyse)
  let rows = cbamData.countries[country];

  // Bulunamazsa ISO2 → tam isim çevirisi dene
  if (!rows && country.length === 2) {
    const fullName = ISO2_TO_NAME[country.toUpperCase()];
    if (fullName) rows = cbamData.countries[fullName];
  }

  if (!rows) return null;

  const row = rows.find((r) => r[0] === cnCode);
  if (!row) return null;

  return {
    cnCode,
    country,
    directDefault: row[1],
    indirectDefault: row[2],
    totalDefault: row[3],
    dataVersion: cbamData.meta?.version ?? "2026-02-04",
  };
}
