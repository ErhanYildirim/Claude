// Grid Emission Factor (EF) veri tablosu
// Kaynak: IEA Electricity 2024, AIE CO₂ Emissions from Fuel Combustion, Eurostat 2023
// Birim: tCO₂/MWh (yıllık ortalama, location-based)
// Güncelleme sıklığı: yıllık (veri versiyonu: YYYY-MM şeklinde)
//
// CBAM Ek-IV Method A kapsamında:
//   Scope 2 baseline EF = ülkenin yıllık ortalama grid EF'i (GEC yokken)
//   GEC bağlantısı varsa: effectiveEf = matchRate × renewableEf + (1 - matchRate) × baselineEf

export interface GridEFEntry {
  iso2:        string;   // ISO 3166-1 alpha-2
  name:        string;   // İngilizce ülke adı (cbam-defaults.json ile uyumlu)
  ef:          number;   // tCO₂/MWh
  source:      string;   // IEA, Eurostat, national TSO, vb.
  year:        number;   // Referans yılı
  notes?:      string;
}

export const EF_DATA_VERSION = "2024-IEA";

export const GRID_EF_TABLE: GridEFEntry[] = [
  // ── Avrupa Birliği ───────────────────────────────────────────────────────────
  { iso2: "DE", name: "Germany",            ef: 0.380, source: "Umweltbundesamt 2023",  year: 2023 },
  { iso2: "FR", name: "France",             ef: 0.052, source: "RTE France 2023",       year: 2023, notes: "Nükleer ağırlıklı" },
  { iso2: "PL", name: "Poland",             ef: 0.720, source: "IEA 2023",              year: 2023, notes: "Kömür ağırlıklı" },
  { iso2: "IT", name: "Italy",              ef: 0.290, source: "Terna 2023",            year: 2023 },
  { iso2: "ES", name: "Spain",              ef: 0.190, source: "REE 2023",              year: 2023 },
  { iso2: "NL", name: "Netherlands",        ef: 0.370, source: "CBS/IEA 2023",          year: 2023 },
  { iso2: "BE", name: "Belgium",            ef: 0.150, source: "Elia 2023",             year: 2023 },
  { iso2: "AT", name: "Austria",            ef: 0.130, source: "E-Control 2023",        year: 2023, notes: "Hidro ağırlıklı" },
  { iso2: "SE", name: "Sweden",             ef: 0.013, source: "Energimyndigheten 2023",year: 2023, notes: "Nükleer + hidro" },
  { iso2: "FI", name: "Finland",            ef: 0.090, source: "Fingrid 2023",          year: 2023 },
  { iso2: "DK", name: "Denmark",            ef: 0.140, source: "Energinet 2023",        year: 2023, notes: "Rüzgar ağırlıklı" },
  { iso2: "PT", name: "Portugal",           ef: 0.190, source: "REN 2023",              year: 2023 },
  { iso2: "CZ", name: "Czech Republic",     ef: 0.450, source: "IEA 2023",              year: 2023 },
  { iso2: "HU", name: "Hungary",            ef: 0.230, source: "MAVIR 2023",            year: 2023 },
  { iso2: "RO", name: "Romania",            ef: 0.250, source: "Transelectrica 2023",   year: 2023 },
  { iso2: "SK", name: "Slovakia",           ef: 0.150, source: "IEA 2023",              year: 2023 },
  { iso2: "BG", name: "Bulgaria",           ef: 0.440, source: "IEA 2023",              year: 2023 },
  { iso2: "HR", name: "Croatia",            ef: 0.190, source: "HOPS 2023",             year: 2023 },
  { iso2: "GR", name: "Greece",             ef: 0.380, source: "ADMIE 2023",            year: 2023 },
  { iso2: "IE", name: "Ireland",            ef: 0.350, source: "EirGrid 2023",          year: 2023 },
  { iso2: "LT", name: "Lithuania",          ef: 0.230, source: "Litgrid 2023",          year: 2023 },
  { iso2: "LV", name: "Latvia",             ef: 0.100, source: "AST 2023",              year: 2023, notes: "Hidro + doğalgaz" },
  { iso2: "EE", name: "Estonia",            ef: 0.480, source: "Elering 2023",          year: 2023 },
  { iso2: "SI", name: "Slovenia",           ef: 0.230, source: "ELES 2023",             year: 2023 },
  { iso2: "LU", name: "Luxembourg",         ef: 0.110, source: "IEA 2023",              year: 2023 },
  { iso2: "MT", name: "Malta",              ef: 0.490, source: "IEA 2023",              year: 2023 },
  { iso2: "CY", name: "Cyprus",             ef: 0.620, source: "IEA 2023",              year: 2023, notes: "Ada, izole şebeke" },

  // ── Avrupa (AB dışı) ─────────────────────────────────────────────────────────
  { iso2: "GB", name: "United Kingdom",     ef: 0.235, source: "DESNZ/OFGEM 2023",     year: 2023 },
  { iso2: "NO", name: "Norway",             ef: 0.012, source: "NVE 2023",              year: 2023, notes: "Neredeyse tüm hidro" },
  { iso2: "CH", name: "Switzerland",        ef: 0.030, source: "BAFU 2023",             year: 2023, notes: "Nükleer + hidro" },
  { iso2: "TR", name: "Turkey",             ef: 0.474, source: "TEİAŞ 2023",            year: 2023 },
  { iso2: "UA", name: "Ukraine",            ef: 0.270, source: "Ukrenergo 2023",        year: 2023 },
  { iso2: "RS", name: "Serbia",             ef: 0.690, source: "IEA 2023",              year: 2023, notes: "Linyit ağırlıklı" },
  { iso2: "BA", name: "Bosnia and Herzegovina", ef: 0.720, source: "IEA 2023",          year: 2023 },
  { iso2: "ME", name: "Montenegro",         ef: 0.440, source: "IEA 2023",              year: 2023 },
  { iso2: "MK", name: "North Macedonia",    ef: 0.680, source: "IEA 2023",              year: 2023 },
  { iso2: "AL", name: "Albania",            ef: 0.030, source: "IEA 2023",              year: 2023, notes: "Neredeyse tüm hidro" },
  { iso2: "MD", name: "Moldova",            ef: 0.620, source: "IEA 2023",              year: 2023 },
  { iso2: "BY", name: "Belarus",            ef: 0.260, source: "IEA 2023",              year: 2023 },
  { iso2: "RU", name: "Russia",             ef: 0.330, source: "IEA 2023",              year: 2023 },
  { iso2: "GE", name: "Georgia",            ef: 0.090, source: "IEA 2023",              year: 2023, notes: "Hidro ağırlıklı" },
  { iso2: "AM", name: "Armenia",            ef: 0.200, source: "IEA 2023",              year: 2023 },
  { iso2: "AZ", name: "Azerbaijan",         ef: 0.430, source: "IEA 2023",              year: 2023 },

  // ── Orta Doğu & Kuzey Afrika ─────────────────────────────────────────────────
  { iso2: "SA", name: "Saudi Arabia",       ef: 0.540, source: "IEA 2023",              year: 2023 },
  { iso2: "AE", name: "United Arab Emirates", ef: 0.380, source: "IEA 2023",            year: 2023 },
  { iso2: "EG", name: "Egypt",              ef: 0.450, source: "IEA 2023",              year: 2023 },
  { iso2: "MA", name: "Morocco",            ef: 0.640, source: "IEA 2023",              year: 2023 },
  { iso2: "DZ", name: "Algeria",            ef: 0.450, source: "IEA 2023",              year: 2023 },
  { iso2: "TN", name: "Tunisia",            ef: 0.440, source: "IEA 2023",              year: 2023 },
  { iso2: "LY", name: "Libya",              ef: 0.560, source: "IEA 2023",              year: 2023 },
  { iso2: "IR", name: "Iran",               ef: 0.540, source: "IEA 2023",              year: 2023 },
  { iso2: "IQ", name: "Iraq",               ef: 0.590, source: "IEA 2023",              year: 2023 },

  // ── Asya-Pasifik ─────────────────────────────────────────────────────────────
  { iso2: "CN", name: "China",              ef: 0.570, source: "CEA 2023",              year: 2023 },
  { iso2: "IN", name: "India",              ef: 0.700, source: "CEA India 2023",        year: 2023, notes: "Kömür ağırlıklı" },
  { iso2: "JP", name: "Japan",              ef: 0.470, source: "METI 2023",             year: 2023 },
  { iso2: "KR", name: "South Korea",        ef: 0.440, source: "KEPCO 2023",            year: 2023 },
  { iso2: "AU", name: "Australia",          ef: 0.480, source: "AEMO 2023",             year: 2023 },
  { iso2: "ID", name: "Indonesia",          ef: 0.760, source: "IEA 2023",              year: 2023 },
  { iso2: "VN", name: "Vietnam",            ef: 0.510, source: "IEA 2023",              year: 2023 },
  { iso2: "TH", name: "Thailand",           ef: 0.490, source: "IEA 2023",              year: 2023 },
  { iso2: "PK", name: "Pakistan",           ef: 0.390, source: "IEA 2023",              year: 2023 },
  { iso2: "BD", name: "Bangladesh",         ef: 0.690, source: "IEA 2023",              year: 2023 },
  { iso2: "KZ", name: "Kazakhstan",         ef: 0.720, source: "IEA 2023",              year: 2023, notes: "Kömür ağırlıklı" },
  { iso2: "UZ", name: "Uzbekistan",         ef: 0.560, source: "IEA 2023",              year: 2023 },

  // ── Amerika ───────────────────────────────────────────────────────────────────
  { iso2: "US", name: "United States",      ef: 0.380, source: "EPA eGRID 2023",        year: 2023 },
  { iso2: "CA", name: "Canada",             ef: 0.130, source: "ECCC 2023",             year: 2023, notes: "Hidro + nükleer ağırlıklı" },
  { iso2: "MX", name: "Mexico",             ef: 0.430, source: "IEA 2023",              year: 2023 },
  { iso2: "BR", name: "Brazil",             ef: 0.060, source: "ONS 2023",              year: 2023, notes: "Neredeyse tüm hidro" },
  { iso2: "AR", name: "Argentina",          ef: 0.310, source: "IEA 2023",              year: 2023 },

  // ── Afrika (CBAM kapsamındaki ihracatçı ülkeler) ──────────────────────────────
  { iso2: "ZA", name: "South Africa",       ef: 0.870, source: "IEA 2023",              year: 2023, notes: "Kömür ağırlıklı" },
  { iso2: "NG", name: "Nigeria",            ef: 0.430, source: "IEA 2023",              year: 2023 },
  { iso2: "GH", name: "Ghana",              ef: 0.300, source: "IEA 2023",              year: 2023 },
];

// ISO2 → entry map (hızlı lookup)
const byISO2 = new Map<string, GridEFEntry>(
  GRID_EF_TABLE.map(e => [e.iso2.toUpperCase(), e])
);

// Tam ülke adı → entry map (cbam-defaults.json uyumu)
const byName = new Map<string, GridEFEntry>(
  GRID_EF_TABLE.map(e => [e.name.toLowerCase(), e])
);

export interface EFLookupResult {
  iso2:       string;
  name:       string;
  ef:         number;          // tCO₂/MWh
  source:     string;
  year:       number;
  dataVersion: string;
  notes?:     string;
}

/**
 * Ülke kodu (ISO2) veya tam ülke adına göre grid EF döndürür.
 * Bulunamazsa null döner — caller, fallback değeri belirler.
 */
export function lookupGridEF(countryOrISO: string): EFLookupResult | null {
  const upper = countryOrISO.toUpperCase();
  const lower  = countryOrISO.toLowerCase();

  const entry = byISO2.get(upper) ?? byName.get(lower) ?? null;
  if (!entry) return null;

  return {
    iso2:        entry.iso2,
    name:        entry.name,
    ef:          entry.ef,
    source:      entry.source,
    year:        entry.year,
    dataVersion: EF_DATA_VERSION,
    notes:       entry.notes,
  };
}

/** Desteklenen tüm ülkeleri döndürür (UI dropdown için). */
export function listSupportedCountries(): Array<{ iso2: string; name: string; ef: number }> {
  return GRID_EF_TABLE
    .map(e => ({ iso2: e.iso2, name: e.name, ef: e.ef }))
    .sort((a, b) => a.name.localeCompare(b.name));
}
