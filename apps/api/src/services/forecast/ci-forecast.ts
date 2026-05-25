// Task #121 — CI 24h tahmini (üretim karışımından gelecek karbon yoğunluğu)
import { prisma, Prisma } from "@voltfox/db";

export interface CiForecastResult {
  zoneCode:  string;
  hours:     number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

// IPCC 2022 median CI değerleri (gCO₂eq/kWh) — entso-e.ts ile senkron
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
  B20: 500,  // Other / Unknown
};

// Yük miktarının karşılanmayan kısmı marjinal üretici (genellikle gaz) ile kapatılır
const MARGINAL_CI = PSR_CI["B04"]!; // Fossil Gas — Avrupa şebekesinde tipik marjinal üretici

/**
 * CI 24h tahmini metodolojisi:
 * 1. Tahmin üretim karışımını al (solar + wind model çıktısı, ENTSO-E A69)
 * 2. Tarihsel bazal üretimi ekle (nükleer + hidro — geçen haftanın aynı saati)
 * 3. Yük tahmininden eksik kalan kısım → marjinal üretici (gaz)
 * 4. Ağırlıklı CI = Σ(kaynak_mw × kaynak_ci) / toplam_yük
 */
export async function runCiForecast(
  zoneCode:      string,
  forecastStart: Date,
  forecastEnd:   Date,
): Promise<CiForecastResult> {
  const now = new Date();
  let hours = 0;
  let errorCount = 0;

  // Tahmin saatlerini üret (1 saatlik adımlarla)
  const targetHours: Date[] = [];
  const cursor = new Date(forecastStart);
  while (cursor <= forecastEnd) {
    targetHours.push(new Date(cursor));
    cursor.setUTCHours(cursor.getUTCHours() + 1);
  }

  for (const hour of targetHours) {
    try {
      const ci = await calcHourlyCi(zoneCode, hour, now);
      if (ci === null) { errorCount++; continue; }

      const horizonH = Math.round((hour.getTime() - now.getTime()) / 3_600_000);

      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO ci_forecasts
          (zone_id, hour, ci_gco2_kwh, method, horizon_h, forecast_made_at)
        VALUES
          (${zoneCode}, ${hour}, ${ci.value}, 'generation-mix', ${horizonH}, ${now})
        ON CONFLICT (zone_id, hour, method, forecast_made_at)
        DO UPDATE SET
          ci_gco2_kwh = EXCLUDED.ci_gco2_kwh,
          horizon_h   = EXCLUDED.horizon_h
      `);
      hours++;
    } catch { errorCount++; }
  }

  const status = errorCount === 0 ? "ok" : hours > 0 ? "partial" : "error";
  return {
    zoneCode,
    hours,
    status,
    message: `${hours}/${targetHours.length} saatlik CI tahmini oluşturuldu.`,
  };
}

/** Tüm zone'lar için CI backfill — gerçekleşen EF geldiğinde MAE hesapla */
export async function backfillCiActual(zoneCode: string): Promise<void> {
  await prisma.$executeRaw(Prisma.sql`
    UPDATE ci_forecasts cf
    SET ci_actual_gco2_kwh = ef.ci_direct,
        mae = ABS(cf.ci_gco2_kwh - ef.ci_direct)
    FROM emission_factors ef
    WHERE cf.zone_id = ${zoneCode}
      AND cf.zone_id = ef.zone_id
      AND cf.hour    = ef.hour
      AND cf.ci_actual_gco2_kwh IS NULL
      AND ef.ci_direct IS NOT NULL
  `);
}

// ── İç hesaplama ─────────────────────────────────────────────────────────────

interface HourlyMix {
  value: number;  // gCO₂/kWh
}

async function calcHourlyCi(
  zoneCode: string,
  hour:     Date,
  now:      Date,
): Promise<HourlyMix | null> {
  // 1. Model üretim tahminlerini al (solar B16, wind B19)
  const modelForecasts = await getModelForecasts(zoneCode, hour);

  // 2. Tarihsel bazal üretim (nükleer + hidro) — geçen haftanın aynı saatinden
  const sameHourLastWeek = new Date(hour.getTime() - 7 * 24 * 60 * 60 * 1000);
  const baseloadMix = await getHistoricalMix(zoneCode, sameHourLastWeek);

  // 3. Yük tahmini
  const loadMw = await getLoadForecast(zoneCode, hour);

  if (loadMw === 0) return null;  // Yük verisi yoksa tahmin yapılamaz

  // Üretim karışımını derle
  const mix: Record<string, number> = { ...baseloadMix };
  for (const [psrType, mw] of Object.entries(modelForecasts)) {
    mix[psrType] = (mix[psrType] ?? 0) + mw;
  }

  // Toplam bilinen üretim
  const knownMw = Object.values(mix).reduce((s, v) => s + v, 0);

  // Kalan yük marjinal üretici (gaz) ile kapatılır
  const residualMw = Math.max(0, loadMw - knownMw);
  if (residualMw > 0) mix["B04"] = (mix["B04"] ?? 0) + residualMw;

  // Ağırlıklı CI hesabı
  let totalMw = 0;
  let totalEmissions = 0;
  for (const [psr, mw] of Object.entries(mix)) {
    const ci = PSR_CI[psr] ?? MARGINAL_CI;
    totalMw        += mw;
    totalEmissions += mw * ci;
  }

  if (totalMw === 0) return null;

  const ciValue = totalEmissions / totalMw;  // gCO₂/kWh
  return { value: Math.round(ciValue * 10) / 10 };
}

async function getModelForecasts(zoneCode: string, hour: Date): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ psr_type: string; quantity_mw: number }>>(Prisma.sql`
    SELECT psr_type, quantity_mw
    FROM generation_forecasts
    WHERE zone_id     = ${zoneCode}
      AND hour        = ${hour}
      AND record_type = 'forecast'
      AND source      = 'model'
      AND psr_type    IN ('B16', 'B19', 'B18')
  `);
  const result: Record<string, number> = {};
  for (const r of rows) result[r.psr_type] = r.quantity_mw;
  return result;
}

async function getHistoricalMix(zoneCode: string, sameHourPast: Date): Promise<Record<string, number>> {
  const rows = await prisma.$queryRaw<Array<{ psr_type: string; quantity_mw: number }>>(Prisma.sql`
    SELECT psr_type, quantity_mw
    FROM generation_forecasts
    WHERE zone_id     = ${zoneCode}
      AND hour        = ${sameHourPast}
      AND record_type = 'actual'
      AND psr_type    IN ('B10', 'B11', 'B12', 'B14')
  `);
  const result: Record<string, number> = {};
  for (const r of rows) result[r.psr_type] = r.quantity_mw;
  return result;
}

async function getLoadForecast(zoneCode: string, hour: Date): Promise<number> {
  const rows = await prisma.$queryRaw<Array<{ quantity_mw: number }>>(Prisma.sql`
    SELECT quantity_mw
    FROM generation_forecasts
    WHERE zone_id     = ${zoneCode}
      AND hour        = ${hour}
      AND psr_type    = 'TOTAL_LOAD'
      AND record_type = 'forecast'
    ORDER BY forecast_made_at DESC
    LIMIT 1
  `);
  return rows[0]?.quantity_mw ?? 0;
}
