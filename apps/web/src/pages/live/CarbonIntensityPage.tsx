// Task #131a — Karbon yoğunluğu ısı haritası + gerçekleşen/tahmin
import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import type { EfLive, EfForecastList } from "../../lib/api.js";

interface Props { zone: string; }

export default function CarbonIntensityPage({ zone }: Props) {
  const [efLive, setEfLive]       = useState<EfLive | null>(null);
  const [forecast, setForecast]   = useState<EfForecastList | null>(null);
  const [loading, setLoading]     = useState(true);

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";

  useEffect(() => {
    setLoading(true);
    Promise.allSettled([
      api.efLive.getLive(zone),
      api.efLive.getForecast(zone, 48),
    ]).then(([liveRes, forecastRes]) => {
      if (liveRes.status    === "fulfilled") setEfLive(liveRes.value);
      if (forecastRes.status === "fulfilled") setForecast(forecastRes.value);
    }).finally(() => setLoading(false));
  }, [zone]);

  if (loading) {
    return (
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
        <div style={{ color: sub, fontSize: 14 }}>Karbon yoğunluğu verileri yükleniyor…</div>
      </div>
    );
  }

  const last24h  = efLive?.last24h ?? [];
  const forecasts = forecast?.forecasts ?? [];

  // Tüm saatler (gerçekleşen + tahmin)
  const allPoints = [
    ...last24h.map(p    => ({ hour: p.hour, ci: p.ci, type: "actual" as const })),
    ...forecasts.map(p  => ({ hour: p.hour, ci: p.ciGco2Kwh, type: "forecast" as const })),
  ].sort((a, b) => new Date(a.hour).getTime() - new Date(b.hour).getTime());

  const maxCi = Math.max(...allPoints.map(p => p.ci), 1);

  function ciColor(ci: number, opacity = 1): string {
    const t = Math.min(ci / 600, 1);
    if (t < 0.2)  return `rgba(16,185,129,${opacity})`;   // yeşil
    if (t < 0.45) return `rgba(132,204,22,${opacity})`;   // sarı-yeşil
    if (t < 0.65) return `rgba(245,158,11,${opacity})`;   // turuncu
    if (t < 0.85) return `rgba(239,68,68,${opacity})`;    // kırmızı
    return `rgba(127,29,29,${opacity})`;                    // koyu kırmızı
  }

  // Heatmap grid: 24 sütun (saat) × 2 satır (dün + bugün+yarın)
  const CELL_W = 32, CELL_H = 48, COLS = 24;
  const rows = [
    allPoints.slice(0, 24),
    allPoints.slice(24),
  ].filter(r => r.length > 0);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Anlık CI kartı */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, color: text, fontSize: 15 }}>Karbon Yoğunluğu</div>
            <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>{zone} — Gerçekleşen + 48h tahmin</div>
          </div>
          {efLive?.currentCi != null && (
            <div style={{
              padding: "8px 16px", borderRadius: 8,
              background: ciColor(efLive.currentCi, 0.15),
              border: `1px solid ${ciColor(efLive.currentCi)}`,
            }}>
              <div style={{ fontSize: 22, fontWeight: 700, color: ciColor(efLive.currentCi) }}>
                {efLive.currentCi.toFixed(0)} gCO₂/kWh
              </div>
              <div style={{ fontSize: 11, color: sub }}>Şu an</div>
            </div>
          )}
        </div>

        {/* CI çizgi grafik */}
        {allPoints.length > 0 && (
          <CiLineChart points={allPoints} maxCi={maxCi} ciColor={ciColor} border={border} sub={sub} />
        )}
      </div>

      {/* Isı haritası */}
      {rows.length > 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 600, color: text, fontSize: 15, marginBottom: 12 }}>Saat Bazlı Isı Haritası</div>
          <div style={{ overflowX: "auto" }}>
            <svg
              width={COLS * (CELL_W + 2) + 60}
              height={rows.length * (CELL_H + 4) + 30}
            >
              {/* Saat başlıkları */}
              {Array.from({ length: 24 }, (_, h) => (
                <text
                  key={h}
                  x={60 + h * (CELL_W + 2) + CELL_W / 2}
                  y={14}
                  fontSize={9}
                  fill={sub}
                  textAnchor="middle"
                >
                  {String(h).padStart(2, "0")}
                </text>
              ))}

              {rows.map((row, rowIdx) => {
                const rowLabel = rowIdx === 0 ? "Gerçekleşen" : "Tahmin";
                return (
                  <g key={rowIdx}>
                    <text
                      x={56}
                      y={20 + rowIdx * (CELL_H + 4) + CELL_H / 2 + 4}
                      fontSize={9}
                      fill={sub}
                      textAnchor="end"
                    >
                      {rowLabel}
                    </text>
                    {row.slice(0, 24).map((p, colIdx) => (
                      <g key={colIdx}>
                        <rect
                          x={60 + colIdx * (CELL_W + 2)}
                          y={20 + rowIdx * (CELL_H + 4)}
                          width={CELL_W}
                          height={CELL_H}
                          fill={ciColor(p.ci)}
                          rx={3}
                          opacity={p.type === "forecast" ? 0.75 : 1}
                        />
                        <text
                          x={60 + colIdx * (CELL_W + 2) + CELL_W / 2}
                          y={20 + rowIdx * (CELL_H + 4) + CELL_H / 2 + 4}
                          fontSize={9}
                          fill="white"
                          textAnchor="middle"
                          fontWeight="600"
                        >
                          {p.ci.toFixed(0)}
                        </text>
                      </g>
                    ))}
                  </g>
                );
              })}
            </svg>
          </div>

          {/* Renk skalası */}
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 12 }}>
            <span style={{ fontSize: 11, color: sub }}>Düşük CI</span>
            {[0, 100, 200, 300, 400, 500, 600].map(v => (
              <div
                key={v}
                style={{
                  width: 28, height: 14, borderRadius: 3,
                  background: ciColor(v),
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 8, color: "white", fontWeight: 600,
                }}
              >
                {v}
              </div>
            ))}
            <span style={{ fontSize: 11, color: sub }}>Yüksek CI</span>
          </div>
        </div>
      )}

      {last24h.length === 0 && forecasts.length === 0 && (
        <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 40, textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🌡️</div>
          <div style={{ color: text, fontWeight: 600, marginBottom: 4 }}>{zone} için CI verisi yok</div>
          <div style={{ color: sub, fontSize: 13 }}>
            Saatlik cron çalıştığında ENTSO-E'den gerçekleşen üretim verisi çekilecektir.
          </div>
        </div>
      )}
    </div>
  );
}

function CiLineChart({
  points, maxCi, ciColor, border, sub,
}: {
  points: Array<{ hour: string; ci: number; type: "actual" | "forecast" }>;
  maxCi: number;
  ciColor: (ci: number, opacity?: number) => string;
  border: string;
  sub: string;
}) {
  const W = 860, H = 180;
  const now = new Date();

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto" }}>
      {/* Grid */}
      {[0, 0.25, 0.5, 0.75, 1].map(t => {
        const y = H - 20 - t * (H - 40);
        return (
          <g key={t}>
            <line x1={40} y1={y} x2={W - 5} y2={y} stroke={border} strokeWidth={0.5} />
            <text x={36} y={y + 4} fontSize={9} fill={sub} textAnchor="end">
              {(t * maxCi).toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* "Şimdi" çizgisi */}
      {(() => {
        const nowIdx = points.findIndex(p => new Date(p.hour) > now);
        if (nowIdx < 0) return null;
        const x = 40 + (nowIdx / Math.max(points.length - 1, 1)) * (W - 45);
        return <line x1={x} y1={10} x2={x} y2={H - 20} stroke="#ef4444" strokeWidth={1} strokeDasharray="3 3" />;
      })()}

      {/* Gerçekleşen çizgi */}
      <polyline
        points={points
          .filter(p => p.type === "actual")
          .map((p, _, arr) => {
            const idx = points.indexOf(p);
            const x = 40 + (idx / Math.max(points.length - 1, 1)) * (W - 45);
            const y = H - 20 - (p.ci / maxCi) * (H - 40);
            return `${x},${y}`;
          })
          .join(" ")}
        fill="none"
        stroke="#3b82f6"
        strokeWidth={2}
      />

      {/* Tahmin çizgi */}
      <polyline
        points={points
          .filter(p => p.type === "forecast")
          .map(p => {
            const idx = points.indexOf(p);
            const x = 40 + (idx / Math.max(points.length - 1, 1)) * (W - 45);
            const y = H - 20 - (p.ci / maxCi) * (H - 40);
            return `${x},${y}`;
          })
          .join(" ")}
        fill="none"
        stroke="#f59e0b"
        strokeWidth={2}
        strokeDasharray="6 3"
      />

      {/* X ekseni — her 6 saatte bir */}
      {points
        .filter((_, i) => i % 6 === 0)
        .map((p, idx) => {
          const origIdx = points.indexOf(p);
          const x = 40 + (origIdx / Math.max(points.length - 1, 1)) * (W - 45);
          return (
            <text key={idx} x={x} y={H - 4} fontSize={9} fill={sub} textAnchor="middle">
              {new Date(p.hour).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
            </text>
          );
        })
      }
    </svg>
  );
}
