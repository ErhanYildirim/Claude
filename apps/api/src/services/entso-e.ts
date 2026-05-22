import { prisma, Prisma } from "@voltfox/db";

// ── Carbon intensity per fuel type (gCO₂eq/kWh) — IPCC 2022 median values ──
const PSR_CI: Record<string, number> = {
  B01: 230,  // Biomass
  B02: 1150, // Fossil Brown coal / Lignite
  B03: 490,  // Fossil Coal-derived gas
  B04: 490,  // Fossil Gas
  B05: 820,  // Fossil Hard coal
  B06: 650,  // Fossil Oil
  B07: 750,  // Fossil Oil shale
  B08: 380,  // Fossil Peat
  B09: 38,   // Geothermal
  B10: 24,   // Hydro Pumped Storage
  B11: 24,   // Hydro Run-of-river
  B12: 24,   // Hydro Water Reservoir
  B13: 17,   // Marine
  B14: 12,   // Nuclear
  B15: 50,   // Other renewable
  B16: 45,   // Solar
  B17: 700,  // Waste
  B18: 12,   // Wind Offshore
  B19: 11,   // Wind Onshore
  B20: 500,  // Other
};

// Zero-carbon fuel types (for CFE% calculation)
const CFE_TYPES = new Set(["B09","B10","B11","B12","B13","B14","B16","B18","B19"]);

// Renewable fuel types (for RE% calculation)
const RE_TYPES  = new Set(["B01","B09","B10","B11","B12","B13","B15","B16","B18","B19"]);

// ── Supported ENTSO-E bidding zones ─────────────────────────────────────────
export interface EntsoeZone {
  code:    string;
  eicCode: string;
  name:    string;
  country: string;
}

export const ENTSO_ZONES: EntsoeZone[] = [
  { code: "DE",     eicCode: "10Y1001A1001A83F", name: "Germany",          country: "DE" },
  { code: "FR",     eicCode: "10YFR-RTE------C", name: "France",           country: "FR" },
  { code: "NL",     eicCode: "10YNL----------L", name: "Netherlands",      country: "NL" },
  { code: "ES",     eicCode: "10YES-REE------0", name: "Spain",            country: "ES" },
  { code: "AT",     eicCode: "10YAT-APG------L", name: "Austria",          country: "AT" },
  { code: "BE",     eicCode: "10YBE----------2", name: "Belgium",          country: "BE" },
  { code: "TR",     eicCode: "10YTR-TEIAS----W", name: "Turkey",           country: "TR" },
  { code: "PL",     eicCode: "10YPL-AREA-----S", name: "Poland",           country: "PL" },
  { code: "NO",     eicCode: "10YNO-0--------C", name: "Norway",           country: "NO" },
  { code: "SE",     eicCode: "10YSE-1--------K", name: "Sweden",           country: "SE" },
  { code: "FI",     eicCode: "10YFI-1--------U", name: "Finland",          country: "FI" },
  { code: "CH",     eicCode: "10YCH-SWISSGRIDZ", name: "Switzerland",      country: "CH" },
  { code: "CZ",     eicCode: "10YCZ-CEPS-----N", name: "Czech Republic",   country: "CZ" },
  { code: "HU",     eicCode: "10YHU-MAVIR----U", name: "Hungary",          country: "HU" },
  { code: "RO",     eicCode: "10YRO-TEL------P", name: "Romania",          country: "RO" },
  { code: "SK",     eicCode: "10YSK-SEPS-----K", name: "Slovakia",         country: "SK" },
  { code: "SI",     eicCode: "10YSI-ELES-----O", name: "Slovenia",         country: "SI" },
  { code: "HR",     eicCode: "10YHR-HEP------M", name: "Croatia",          country: "HR" },
  { code: "BG",     eicCode: "10YCA-BULGARIA-R", name: "Bulgaria",         country: "BG" },
  { code: "GR",     eicCode: "10YGR-HTSO-----Y", name: "Greece",           country: "GR" },
  { code: "IT",     eicCode: "10YIT-GRTN-----B", name: "Italy",            country: "IT" },
  { code: "PT",     eicCode: "10YPT-REN------W", name: "Portugal",         country: "PT" },
  { code: "DK-DK1", eicCode: "10YDK-1--------W", name: "Denmark West",     country: "DK" },
  { code: "DK-DK2", eicCode: "10YDK-2--------M", name: "Denmark East",     country: "DK" },
  { code: "LT",     eicCode: "10YLT-1001A0008Q", name: "Lithuania",        country: "LT" },
  { code: "LV",     eicCode: "10YLV-1001A00074", name: "Latvia",           country: "LV" },
  { code: "EE",     eicCode: "10Y1001A1001A39I", name: "Estonia",          country: "EE" },
  { code: "RS",     eicCode: "10YCS-SERBIATSOW", name: "Serbia",           country: "RS" },
  { code: "BA",     eicCode: "10YBA-JPCC-----D", name: "Bosnia",           country: "BA" },
  { code: "ME",     eicCode: "10YCS-CG-TSO---S", name: "Montenegro",       country: "ME" },
  { code: "MK",     eicCode: "10YMK-MEPSO----8", name: "North Macedonia",  country: "MK" },
  { code: "AL",     eicCode: "10YAL-KESH-----5", name: "Albania",          country: "AL" },
];

const ZONE_MAP = new Map(ENTSO_ZONES.map(z => [z.code, z]));

// ── Date formatting for ENTSO-E API ─────────────────────────────────────────
function toEntsoeDate(d: Date): string {
  const y  = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mi = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}${mo}${dd}${hh}${mi}`;
}

// ── Minimal XML extractor (no external dependency) ───────────────────────────
function getTagContent(xml: string, tag: string): string {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([^<]*)</${tag}>`));
  return m?.[1]?.trim() ?? "";
}

function getAllBlocks(xml: string, tag: string): string[] {
  const results: string[] = [];
  const re = new RegExp(`<${tag}[\\s>][\\s\\S]*?</${tag}>`, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) results.push(m[0]);
  return results;
}

interface HourlyEntry {
  hour:    Date;
  psrType: string;
  mwh:     number;
}

function parseEntsoeXml(xml: string): HourlyEntry[] {
  const entries: HourlyEntry[] = [];
  const timeSeries = getAllBlocks(xml, "TimeSeries");

  for (const ts of timeSeries) {
    const psrType = getTagContent(ts, "psrType");
    if (!psrType) continue;

    const periods = getAllBlocks(ts, "Period");
    for (const period of periods) {
      const startStr  = getTagContent(period, "start");
      const resStr    = getTagContent(period, "resolution");
      if (!startStr) continue;

      const startTime   = new Date(startStr);
      const resMinutes  = resStr === "PT15M" ? 15 : resStr === "PT30M" ? 30 : 60;
      const points      = getAllBlocks(period, "Point");

      for (const pt of points) {
        const pos = parseInt(getTagContent(pt, "position"), 10);
        const qty = parseFloat(getTagContent(pt, "quantity"));
        if (isNaN(pos) || isNaN(qty)) continue;

        const hourOffset = (pos - 1) * resMinutes;
        const hour = new Date(startTime.getTime() + hourOffset * 60 * 1000);
        // Snap to full hour (aggregate 15/30-min intervals to hourly in calling code)
        hour.setUTCMinutes(0, 0, 0);

        entries.push({ hour, psrType, mwh: qty });
      }
    }
  }
  return entries;
}

interface HourlyCi {
  hour:          Date;
  ciDirect:      number;  // gCO₂eq/kWh
  ciLifecycle:   number;
  cfePct:        number;  // %
  rePct:         number;  // %
}

function aggregateHourlyCi(entries: HourlyEntry[]): HourlyCi[] {
  // Group by hour
  const byHour = new Map<number, Map<string, number>>();
  for (const e of entries) {
    const ts = e.hour.getTime();
    if (!byHour.has(ts)) byHour.set(ts, new Map());
    const m = byHour.get(ts)!;
    m.set(e.psrType, (m.get(e.psrType) ?? 0) + e.mwh);
  }

  const result: HourlyCi[] = [];
  for (const [ts, gen] of byHour) {
    let totalMwh = 0, totalEmissions = 0, cfeMwh = 0, reMwh = 0;
    for (const [psr, mwh] of gen) {
      const ci = PSR_CI[psr] ?? 500;
      totalMwh       += mwh;
      totalEmissions += mwh * ci;
      if (CFE_TYPES.has(psr)) cfeMwh += mwh;
      if (RE_TYPES.has(psr))  reMwh  += mwh;
    }
    if (totalMwh === 0) continue;

    const ciDirect   = totalEmissions / totalMwh;      // gCO₂eq/kWh
    result.push({
      hour:        new Date(ts),
      ciDirect:    Math.round(ciDirect * 10) / 10,
      ciLifecycle: Math.round(ciDirect * 1.1 * 10) / 10,
      cfePct:      Math.round((cfeMwh / totalMwh) * 1000) / 10,
      rePct:       Math.round((reMwh  / totalMwh) * 1000) / 10,
    });
  }
  return result.sort((a, b) => a.hour.getTime() - b.hour.getTime());
}

// ── Main import function ─────────────────────────────────────────────────────
export interface EntsoeImportResult {
  zoneCode:  string;
  rowsAdded: number;
  hoursFrom: string;
  hoursTo:   string;
  status:    "ok" | "error" | "partial";
  message:   string;
}

export async function importEntsoeZone(
  token:     string,
  zoneCode:  string,
  startDate: Date,
  endDate:   Date,
): Promise<EntsoeImportResult> {
  const startedAt = new Date();
  const zone = ZONE_MAP.get(zoneCode);
  if (!zone) throw new Error(`Bilinmeyen zone kodu: ${zoneCode}`);

  const url = new URL("https://web-api.tp.entsoe.eu/api");
  url.searchParams.set("securityToken", token);
  url.searchParams.set("documentType",  "A75");
  url.searchParams.set("processType",   "A16");
  url.searchParams.set("in_Domain",     zone.eicCode);
  url.searchParams.set("periodStart",   toEntsoeDate(startDate));
  url.searchParams.set("periodEnd",     toEntsoeDate(endDate));

  let xml: string;
  try {
    const resp = await fetch(url.toString(), {
      signal: AbortSignal.timeout(60_000),
      headers: { "Accept": "application/xml" },
    });
    xml = await resp.text();
    if (!resp.ok) {
      const errMsg = getTagContent(xml, "text") || getTagContent(xml, "Reason") || `HTTP ${resp.status}`;
      throw new Error(`ENTSO-E API hatası: ${errMsg}`);
    }
  } catch (err) {
    const endedAt = new Date();
    await prisma.efImportLog.create({
      data: { year: startDate.getUTCFullYear(), zoneId: zoneCode, rowsAdded: 0,
              status: "error", message: String(err), startedAt, endedAt },
    }).catch(() => {});
    return { zoneCode, rowsAdded: 0, hoursFrom: "", hoursTo: "", status: "error", message: String(err) };
  }

  const entries  = parseEntsoeXml(xml);
  const hourlyCI = aggregateHourlyCi(entries);

  if (hourlyCI.length === 0) {
    const endedAt = new Date();
    await prisma.efImportLog.create({
      data: { year: startDate.getUTCFullYear(), zoneId: zoneCode, rowsAdded: 0,
              status: "partial", message: "ENTSO-E yanıtında kullanılabilir veri yok.", startedAt, endedAt },
    }).catch(() => {});
    return { zoneCode, rowsAdded: 0, hoursFrom: "", hoursTo: "", status: "partial",
             message: "ENTSO-E yanıtında veri bulunamadı." };
  }

  // Upsert rows via raw SQL (INSERT … ON CONFLICT DO UPDATE)
  let rowsAdded = 0;
  for (const row of hourlyCI) {
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO emission_factors (zone_id, zone_name, country, hour, granularity,
            ci_direct, ci_lifecycle, cfe_pct, re_pct, data_estimated)
        VALUES (${zone.code}, ${zone.name}, ${zone.country}, ${row.hour}, 'hourly',
            ${row.ciDirect}, ${row.ciLifecycle}, ${row.cfePct}, ${row.rePct}, false)
        ON CONFLICT (zone_id, hour) DO UPDATE SET
            ci_direct    = EXCLUDED.ci_direct,
            ci_lifecycle = EXCLUDED.ci_lifecycle,
            cfe_pct      = EXCLUDED.cfe_pct,
            re_pct       = EXCLUDED.re_pct,
            data_estimated = false
      `);
      rowsAdded++;
    } catch {
      // Skip single row errors (e.g. constraint issues on other zones) and continue
    }
  }

  const endedAt = new Date();
  await prisma.efImportLog.create({
    data: {
      year:      startDate.getUTCFullYear(),
      zoneId:    zoneCode,
      rowsAdded,
      status:    rowsAdded > 0 ? "ok" : "partial",
      message:   `ENTSO-E A75 import: ${rowsAdded}/${hourlyCI.length} saat işlendi.`,
      startedAt,
      endedAt,
    },
  }).catch(() => {});

  return {
    zoneCode,
    rowsAdded,
    hoursFrom: hourlyCI[0].hour.toISOString(),
    hoursTo:   hourlyCI[hourlyCI.length - 1].hour.toISOString(),
    status:    rowsAdded > 0 ? "ok" : "partial",
    message:   `${rowsAdded} saatlik EF verisi eklendi/güncellendi.`,
  };
}
