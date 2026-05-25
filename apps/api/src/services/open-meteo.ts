// Task #117 — Open-Meteo hava durumu pipeline (API key gerektirmez)
import { prisma, Prisma } from "@voltfox/db";

export interface WeatherImportResult {
  zoneCode:  string;
  lat:       number;
  lon:       number;
  rowsAdded: number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

/** Her ENTSO-E zone için merkezi koordinat */
export const ZONE_COORDINATES: Record<string, { lat: number; lon: number }> = {
  "DE":     { lat: 51.2, lon:  10.5 },
  "FR":     { lat: 46.2, lon:   2.2 },
  "NL":     { lat: 52.1, lon:   5.3 },
  "ES":     { lat: 40.4, lon:  -3.7 },
  "AT":     { lat: 47.5, lon:  14.6 },
  "BE":     { lat: 50.5, lon:   4.5 },
  "TR":     { lat: 39.1, lon:  35.2 },
  "PL":     { lat: 51.9, lon:  19.1 },
  "NO":     { lat: 60.5, lon:   8.5 },
  "SE":     { lat: 62.0, lon:  15.6 },
  "FI":     { lat: 64.0, lon:  26.0 },
  "CH":     { lat: 46.8, lon:   8.2 },
  "CZ":     { lat: 49.8, lon:  15.5 },
  "HU":     { lat: 47.2, lon:  19.5 },
  "RO":     { lat: 45.9, lon:  25.0 },
  "SK":     { lat: 48.7, lon:  19.7 },
  "SI":     { lat: 46.1, lon:  14.8 },
  "HR":     { lat: 45.1, lon:  15.2 },
  "BG":     { lat: 42.7, lon:  25.5 },
  "GR":     { lat: 39.1, lon:  22.0 },
  "IT":     { lat: 42.5, lon:  12.3 },
  "PT":     { lat: 39.5, lon:  -8.0 },
  "DK-DK1": { lat: 55.9, lon:   9.5 },
  "DK-DK2": { lat: 55.6, lon:  12.1 },
  "LT":     { lat: 55.9, lon:  23.9 },
  "LV":     { lat: 56.9, lon:  24.6 },
  "EE":     { lat: 58.6, lon:  25.0 },
  "RS":     { lat: 44.0, lon:  21.0 },
  "BA":     { lat: 44.2, lon:  17.9 },
  "ME":     { lat: 42.8, lon:  19.4 },
  "MK":     { lat: 41.6, lon:  21.7 },
  "AL":     { lat: 41.1, lon:  20.1 },
};

/**
 * Open-Meteo'dan zone'un merkezi koordinatı için 48 saatlik hava tahmini çeker.
 * API key gerektirmez. Rate limit: 10.000 istek/dakika.
 */
export async function importWeatherForZone(zoneCode: string): Promise<WeatherImportResult> {
  const coords = ZONE_COORDINATES[zoneCode];
  if (!coords) {
    return { zoneCode, lat: 0, lon: 0, rowsAdded: 0, status: "error", message: `Koordinat bulunamadı: ${zoneCode}` };
  }

  const { lat, lon } = coords;
  const startedAt = new Date();

  const url = buildOpenMeteoUrl(lat, lon);
  let data: OpenMeteoResponse;

  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) throw new Error(`Open-Meteo HTTP ${resp.status}`);
    data = await resp.json() as OpenMeteoResponse;
  } catch (err) {
    await logJob(zoneCode, "error", 0, String(err), startedAt);
    return { zoneCode, lat, lon, rowsAdded: 0, status: "error", message: String(err) };
  }

  const rows = parseOpenMeteoResponse(data, lat, lon);
  if (rows.length === 0) {
    await logJob(zoneCode, "partial", 0, "Veri bulunamadı", startedAt);
    return { zoneCode, lat, lon, rowsAdded: 0, status: "partial", message: "Open-Meteo yanıtında veri yok" };
  }

  const forecastMadeAt = new Date();
  let rowsAdded = 0;

  for (const row of rows) {
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO weather_snapshots
          (lat, lon, hour,
           ghi_wm2, dhi_wm2,
           wind_speed_10m, wind_speed_100m, wind_direction_10m,
           temperature_2m, cloud_cover, precipitation,
           source, forecast_made_at)
        VALUES
          (${Math.round(lat * 10) / 10}, ${Math.round(lon * 10) / 10}, ${row.hour},
           ${row.ghiWm2}, ${row.dhiWm2},
           ${row.windSpeed10m}, ${row.windSpeed100m}, ${row.windDirection10m},
           ${row.temperature2m}, ${row.cloudCover}, ${row.precipitation},
           'open-meteo', ${forecastMadeAt})
        ON CONFLICT DO NOTHING
      `);
      rowsAdded++;
    } catch { /* tek satır hatalarını atla */ }
  }

  await logJob(zoneCode, rowsAdded > 0 ? "success" : "partial", rowsAdded, undefined, startedAt);
  return {
    zoneCode, lat, lon,
    rowsAdded,
    status:  rowsAdded > 0 ? "ok" : "partial",
    message: `${rowsAdded} saatlik hava verisi eklendi.`,
  };
}

/** Pilot zone'lar için paralel import (önce TR + DE, sonra genişletilir) */
export async function importWeatherPilotZones(): Promise<WeatherImportResult[]> {
  const pilotZones = ["TR", "DE", "ES", "FR", "IT", "PL"];
  const settled = await Promise.allSettled(pilotZones.map(importWeatherForZone));
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { zoneCode: pilotZones[i], lat: 0, lon: 0, rowsAdded: 0, status: "error" as const, message: String(r.reason) }
  );
}

/** Tüm zone'lar için import */
export async function importWeatherAllZones(): Promise<WeatherImportResult[]> {
  const zones = Object.keys(ZONE_COORDINATES);
  const settled = await Promise.allSettled(zones.map(importWeatherForZone));
  return settled.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { zoneCode: zones[i], lat: 0, lon: 0, rowsAdded: 0, status: "error" as const, message: String(r.reason) }
  );
}

// ── Open-Meteo URL ───────────────────────────────────────────────────────────

function buildOpenMeteoUrl(lat: number, lon: number): string {
  const params = new URLSearchParams({
    latitude:      String(lat),
    longitude:     String(lon),
    hourly:        [
      "shortwave_radiation",  // GHI W/m²
      "diffuse_radiation",    // DHI W/m²
      "wind_speed_10m",
      "wind_speed_100m",
      "wind_direction_10m",
      "temperature_2m",
      "cloud_cover",
      "precipitation",
    ].join(","),
    forecast_days: "2",
    timezone:      "UTC",
  });
  return `https://api.open-meteo.com/v1/forecast?${params}`;
}

// ── Response tipler ─────────────────────────────────────────────────────────

interface OpenMeteoResponse {
  hourly: {
    time:                string[];
    shortwave_radiation: number[];
    diffuse_radiation:   number[];
    wind_speed_10m:      number[];
    wind_speed_100m:     number[];
    wind_direction_10m:  number[];
    temperature_2m:      number[];
    cloud_cover:         number[];
    precipitation:       number[];
  };
}

interface WeatherRow {
  hour:            Date;
  ghiWm2:          number | null;
  dhiWm2:          number | null;
  windSpeed10m:    number | null;
  windSpeed100m:   number | null;
  windDirection10m: number | null;
  temperature2m:   number | null;
  cloudCover:      number | null;
  precipitation:   number | null;
}

function parseOpenMeteoResponse(data: OpenMeteoResponse, _lat: number, _lon: number): WeatherRow[] {
  const h = data.hourly;
  if (!h?.time?.length) return [];

  return h.time.map((timeStr, i) => ({
    hour:             new Date(`${timeStr}Z`),
    ghiWm2:          h.shortwave_radiation[i]  ?? null,
    dhiWm2:          h.diffuse_radiation[i]    ?? null,
    windSpeed10m:    h.wind_speed_10m[i]       ?? null,
    windSpeed100m:   h.wind_speed_100m[i]      ?? null,
    windDirection10m: h.wind_direction_10m[i]  ?? null,
    temperature2m:   h.temperature_2m[i]       ?? null,
    cloudCover:      h.cloud_cover[i]          ?? null,
    precipitation:   h.precipitation[i]        ?? null,
  }));
}

async function logJob(
  zoneId:   string,
  status:   "success" | "error" | "partial",
  rows:     number,
  errorMsg: string | undefined,
  startedAt: Date,
) {
  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO data_import_jobs (job_type, zone_id, status, started_at, finished_at, rows_inserted, error_message)
      VALUES ('weather', ${zoneId}, ${status}, ${startedAt}, ${new Date()}, ${rows}, ${errorMsg ?? null})
    `);
  } catch { /* log hatası uygulamayı durdurmasın */ }
}
