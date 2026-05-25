// Task #114 — EPIAŞ PTF API çekici (Türkiye DAM fiyatları, TRY/MWh)
import { prisma, Prisma } from "@voltfox/db";

const ZONE_CODE = "TR";

export interface EpiasImportResult {
  rowsAdded: number;
  status:    "ok" | "error" | "partial";
  message:   string;
}

interface EpiasCredentials {
  username: string;
  password: string;
}

/**
 * EPIAŞ Şeffaflık Platformu'ndan PTF (Piyasa Takas Fiyatı) çeker.
 * PTF, Türkiye günlük elektrik piyasasının resmi kapanış fiyatıdır.
 * Her gün ~12:00–13:00 Türkiye saatinde yayınlanır (14:30 UTC cron'u uygundur).
 */
export async function importEpiasPtf(
  credentials: EpiasCredentials,
  date: Date,
): Promise<EpiasImportResult> {
  const startedAt = new Date();

  // EPIAŞ v1 API URL'si — v2 fallback aşağıda
  const dateStr = formatEpiasDate(date);

  let prices: Array<{ hour: Date; priceTry: number }> = [];
  let lastError = "";

  // v1 API denemesi
  try {
    prices = await fetchEpiasV1(dateStr);
  } catch (err) {
    lastError = String(err);
    // v1 başarısız — v2 dene
    try {
      prices = await fetchEpiasV2(credentials, dateStr);
    } catch (err2) {
      lastError = String(err2);
    }
  }

  if (prices.length === 0) {
    await logJob("error", 0, `EPIAŞ PTF alınamadı: ${lastError}`, startedAt);
    return { rowsAdded: 0, status: "error", message: lastError };
  }

  let rowsAdded = 0;
  for (const row of prices) {
    try {
      await prisma.$executeRaw(Prisma.sql`
        INSERT INTO market_prices
          (zone_id, hour, price_try_mwh, currency, price_type, source)
        VALUES
          (${ZONE_CODE}, ${row.hour}, ${row.priceTry}, 'TRY', 'dam_actual', 'epias')
        ON CONFLICT (zone_id, hour, price_type, source)
        DO UPDATE SET
          price_try_mwh = EXCLUDED.price_try_mwh
      `);
      rowsAdded++;
    } catch { /* tek satır hatalarını atla */ }
  }

  await logJob(rowsAdded > 0 ? "success" : "partial", rowsAdded, undefined, startedAt);
  return {
    rowsAdded,
    status:  rowsAdded > 0 ? "ok" : "partial",
    message: `${rowsAdded} saatlik EPIAŞ PTF verisi eklendi/güncellendi.`,
  };
}

// ── EPIAŞ v1 API (public, auth gerektirmez) ──────────────────────────────────

async function fetchEpiasV1(dateStr: string): Promise<Array<{ hour: Date; priceTry: number }>> {
  const url = `https://seffaflik.epias.com.tr/transparency/service/market/ptf?startDate=${dateStr}&endDate=${dateStr}`;
  const resp = await fetch(url, {
    signal:  AbortSignal.timeout(15_000),
    headers: { "Accept": "application/json" },
  });
  if (!resp.ok) throw new Error(`EPIAŞ v1 HTTP ${resp.status}`);

  const data = await resp.json() as {
    body?: {
      ptfList?: Array<{ date: string; ptf: number }>
    }
  };

  return (data.body?.ptfList ?? []).map(item => ({
    hour:     parseEpiasDatetime(item.date),
    priceTry: item.ptf,
  })).filter(r => !isNaN(r.hour.getTime()) && isFinite(r.priceTry));
}

// ── EPIAŞ v2 API (auth gerektirir, daha güvenilir) ──────────────────────────

async function fetchEpiasV2(
  credentials: EpiasCredentials,
  dateStr: string,
): Promise<Array<{ hour: Date; priceTry: number }>> {
  // OAuth token al
  const loginResp = await fetch(
    "https://seffaflik.epias.com.tr/transparency/service/auth/login",
    {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify(credentials),
      signal:  AbortSignal.timeout(10_000),
    }
  );
  if (!loginResp.ok) throw new Error(`EPIAŞ v2 login HTTP ${loginResp.status}`);
  const loginData = await loginResp.json() as { body?: { tgt?: string } };
  const token = loginData.body?.tgt;
  if (!token) throw new Error("EPIAŞ v2 login token alınamadı");

  const url = `https://seffaflik.epias.com.tr/transparency/service/market/day-ahead-mcp?startDate=${dateStr}&endDate=${dateStr}`;
  const resp = await fetch(url, {
    headers: { "TGT": token, "Accept": "application/json" },
    signal:  AbortSignal.timeout(15_000),
  });
  if (!resp.ok) throw new Error(`EPIAŞ v2 data HTTP ${resp.status}`);

  const data = await resp.json() as {
    body?: {
      dayAheadMCPList?: Array<{ date: string; price: number }>
    }
  };

  return (data.body?.dayAheadMCPList ?? []).map(item => ({
    hour:     parseEpiasDatetime(item.date),
    priceTry: item.price,
  })).filter(r => !isNaN(r.hour.getTime()) && isFinite(r.priceTry));
}

// ── Yardımcılar ──────────────────────────────────────────────────────────────

function formatEpiasDate(d: Date): string {
  // EPIAŞ: "2023-01-01" formatı, Türkiye yerel tarihi (UTC+3)
  const local = new Date(d.getTime() + 3 * 60 * 60 * 1000);
  return local.toISOString().slice(0, 10);
}

function parseEpiasDatetime(str: string): Date {
  // Olası formatlar: "2023-01-01T01:00:00+03:00" veya "01.01.2023 01:00"
  if (str.includes("T")) return new Date(str);
  // DD.MM.YYYY HH:MM formatı
  const [datePart, timePart] = str.split(" ");
  const [dd, mm, yyyy] = (datePart ?? "").split(".");
  return new Date(`${yyyy}-${mm}-${dd}T${timePart ?? "00:00"}:00+03:00`);
}

async function logJob(
  status:   "success" | "error" | "partial",
  rows:     number,
  errorMsg: string | undefined,
  startedAt: Date,
) {
  try {
    await prisma.$executeRaw(Prisma.sql`
      INSERT INTO data_import_jobs (job_type, zone_id, status, started_at, finished_at, rows_inserted, error_message)
      VALUES ('dam-prices', ${ZONE_CODE}, ${status}, ${startedAt}, ${new Date()}, ${rows}, ${errorMsg ?? null})
    `);
  } catch { /* log hatası uygulamayı durdurmasın */ }
}
