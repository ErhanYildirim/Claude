// Task #120 — Rüzgar üretim modeli (güç eğrisi)
import { prisma, Prisma } from "@voltfox/db";
import { ZONE_COORDINATES } from "../open-meteo.js";

export interface WindForecastResult {
  zoneCode:  string;
  hours:     number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

/**
 * Kurulu rüzgar kapasiteleri (GW) — kara rüzgar (onshore).
 * ENTSO-E PEMMDB 2024 referans.
 */
const INSTALLED_WIND_ONSHORE_GW: Record<string, number> = {
  "DE":     62.0,
  "ES":     30.9,
  "FR":     22.7,
  "SE":     14.6,
  "TR":     10.5,
  "PL":      9.0,
  "IT":     11.7,
  "NL":      6.7,
  "PT":      5.7,
  "FI":      5.7,
  "DK-DK1": 4.5,
  "DK-DK2": 2.1,
  "NO":      4.3,
  "AT":      3.6,
  "BE":      2.7,
  "RO":      3.0,
  "GR":      4.5,
  "BG":      0.7,
  "CZ":      0.3,
  "HU":      0.4,
  "SK":      0.1,
  "HR":      0.8,
  "RS":      0.5,
  "LT":      0.8,
  "LV":      0.1,
  "EE":      0.3,
  "SI":      0.1,
  "CH":      0.1,
  "BA":      0.1,
  "ME":      0.1,
  "MK":      0.1,
  "AL":      0.0,
};

/**
 * Vestas V150-4.5 referans güç eğrisi (normalize edilmiş CF değerleri).
 * Key: rüzgar hızı (m/s, tam sayı), Value: kapasite faktörü (0–1).
 * Cut-in: 3 m/s, rated: 12 m/s, cut-out: 25 m/s.
 */
const POWER_CURVE: Record<number, number> = {
   0: 0.000,  1: 0.000,  2: 0.000,  3: 0.010,
   4: 0.040,  5: 0.090,  6: 0.160,  7: 0.250,
   8: 0.370,  9: 0.510, 10: 0.650, 11: 0.810,
  12: 0.960, 13: 0.990, 14: 1.000, 15: 1.000,
  16: 1.000, 17: 1.000, 18: 1.000, 19: 1.000,
  20: 1.000, 21: 1.000, 22: 1.000, 23: 1.000,
  24: 0.950, 25: 0.000,  // cut-out
};

const SEA_LEVEL_PRESSURE = 1.225; // kg/m³, standart hava yoğunluğu

/**
 * Rüzgar üretim tahmini: Open-Meteo wind_100m → güç eğrisi → MW çıkışı.
 * Metodoloji: normalize güç eğrisi + hava yoğunluğu düzeltmesi.
 */
export async function runWindForecast(
  zoneCode:      string,
  forecastStart: Date,
  forecastEnd:   Date,
): Promise<WindForecastResult> {
  const installedGw = INSTALLED_WIND_ONSHORE_GW[zoneCode];
  if (!installedGw) {
    return { zoneCode, hours: 0, status: "partial", message: `Kurulu kapasite verisi yok: ${zoneCode}` };
  }

  const coords = ZONE_COORDINATES[zoneCode];
  if (!coords) {
    return { zoneCode, hours: 0, status: "error", message: `Koordinat bulunamadı: ${zoneCode}` };
  }

  const weatherRows = await getWeatherData(coords.lat, coords.lon, forecastStart, forecastEnd);
  if (weatherRows.length === 0) {
    return { zoneCode, hours: 0, status: "partial", message: "Hava verisi bulunamadı — önce Open-Meteo import çalıştırın" };
  }

  const installedMw    = installedGw * 1000;
  const forecastMadeAt = new Date();
  let hours = 0;

  for (const row of weatherRows) {
    if (row.windSpeed100m === null) continue;

    const cf         = lookupPowerCurve(row.windSpeed100m);
    // Yükseklik bazlı hava yoğunluğu düzeltmesi (~200m zona ortalaması için ~0.01 fark)
    const densityCorr = (row.temperature2m !== null)
      ? SEA_LEVEL_PRESSURE * (293 / (273 + row.temperature2m))
      : SEA_LEVEL_PRESSURE;
    const densityFactor = densityCorr / SEA_LEVEL_PRESSURE;

    const outputMw  = cf * installedMw * densityFactor;
    const clampedMw = Math.max(0, Math.min(outputMw, installedMw));

    // Güven aralığı: rüzgar hızı ±2 m/s belirsizliği → CF farkı
    const cfLow  = lookupPowerCurve(Math.max(0, row.windSpeed100m - 2));
    const cfHigh = lookupPowerCurve(Math.min(30, row.windSpeed100m + 2));

    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO generation_forecasts
          (zone_id, hour, psr_type, record_type, quantity_mw, source,
           forecast_made_at, confidence_low, confidence_high)
        VALUES
          (${zoneCode}, ${row.hour}, 'B19', 'forecast', ${Math.round(clampedMw)},
           'model', ${forecastMadeAt},
           ${Math.round(cfLow * installedMw)},
           ${Math.round(cfHigh * installedMw)})
        ON CONFLICT (zone_id, hour, psr_type, record_type, source)
        DO UPDATE SET
          quantity_mw      = EXCLUDED.quantity_mw,
          forecast_made_at = EXCLUDED.forecast_made_at,
          confidence_low   = EXCLUDED.confidence_low,
          confidence_high  = EXCLUDED.confidence_high
      `);
      hours++;
    } catch { /* tek satır hatalarını atla */ }
  }

  return {
    zoneCode,
    hours,
    status:  hours > 0 ? "ok" : "partial",
    message: `${hours} saatlik rüzgar üretim tahmini oluşturuldu.`,
  };
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function lookupPowerCurve(windSpeedMs: number): number {
  const v = Math.floor(windSpeedMs);
  if (v >= 25) return 0;
  if (v < 0)   return 0;
  const cf0 = POWER_CURVE[v]     ?? 0;
  const cf1 = POWER_CURVE[v + 1] ?? cf0;
  // Doğrusal interpolasyon
  const frac = windSpeedMs - v;
  return cf0 + (cf1 - cf0) * frac;
}

interface WeatherRow {
  hour:          Date;
  windSpeed100m: number | null;
  temperature2m: number | null;
}

async function getWeatherData(
  lat:  number,
  lon:  number,
  from: Date,
  to:   Date,
): Promise<WeatherRow[]> {
  const latRound = Math.round(lat * 10) / 10;
  const lonRound = Math.round(lon * 10) / 10;

  return prisma.$queryRaw<WeatherRow[]>(Prisma.sql`
    SELECT hour, wind_speed_100m AS "windSpeed100m", temperature_2m AS "temperature2m"
    FROM weather_snapshots
    WHERE round(lat::numeric, 1) = ${latRound}
      AND round(lon::numeric, 1) = ${lonRound}
      AND hour >= ${from}
      AND hour <= ${to}
      AND source = 'open-meteo'
    ORDER BY hour ASC, forecast_made_at DESC
  `);
}
