// Task #118 — DAM fiyat istatistiksel modeli (7-günlük saatlik ağırlıklı ortalama)
import { prisma, Prisma } from "@voltfox/db";

export interface DamForecastResult {
  zoneCode:  string;
  hours:     number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

// Türkiye tatil günleri için basit heuristik (Ocak 1, Nisan 23, Mayıs 19, vb.)
const TURKEY_PUBLIC_HOLIDAYS = new Set([
  "01-01", "04-23", "05-01", "05-19", "07-15", "08-30", "10-29",
]);

function isHoliday(d: Date): boolean {
  const mmdd = `${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
  return TURKEY_PUBLIC_HOLIDAYS.has(mmdd);
}

/**
 * D+1 fiyat tahmini: son 4 haftanın aynı saatinin ağırlıklı ortalaması.
 * Ağırlıklar: 4 hafta öncesi=1, 3 hafta=2, 2 hafta=3, geçen hafta=4.
 * Hafta içi/hafta sonu ve tatil günleri için ayrı hesap.
 */
export async function runDamPriceForecast(zoneCode: string): Promise<DamForecastResult> {
  const now = new Date();

  // D+1: yarının 00:00 UTC'sinden başla
  const tomorrow = new Date(now);
  tomorrow.setUTCHours(0, 0, 0, 0);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);

  let hours = 0;
  const errors: string[] = [];

  for (let h = 0; h < 24; h++) {
    const targetHour = new Date(tomorrow.getTime() + h * 60 * 60 * 1000);
    const dayOfWeek  = targetHour.getUTCDay();   // 0=Pazar, 6=Cumartesi
    const isWeekend  = dayOfWeek === 0 || dayOfWeek === 6;
    const holiday    = isHoliday(targetHour);

    // Son 4 haftanın aynı saatini çek
    const historicalPrices = await getHistoricalSameHour(zoneCode, targetHour, 4);

    if (historicalPrices.length === 0) {
      errors.push(`Saat ${h}: geçmiş veri yok`);
      continue;
    }

    // Ağırlıklı ortalama
    const { weightedAvg, stdDev } = calcWeightedStats(historicalPrices);

    // Mevsimsel düzeltmeler
    let forecastPrice = weightedAvg;
    if (isWeekend || holiday) forecastPrice *= 0.85;   // hafta sonu/tatil indirimi
    if (h >= 8 && h <= 20)    forecastPrice *= 1.05;   // gündüz peak saatleri

    const confidenceLow  = Math.max(0, forecastPrice - stdDev);
    const confidenceHigh = forecastPrice + stdDev;

    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO market_prices
          (zone_id, hour, price_eur_mwh, currency, price_type, source,
           forecast_made_at, confidence_low, confidence_high)
        VALUES
          (${zoneCode}, ${targetHour}, ${Math.round(forecastPrice * 100) / 100},
           'EUR', 'dam_forecast', 'model', ${now},
           ${Math.round(confidenceLow * 100) / 100},
           ${Math.round(confidenceHigh * 100) / 100})
        ON CONFLICT (zone_id, hour, price_type, source)
        DO UPDATE SET
          price_eur_mwh   = EXCLUDED.price_eur_mwh,
          forecast_made_at = EXCLUDED.forecast_made_at,
          confidence_low  = EXCLUDED.confidence_low,
          confidence_high = EXCLUDED.confidence_high
      `);
      hours++;
    } catch (err) {
      errors.push(`Saat ${h}: ${String(err)}`);
    }
  }

  const status = hours === 24 ? "ok" : hours > 0 ? "partial" : "error";
  return {
    zoneCode,
    hours,
    status,
    message: errors.length
      ? `${hours}/24 saat tahmin edildi. Hatalar: ${errors.slice(0, 3).join("; ")}`
      : `D+1 fiyat tahmini tamamlandı: ${hours} saat.`,
  };
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

interface HistoricalPrice {
  weeksAgo: number;  // 1–4
  price:    number;
}

async function getHistoricalSameHour(
  zoneCode:   string,
  targetHour: Date,
  weekCount:  number,
): Promise<HistoricalPrice[]> {
  const result: HistoricalPrice[] = [];

  for (let w = 1; w <= weekCount; w++) {
    const sameHourPast = new Date(targetHour.getTime() - w * 7 * 24 * 60 * 60 * 1000);
    const rows = await prisma.$queryRaw<Array<{ price_eur_mwh: number }>>(Prisma.sql`
      SELECT price_eur_mwh
      FROM market_prices
      WHERE zone_id    = ${zoneCode}
        AND hour       = ${sameHourPast}
        AND price_type = 'dam_actual'
        AND price_eur_mwh IS NOT NULL
      LIMIT 1
    `);
    if (rows.length > 0 && rows[0].price_eur_mwh !== null) {
      result.push({ weeksAgo: w, price: rows[0].price_eur_mwh });
    }
  }
  return result;
}

function calcWeightedStats(prices: HistoricalPrice[]): { weightedAvg: number; stdDev: number } {
  // Ağırlık: daha yakın hafta = daha yüksek ağırlık
  const maxWeeks = Math.max(...prices.map(p => p.weeksAgo));
  let weightSum = 0;
  let weightedSum = 0;
  for (const p of prices) {
    const w = maxWeeks - p.weeksAgo + 1;  // 4, 3, 2, 1
    weightSum    += w;
    weightedSum  += p.price * w;
  }
  const weightedAvg = weightedSum / weightSum;

  // Standart sapma (±1σ güven aralığı için)
  const variance = prices.reduce((acc, p) => acc + Math.pow(p.price - weightedAvg, 2), 0) / prices.length;
  const stdDev   = Math.sqrt(variance);

  return { weightedAvg, stdDev };
}
