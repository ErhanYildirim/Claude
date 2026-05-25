// Task #131b — Optimal zamanlama penceresi
import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import type { OptimalWindowResult } from "../../lib/api.js";

interface Props { zone: string; }

const DURATION_OPTIONS = [2, 4, 6, 8, 12];

export default function OptimalWindowPage({ zone }: Props) {
  const [duration, setDuration]   = useState(4);
  const [result, setResult]       = useState<OptimalWindowResult | null>(null);
  const [loading, setLoading]     = useState(true);

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";

  useEffect(() => {
    setLoading(true);
    api.efLive.getOptimalWindow(zone, duration, 48)
      .then(setResult)
      .catch(() => setResult(null))
      .finally(() => setLoading(false));
  }, [zone, duration]);

  function ciColor(ci: number): string {
    if (ci < 100) return "#10b981";
    if (ci < 250) return "#84cc16";
    if (ci < 400) return "#f59e0b";
    return "#ef4444";
  }

  function ciLabel(ci: number): string {
    if (ci < 100) return "Mükemmel";
    if (ci < 200) return "İyi";
    if (ci < 350) return "Orta";
    if (ci < 500) return "Yüksek";
    return "Çok Yüksek";
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Kontrol paneli */}
      <div style={{ background: card, border: `1px solid ${border}`, borderRadius: 12, padding: 20 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
          <div>
            <div style={{ fontWeight: 600, color: text, fontSize: 15 }}>Optimal Zamanlama Penceresi</div>
            <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
              Düşük karbon yoğunluğu dönemlerinde enerji yoğun operasyonları planlayın
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 13, color: sub }}>Süre:</span>
            {DURATION_OPTIONS.map(d => (
              <button
                key={d}
                onClick={() => setDuration(d)}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12,
                  border: `1px solid ${d === duration ? "#3b82f6" : border}`,
                  background: d === duration ? "#3b82f6" : card,
                  color: d === duration ? "white" : sub,
                  cursor: "pointer",
                }}
              >
                {d}s
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div style={{ color: sub, fontSize: 14, textAlign: "center", padding: 20 }}>
            Optimal pencereler hesaplanıyor…
          </div>
        )}

        {!loading && result && result.windows.length === 0 && (
          <div style={{ color: sub, fontSize: 14, textAlign: "center", padding: 20 }}>
            {zone} zone için CI tahmin verisi yok. İlk tahmin her gün 15:00 UTC'de oluşturulur.
          </div>
        )}

        {!loading && result && result.windows.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {result.windows.map((w, i) => {
              const start = new Date(w.startHour);
              const end   = new Date(w.endHour);
              const color = ciColor(w.avgCi);
              const label = ciLabel(w.avgCi);
              const isToday = start.toDateString() === new Date().toDateString();

              return (
                <div
                  key={i}
                  style={{
                    display: "flex", alignItems: "center", gap: 16,
                    padding: "14px 18px", borderRadius: 10,
                    border: `1px solid ${color}40`,
                    background: `${color}10`,
                  }}
                >
                  {/* Sıra rozeti */}
                  <div style={{
                    width: 32, height: 32, borderRadius: "50%",
                    background: color, color: "white",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontWeight: 700, fontSize: 14, flexShrink: 0,
                  }}>
                    {i + 1}
                  </div>

                  {/* Zaman aralığı */}
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, color: text, fontSize: 14 }}>
                      {isToday ? "Bugün " : `${start.toLocaleDateString("tr-TR", { month: "short", day: "numeric" })} `}
                      {start.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                      {" — "}
                      {end.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                    <div style={{ fontSize: 12, color: sub, marginTop: 2 }}>
                      {duration} saatlik pencere · {label}
                    </div>
                  </div>

                  {/* CI değerleri */}
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: 18, fontWeight: 700, color }}>
                      {w.avgCi.toFixed(0)} gCO₂/kWh
                    </div>
                    <div style={{ fontSize: 11, color: sub }}>ort. · min {w.minCi.toFixed(0)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Bilgi kartı */}
      <div style={{
        background: isDark ? "#1e2a3a" : "#eff6ff",
        border: `1px solid ${isDark ? "#2d4a6d" : "#bfdbfe"}`,
        borderRadius: 12, padding: 16,
      }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: isDark ? "#93c5fd" : "#1d4ed8", marginBottom: 6 }}>
          💡 Optimal Pencere Nedir?
        </div>
        <div style={{ fontSize: 12, color: isDark ? "#94a3b8" : "#64748b", lineHeight: 1.6 }}>
          Karbon yoğunluğu (CI) düşük olduğu saatlerde enerji tüketimini planlayarak
          aynı üretimi daha düşük emisyonla gerçekleştirebilirsiniz.
          Bu analiz son ENTSO-E üretim verisi ve yenilenebilir enerji tahminlerine dayanır.
          <br /><br />
          <strong>Kullanım alanları:</strong> Veri merkezi workload shifting, EV şarjı, sanayi prosesleri,
          soğutma/ısıtma sistemleri, depo operasyonları.
        </div>
      </div>
    </div>
  );
}
