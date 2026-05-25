// Task #129 — DAM fiyat grafiği (30 gün geçmiş + bugün + D+1 forecast)
import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import type { MarketPrice } from "../../lib/api.js";

interface Props { zone: string; }

export default function DamPriceChartPage({ zone }: Props) {
  const [prices, setPrices]   = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";
  const bg     = isDark ? "#0f1117" : "#f8fafc";

  useEffect(() => {
    setLoading(true);
    setError(null);
    const from = new Date(); from.setDate(from.getDate() - 30);
    const to   = new Date(); to.setDate(to.getDate() + 2);

    api.marketPrices.list({ zone, from: from.toISOString(), to: to.toISOString(), limit: 2000 })
      .then(r => setPrices(r.prices))
      .catch(err => setError(err.message ?? "Veri alınamadı"))
      .finally(() => setLoading(false));
  }, [zone]);

  if (loading) return <LoadingState card={card} sub={sub} border={border} />;
  if (error)   return <ErrorState error={error} card={card} text={text} sub={sub} border={border} />;
  if (prices.length === 0) return <EmptyState zone={zone} card={card} text={text} sub={sub} border={border} />;

  const actual   = prices.filter(p => p.priceType === "dam_actual");
  const forecast = prices.filter(p => p.priceType === "dam_forecast");
  const now      = new Date();

  const allPrices = prices.map(p => p.priceEurMwh).filter((v): v is number => v !== null);
  const minPrice  = allPrices.length ? Math.min(...allPrices) : 0;
  const maxPrice  = allPrices.length ? Math.max(...allPrices) : 100;
  const priceRange = maxPrice - minPrice || 1;

  // Yalnızca son 7 gün + D+2 görüntüle (performans)
  const displayFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const displayPrices = prices.filter(p => new Date(p.hour) >= displayFrom);

  // Saatler timeline
  const hours = [...new Set(displayPrices.map(p => p.hour))].sort();

  function priceAt(list: MarketPrice[], hourStr: string): number | null {
    return list.find(p => p.hour === hourStr)?.priceEurMwh ?? null;
  }

  function toY(price: number | null, h: number): number {
    if (price === null) return -1;
    return h - ((price - minPrice) / priceRange) * (h - 20) - 10;
  }

  const W = 900, H = 260;

  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, color: text, fontSize: 15 }}>DAM Piyasa Fiyatları</div>
          <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{zone} — Son 7 gün + D+1 tahmini</div>
        </div>
        <div style={{ display: "flex", gap: 16, fontSize: 12 }}>
          <LegendItem color="#3b82f6" label="Gerçekleşen (EUR/MWh)" />
          <LegendItem color="#f59e0b" label="Tahmin" dashed />
        </div>
      </div>

      {/* SVG Chart */}
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {/* Grid çizgileri */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = H - t * (H - 30) - 10;
          const label = (minPrice + t * priceRange).toFixed(0);
          return (
            <g key={t}>
              <line x1={40} y1={y} x2={W - 10} y2={y} stroke={border} strokeWidth={0.5} />
              <text x={36} y={y + 4} fontSize={10} fill={sub} textAnchor="end">{label}</text>
            </g>
          );
        })}

        {/* Bugün dikey çizgisi */}
        {(() => {
          const nowIdx = hours.findIndex(h => new Date(h) > now);
          if (nowIdx < 0) return null;
          const x = 40 + (nowIdx / Math.max(hours.length - 1, 1)) * (W - 50);
          return <line x1={x} y1={10} x2={x} y2={H - 10} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" />;
        })()}

        {/* Gerçekleşen fiyat çizgisi */}
        <polyline
          points={hours
            .map((h, i) => {
              const price = priceAt(actual, h);
              const x     = 40 + (i / Math.max(hours.length - 1, 1)) * (W - 50);
              const y     = toY(price, H);
              return price !== null && y > 0 ? `${x},${y}` : null;
            })
            .filter(Boolean)
            .join(" ")
          }
          fill="none"
          stroke="#3b82f6"
          strokeWidth={2}
        />

        {/* Tahmin çizgisi */}
        <polyline
          points={hours
            .map((h, i) => {
              const price = priceAt(forecast, h);
              const x     = 40 + (i / Math.max(hours.length - 1, 1)) * (W - 50);
              const y     = toY(price, H);
              return price !== null && y > 0 ? `${x},${y}` : null;
            })
            .filter(Boolean)
            .join(" ")
          }
          fill="none"
          stroke="#f59e0b"
          strokeWidth={2}
          strokeDasharray="6 3"
        />

        {/* X ekseni etiketleri — her 24 saatte bir */}
        {hours
          .filter((_, i) => i % 24 === 0)
          .map((h, idx) => {
            const origIdx = hours.indexOf(h);
            const x = 40 + (origIdx / Math.max(hours.length - 1, 1)) * (W - 50);
            const label = new Date(h).toLocaleDateString("tr-TR", { month: "short", day: "numeric" });
            return <text key={idx} x={x} y={H + 2} fontSize={10} fill={sub} textAnchor="middle">{label}</text>;
          })
        }
      </svg>

      {/* Özet satırı */}
      <div style={{ display: "flex", gap: 24, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}` }}>
        {[
          { label: "Min (Gerçekleşen)", value: `${Math.min(...actual.map(p => p.priceEurMwh ?? Infinity).filter(isFinite)).toFixed(2)} EUR/MWh` },
          { label: "Max (Gerçekleşen)", value: `${Math.max(...actual.map(p => p.priceEurMwh ?? -Infinity).filter(isFinite)).toFixed(2)} EUR/MWh` },
          { label: "D+1 Tahmin Ort.",  value: forecast.length ? `${(forecast.reduce((s, p) => s + (p.priceEurMwh ?? 0), 0) / forecast.length).toFixed(2)} EUR/MWh` : "—" },
        ].map(({ label, value }) => (
          <div key={label}>
            <div style={{ fontSize: 11, color: sub }}>{label}</div>
            <div style={{ fontSize: 15, fontWeight: 600, color: text }}>{value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LegendItem({ color, label, dashed }: { color: string; label: string; dashed?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
      <svg width={20} height={12}>
        <line x1={0} y1={6} x2={20} y2={6} stroke={color} strokeWidth={2} strokeDasharray={dashed ? "4 2" : undefined} />
      </svg>
      <span style={{ color: "#64748b" }}>{label}</span>
    </div>
  );
}

function LoadingState({ card, sub, border }: { card: string; sub: string; border: string }) {
  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
      <div style={{ color: sub, fontSize: 14 }}>Fiyat verileri yükleniyor…</div>
    </div>
  );
}

function ErrorState({ error, card, text, sub, border }: { error: string; card: string; text: string; sub: string; border: string }) {
  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>⚠️</div>
      <div style={{ color: text, fontWeight: 600, marginBottom: 4 }}>Veri alınamadı</div>
      <div style={{ color: sub, fontSize: 13 }}>{error}</div>
      <div style={{ color: sub, fontSize: 12, marginTop: 12 }}>
        Piyasa fiyatı verisi ENTSO-E token yapılandırıldığında otomatik olarak çekilecektir.
      </div>
    </div>
  );
}

function EmptyState({ zone, card, text, sub, border }: { zone: string; card: string; text: string; sub: string; border: string }) {
  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>📊</div>
      <div style={{ color: text, fontWeight: 600, marginBottom: 4 }}>{zone} zone için fiyat verisi yok</div>
      <div style={{ color: sub, fontSize: 13 }}>
        ENTSO-E API token'ı Entegrasyonlar sayfasından yapılandırın.
        İlk veri çekme işlemi her gün 15:00 UTC'de otomatik çalışır.
      </div>
    </div>
  );
}
