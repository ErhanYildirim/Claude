// 24/7 CFE (Carbon-Free Energy) Matching hesaplama motoru
// Her saat için min(tüketim, eşleşen_üretim) → CFE skoru
// Metodoloji: EnergyTag Granular Certificate scheme + RE100 hourly matching guidance

export interface HourlySlot {
  hour: string;         // ISO 8601 — "2025-01-01T00:00:00Z"
  consumptionKwh: number;
  productionKwh: number; // PPA / EAC / I-REC eşleşen üretim
}

export interface CFEMatchingInput {
  installationId: string;
  periodLabel: string;
  slots: HourlySlot[];       // 8760 (yıllık) veya kısmi dönem
  gecDataVersion?: string;
}

export interface HourlyMatchResult {
  hour: string;
  consumptionKwh: number;
  productionKwh: number;
  matchedKwh: number;        // min(consumption, production)
  unmatchedKwh: number;      // consumption - matched
  cfeRate: number;           // 0–1 bu saat için
}

export interface MonthlyBreakdown {
  month: string;             // "2025-01"
  consumptionKwh: number;
  productionKwh: number;
  matchedKwh: number;
  cfeRate: number;
}

export interface CFEMatchingResult {
  installationId: string;
  periodLabel: string;

  // Toplam metrikler
  totalConsumptionKwh: number;
  totalProductionKwh: number;
  totalMatchedKwh: number;
  totalUnmatchedKwh: number;
  cfeScore: number;          // 0–100 — yıllık toplam CFE %

  // Saatlik detay
  hourlyResults: HourlyMatchResult[];

  // Aylık özet
  monthlyBreakdown: MonthlyBreakdown[];

  // PPA performansı
  ppaSurplusKwh: number;     // üretim > tüketim olan saatlerin toplamı
  ppaDeficitKwh: number;     // tüketim > üretim olan saatlerin toplamı

  // Audit
  totalHours: number;
  matchedHours: number;      // cfeRate = 1.0 olan saatler
  partialHours: number;      // 0 < cfeRate < 1
  unmatchedHours: number;    // cfeRate = 0
  gecDataVersion: string;
  calculatedAt: string;
}

const CALC_ENGINE_VERSION = "1.0.0";

export function calculateCFEMatching(input: CFEMatchingInput): CFEMatchingResult {
  if (input.slots.length === 0) {
    throw new Error("CFE eşleştirme için en az bir saatlik slot gerekli.");
  }

  const now = new Date().toISOString();
  const hourlyResults: HourlyMatchResult[] = [];
  const monthMap = new Map<string, MonthlyBreakdown>();

  let totalConsumptionKwh = 0;
  let totalProductionKwh  = 0;
  let totalMatchedKwh     = 0;
  let matchedHours        = 0;
  let partialHours        = 0;
  let unmatchedHours      = 0;
  let ppaSurplusKwh       = 0;
  let ppaDeficitKwh       = 0;

  for (const slot of input.slots) {
    if (slot.consumptionKwh < 0 || slot.productionKwh < 0) {
      throw new Error(`Negatif enerji değeri: saat ${slot.hour}`);
    }

    const matchedKwh    = Math.min(slot.consumptionKwh, slot.productionKwh);
    const unmatchedKwh  = slot.consumptionKwh - matchedKwh;
    const cfeRate       = slot.consumptionKwh > 0 ? matchedKwh / slot.consumptionKwh : 0;

    hourlyResults.push({
      hour:            slot.hour,
      consumptionKwh:  slot.consumptionKwh,
      productionKwh:   slot.productionKwh,
      matchedKwh,
      unmatchedKwh,
      cfeRate,
    });

    totalConsumptionKwh += slot.consumptionKwh;
    totalProductionKwh  += slot.productionKwh;
    totalMatchedKwh     += matchedKwh;

    const surplus = slot.productionKwh - slot.consumptionKwh;
    if (surplus > 0) ppaSurplusKwh += surplus;
    if (unmatchedKwh > 0) ppaDeficitKwh += unmatchedKwh;

    if (cfeRate >= 1.0)      matchedHours++;
    else if (cfeRate > 0)    partialHours++;
    else                     unmatchedHours++;

    // Aylık breakdown
    const month = slot.hour.slice(0, 7); // "2025-01"
    const mb = monthMap.get(month) ?? {
      month,
      consumptionKwh: 0,
      productionKwh:  0,
      matchedKwh:     0,
      cfeRate:        0,
    };
    mb.consumptionKwh += slot.consumptionKwh;
    mb.productionKwh  += slot.productionKwh;
    mb.matchedKwh     += matchedKwh;
    monthMap.set(month, mb);
  }

  const cfeScore = totalConsumptionKwh > 0
    ? (totalMatchedKwh / totalConsumptionKwh) * 100
    : 0;

  // Aylık cfeRate hesapla
  const monthlyBreakdown = Array.from(monthMap.values()).map((mb) => ({
    ...mb,
    cfeRate: mb.consumptionKwh > 0 ? (mb.matchedKwh / mb.consumptionKwh) * 100 : 0,
  })).sort((a, b) => a.month.localeCompare(b.month));

  return {
    installationId:      input.installationId,
    periodLabel:         input.periodLabel,
    totalConsumptionKwh,
    totalProductionKwh,
    totalMatchedKwh,
    totalUnmatchedKwh:   totalConsumptionKwh - totalMatchedKwh,
    cfeScore,
    hourlyResults,
    monthlyBreakdown,
    ppaSurplusKwh,
    ppaDeficitKwh,
    totalHours:          input.slots.length,
    matchedHours,
    partialHours,
    unmatchedHours,
    gecDataVersion:      input.gecDataVersion ?? `GEC-${CALC_ENGINE_VERSION}`,
    calculatedAt:        now,
  };
}
