// Task #130 — RE üretim forecast grafiği (güneş + rüzgar yığın)
import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import type { GenerationSummary } from "../../lib/api.js";

interface Props { zone: string; }

const PSR_LABELS: Record<string, string> = {
  B16: "Güneş ☀️",
  B19: "Rüzgar (Kara) 💨",
  B18: "Rüzgar (Deniz) 🌊",
};

export default function GenerationChartPage({ zone }: Props) {
  const [summary, setSummary] = useState<GenerationSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";

  useEffect(() => {
    setLoading(true);
    api.generation.getSummary(zone)
      .then(setSummary)
      .catch(err => setError(err.message ?? "Veri alınamadı"))
      .finally(() => setLoading(false));
  }, [zone]);

  if (loading) return <Placeholder card={card} sub={sub} border={border} msg="Üretim verileri yükleniyor…" />;

  if (error || !summary || summary.series.length === 0) {
    return (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>🌱</div>
        <div style={{ color: text, fontWeight: 600, marginBottom: 4 }}>{zone} zone için üretim tahmini yok</div>
        <div style={{ color: sub, fontSize: 13 }}>
          ENTSO-E API token yapılandırıldığında güneş ve rüzgar üretim tahminleri
          her gün 15:00 UTC'de otomatik çekilecektir.
        </div>
      </div>
    );
  }

  const series = summary.series.slice(0, 48); // max 48 saat
  const maxLoad = Math.max(...series.map(s => s.loadMw || 0), 1);

  const W = 900, H = 240;

  function barX(i: number, barW: number): number {
    return 40 + i * (barW + 1);
  }

  const barW = Math.max(2, (W - 50) / series.length - 1);

  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
        <div>
          <div style={{ fontWeight: 600, color: text, fontSize: 15 }}>Yenilenebilir Üretim Tahmini</div>
          <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{zone} — 48 saatlik pencere</div>
        </div>
        <div style={{ display: "flex", gap: 12, fontSize: 12 }}>
          <ColorBadge color="#f59e0b" label="Güneş (MW)" />
          <ColorBadge color="#3b82f6" label="Rüzgar (MW)" />
          <ColorBadge color="#e2e8f0" label="Toplam Yük" line />
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", overflow: "visible" }}>
        {/* Grid */}
        {[0, 0.25, 0.5, 0.75, 1].map(t => {
          const y = H - 20 - t * (H - 40);
          return (
            <g key={t}>
              <line x1={40} y1={y} x2={W - 10} y2={y} stroke={border} strokeWidth={0.5} />
              <text x={36} y={y + 4} fontSize={10} fill={sub} textAnchor="end">
                {(t * maxLoad / 1000).toFixed(0)}GW
              </text>
            </g>
          );
        })}

        {/* Yığın çubuk grafik */}
        {series.map((s, i) => {
          const x         = barX(i, barW);
          const totalH    = H - 40;
          const solarH    = (s.solarMw / maxLoad) * totalH;
          const windH     = (s.windMw  / maxLoad) * totalH;
          const baseY     = H - 20;

          return (
            <g key={s.hour}>
              {/* Rüzgar (alt) */}
              {windH > 0 && (
                <rect x={x} y={baseY - windH} width={barW} height={windH} fill="#3b82f6" opacity={0.8} />
              )}
              {/* Güneş (üst) */}
              {solarH > 0 && (
                <rect x={x} y={baseY - windH - solarH} width={barW} height={solarH} fill="#f59e0b" opacity={0.8} />
              )}
            </g>
          );
        })}

        {/* Yük çizgisi */}
        <polyline
          points={series.map((s, i) => {
            const x = barX(i, barW) + barW / 2;
            const y = H - 20 - (s.loadMw / maxLoad) * (H - 40);
            return `${x},${y}`;
          }).join(" ")}
          fill="none"
          stroke={isDark ? "#4b5563" : "#94a3b8"}
          strokeWidth={1.5}
          strokeDasharray="4 2"
        />

        {/* X ekseni — her 6 saatte bir etiket */}
        {series
          .filter((_, i) => i % 6 === 0)
          .map((s, idx) => {
            const origIdx = series.indexOf(s);
            const x = barX(origIdx, barW) + barW / 2;
            const label = new Date(s.hour).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" });
            const dateLbl = idx === 0 || new Date(s.hour).getHours() === 0
              ? new Date(s.hour).toLocaleDateString("tr-TR", { month: "short", day: "numeric" }) : "";
            return (
              <g key={idx}>
                <text x={x} y={H - 4} fontSize={9} fill={sub} textAnchor="middle">{label}</text>
                {dateLbl && <text x={x} y={H + 6} fontSize={9} fill={sub} textAnchor="middle">{dateLbl}</text>}
              </g>
            );
          })
        }
      </svg>

      {/* Özet kartları */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${border}` }}>
        {[
          { label: "Peak Güneş", value: summary.summary.peakSolarMw != null ? `${(summary.summary.peakSolarMw / 1000).toFixed(1)} GW` : "—", icon: "☀️" },
          { label: "Peak Rüzgar", value: summary.summary.peakWindMw != null ? `${(summary.summary.peakWindMw / 1000).toFixed(1)} GW` : "—", icon: "💨" },
          { label: "Max RE Payı", value: summary.summary.maxRePct != null ? `${summary.summary.maxRePct.toFixed(1)}%` : "—", icon: "🌱" },
          { label: "Ort. RE Payı", value: summary.summary.avgRePct != null ? `${summary.summary.avgRePct.toFixed(1)}%` : "—", icon: "📊" },
        ].map(({ label, value, icon }) => (
          <div key={label} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 20 }}>{icon}</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{value}</div>
            <div style={{ fontSize: 11, color: sub }}>{label}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ColorBadge({ color, label, line }: { color: string; label: string; line?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#64748b" }}>
      {line
        ? <svg width={16} height={10}><line x1={0} y1={5} x2={16} y2={5} stroke={color} strokeWidth={1.5} strokeDasharray="3 2" /></svg>
        : <span style={{ width: 12, height: 12, borderRadius: 2, background: color, display: "inline-block" }} />
      }
      {label}
    </div>
  );
}

function Placeholder({ card, sub, border, msg }: { card: string; sub: string; border: string; msg: string }) {
  return (
    <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
      <div style={{ color: sub, fontSize: 14 }}>{msg}</div>
    </div>
  );
}
