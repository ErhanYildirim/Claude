// Paylaşılan ENTSO-E yardımcıları — birden fazla servis tarafından import edilir

export interface EntsoeZone {
  code:    string;
  eicCode: string;
  name:    string;
  country: string;
}

export const ENTSO_ZONES: EntsoeZone[] = [
  { code: "DE",     eicCode: "10Y1001A1001A83F", name: "Germany",         country: "DE" },
  { code: "FR",     eicCode: "10YFR-RTE------C", name: "France",          country: "FR" },
  { code: "NL",     eicCode: "10YNL----------L", name: "Netherlands",     country: "NL" },
  { code: "ES",     eicCode: "10YES-REE------0", name: "Spain",           country: "ES" },
  { code: "AT",     eicCode: "10YAT-APG------L", name: "Austria",         country: "AT" },
  { code: "BE",     eicCode: "10YBE----------2", name: "Belgium",         country: "BE" },
  { code: "TR",     eicCode: "10YTR-TEIAS----W", name: "Turkey",          country: "TR" },
  { code: "PL",     eicCode: "10YPL-AREA-----S", name: "Poland",          country: "PL" },
  { code: "NO",     eicCode: "10YNO-0--------C", name: "Norway",          country: "NO" },
  { code: "SE",     eicCode: "10YSE-1--------K", name: "Sweden",          country: "SE" },
  { code: "FI",     eicCode: "10YFI-1--------U", name: "Finland",         country: "FI" },
  { code: "CH",     eicCode: "10YCH-SWISSGRIDZ", name: "Switzerland",    country: "CH" },
  { code: "CZ",     eicCode: "10YCZ-CEPS-----N", name: "Czech Republic",  country: "CZ" },
  { code: "HU",     eicCode: "10YHU-MAVIR----U", name: "Hungary",         country: "HU" },
  { code: "RO",     eicCode: "10YRO-TEL------P", name: "Romania",         country: "RO" },
  { code: "SK",     eicCode: "10YSK-SEPS-----K", name: "Slovakia",        country: "SK" },
  { code: "SI",     eicCode: "10YSI-ELES-----O", name: "Slovenia",        country: "SI" },
  { code: "HR",     eicCode: "10YHR-HEP------M", name: "Croatia",         country: "HR" },
  { code: "BG",     eicCode: "10YCA-BULGARIA-R", name: "Bulgaria",        country: "BG" },
  { code: "GR",     eicCode: "10YGR-HTSO-----Y", name: "Greece",          country: "GR" },
  { code: "IT",     eicCode: "10YIT-GRTN-----B", name: "Italy",           country: "IT" },
  { code: "PT",     eicCode: "10YPT-REN------W", name: "Portugal",        country: "PT" },
  { code: "DK-DK1", eicCode: "10YDK-1--------W", name: "Denmark West",   country: "DK" },
  { code: "DK-DK2", eicCode: "10YDK-2--------M", name: "Denmark East",   country: "DK" },
  { code: "LT",     eicCode: "10YLT-1001A0008Q", name: "Lithuania",      country: "LT" },
  { code: "LV",     eicCode: "10YLV-1001A00074", name: "Latvia",          country: "LV" },
  { code: "EE",     eicCode: "10Y1001A1001A39I", name: "Estonia",         country: "EE" },
  { code: "RS",     eicCode: "10YCS-SERBIATSOW", name: "Serbia",          country: "RS" },
  { code: "BA",     eicCode: "10YBA-JPCC-----D", name: "Bosnia",          country: "BA" },
  { code: "ME",     eicCode: "10YCS-CG-TSO---S", name: "Montenegro",      country: "ME" },
  { code: "MK",     eicCode: "10YMK-MEPSO----8", name: "North Macedonia", country: "MK" },
  { code: "AL",     eicCode: "10YAL-KESH-----5", name: "Albania",         country: "AL" },
];

export const ZONE_MAP = new Map(ENTSO_ZONES.map(z => [z.code, z]));

/** YYYYMMDDHHMM formatı — ENTSO-E API zorunlu */
export function toEntsoeDate(d: Date): string {
  const y  = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}${mo}${dd}${hh}${mi}`;
}

/** İlk eşleşen XML tag içeriğini döner — noktalı tag adlarını destekler */
export function getTagContent(xml: string, tag: string): string {
  const escaped = tag.replace(/\./g, "\\.");
  const m = xml.match(new RegExp(`<${escaped}[^>]*>([^<]*)</${escaped}>`));
  return m?.[1]?.trim() ?? "";
}

/** Tüm eşleşen XML blokları döner */
export function getAllBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  const escaped = tag.replace(/\./g, "\\.");
  const re = new RegExp(`<${escaped}[\\s>][\\s\\S]*?</${escaped}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[0]);
  return results;
}

/** ENTSO-E Period bloğunu position→hour + value çiftlerine parse eder */
export function parsePeriodPoints(
  period: string,
  valueTag: string,
): Array<{ hour: Date; value: number }> {
  const startStr = getTagContent(period, "start");
  const resStr   = getTagContent(period, "resolution");
  if (!startStr) return [];

  const startTime  = new Date(startStr);
  const resMinutes = resStr === "PT15M" ? 15 : resStr === "PT30M" ? 30 : 60;
  const points     = getAllBlocks(period, "Point");
  const result: Array<{ hour: Date; value: number }> = [];

  for (const pt of points) {
    const pos   = parseInt(getTagContent(pt, "position"), 10);
    const value = parseFloat(getTagContent(pt, valueTag));
    if (isNaN(pos) || isNaN(value)) continue;

    const offset = (pos - 1) * resMinutes;
    const hour   = new Date(startTime.getTime() + offset * 60_000);
    hour.setUTCMinutes(0, 0, 0);
    result.push({ hour, value });
  }
  return result;
}
