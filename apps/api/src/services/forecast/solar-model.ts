// Task #119 — Güneş üretim modeli (GHI → PV çıkış gücü)
import { prisma, Prisma } from "@voltfox/db";
import { ZONE_COORDINATES } from "../open-meteo.js";

export interface SolarForecastResult {
  zoneCode:  string;
  hours:     number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

/**
 * Kurulu güneş kapasiteleri (GW) — ENTSO-E PEMMDB 2024 referans.
 * Gerçek değerler entegrasyon tamamlanınca ENTSO-E capacity API'sinden çekilecek.
 */
const INSTALLED_SOLAR_GW: Record<string, number> = {
  "DE":     90.6,
  "ES":     26.0,
  "IT":     28.0,
  "FR":     21.0,
  "NL":     22.0,
  "PL":     17.0,
  "TR":     10.5,
  "AT":      3.5,
  "BE":      7.8,
  "CZ":      2.1,
  "GR":      5.5,
  "RO":      1.5,
  "HU":      4.0,
  "SK":      0.6,
  "PT":      4.1,
  "BG":      1.5,
  "HR":      0.4,
  "SI":      0.7,
  "RS":      0.1,
  "SE":      3.5,
  "FI":      0.8,
  "NO":      0.2,
  "DK-DK1": 2.5,
  "DK-DK2": 1.5,
  "CH":      5.1,
  "LT":      0.5,
  "LV":      0.1,
  "EE":      0.3,
  "BA":      0.1,
  "ME":      0.1,
  "MK":      0.1,
  "AL":      0.1,
};

// Fizik sabitleri
const PANEL_TILT_DEG  = 35;   // Sabit eğim açısı (güneye bakan tipik kurulum)
const PERF_RATIO      = 0.80; // Performance Ratio (sistem verimliliği)
const TEMP_COEFF      = 0.0045; // Her °C için kayıp (tipik c-Si panel)
const STC_TEMP        = 25;   // Standart Test Koşulları sıcaklığı (°C)

/**
 * Güneş üretim tahmini: Open-Meteo GHI + sıcaklık → PV MW çıkışı.
 * Metodoloji: fizik tabanlı, audit-friendly (deterministik, kaynak belirtili).
 */
export async function runSolarForecast(
  zoneCode:   string,
  forecastStart: Date,
  forecastEnd:   Date,
): Promise<SolarForecastResult> {
  const installedGw = INSTALLED_SOLAR_GW[zoneCode];
  if (!installedGw) {
    return { zoneCode, hours: 0, status: "partial", message: `Kurulu kapasite verisi yok: ${zoneCode}` };
  }

  const coords = ZONE_COORDINATES[zoneCode];
  if (!coords) {
    return { zoneCode, hours: 0, status: "error", message: `Koordinat bulunamadı: ${zoneCode}` };
  }

  // Hava verisi al
  const weatherRows = await getWeatherData(coords.lat, coords.lon, forecastStart, forecastEnd);
  if (weatherRows.length === 0) {
    return { zoneCode, hours: 0, status: "partial", message: "Hava verisi bulunamadı — önce Open-Meteo import çalıştırın" };
  }

  const installedMw    = installedGw * 1000;
  const forecastMadeAt = new Date();
  let hours = 0;

  for (const row of weatherRows) {
    if (row.ghiWm2 === null || row.temperature2m === null) continue;

    // POA (Plane of Array) irradiance — basit fixed-tilt düzeltmesi
    // South-facing, tilt=35° için GHI → POA çevrimi (yaklaşık)
    const poaWm2 = row.ghiWm2 * (1 + 0.1 * Math.sin((PANEL_TILT_DEG * Math.PI) / 180));

    // Sıcaklık düzeltmesi
    const tempLoss = 1 - TEMP_COEFF * Math.max(0, row.temperature2m - STC_TEMP);

    // Güç çıkışı (MW)
    // P = (GHI/1000 W/m²) × installed_capacity × PR × temp_correction
    const outputMw = (poaWm2 / 1000) * installedMw * PERF_RATIO * tempLoss;
    const clampedMw = Math.max(0, Math.min(outputMw, installedMw));

    // ±15% güven aralığı (bulut örtüsü belirsizliği)
    const uncertainty = row.cloudCover !== null ? (row.cloudCover / 100) * 0.20 : 0.15;
    const confLow  = clampedMw * (1 - uncertainty);
    const confHigh = clampedMw * (1 + uncertainty);

    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO generation_forecasts
          (zone_id, hour, psr_type, record_type, quantity_mw, source,
           forecast_made_at, confidence_low, confidence_high)
        VALUES
          (${zoneCode}, ${row.hour}, 'B16', 'forecast', ${Math.round(clampedMw)},
           'model', ${forecastMadeAt},
           ${Math.round(confLow)}, ${Math.round(confHigh)})
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
    message: `${hours} saatlik güneş üretim tahmini oluşturuldu.`,
  };
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

interface WeatherRow {
  hour:          Date;
  ghiWm2:        number | null;
  temperature2m: number | null;
  cloudCover:    number | null;
}

async function getWeatherData(
  lat:   number,
  lon:   number,
  from:  Date,
  to:    Date,
): Promise<WeatherRow[]> {
  const latRound = Math.round(lat * 10) / 10;
  const lonRound = Math.round(lon * 10) / 10;

  return prisma.$queryRaw<WeatherRow[]>(Prisma.sql`
    SELECT hour, ghi_wm2 AS "ghiWm2", temperature_2m AS "temperature2m", cloud_cover AS "cloudCover"
    FROM weather_snapshots
    WHERE round(lat::numeric, 1) = ${latRound}
      AND round(lon::numeric, 1) = ${lonRound}
      AND hour >= ${from}
      AND hour <= ${to}
      AND source = 'open-meteo'
    ORDER BY hour ASC, forecast_made_at DESC
  `);
}
