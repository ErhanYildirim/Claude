import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { Installation, CFEResult } from "../lib/api.js";
import { fmt } from "../lib/chart-utils.js";

interface PeriodEntry {
  installationId: string;
  facilityName: string;
  periodId: string;
  periodName: string;
  cfe: CFEResult | null;
}

function cfeColor(score: number) {
  return score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
}

function CfeScoreRing({ score, size = 72 }: { score: number; size?: number }) {
  const r = size / 2 - 6;
  const circ = 2 * Math.PI * r;
  const color = cfeColor(score);
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{ display: "block", flexShrink: 0 }}>
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(0,0,0,.06)" strokeWidth={6} />
      <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${size/2} ${size/2})`} />
      <text x={size/2} y={size/2} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: size * 0.22, fontWeight: 800, fill: color }}>
        {score.toFixed(0)}%
      </text>
    </svg>
  );
}

export default function CfePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [entries, setEntries] = useState<PeriodEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1a3530" : "#eef7f3";
  const card: React.CSSProperties = { background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: "20px", marginBottom: 16 };

  useEffect(() => {
    async function load() {
      const list: Installation[] = await api.installations.list();
      const details = await Promise.all(list.map(i => api.installations.get(i.id)));
      const all: PeriodEntry[] = [];
      for (const inst of details) {
        for (const p of inst.periods) {
          let cfe: CFEResult | null = null;
          try { cfe = await api.cfe.get(inst.id, p.id); } catch { /* skip */ }
          all.push({ installationId: inst.id, facilityName: inst.facilityName, periodId: p.id, periodName: p.periodName, cfe });
        }
      }
      setEntries(all);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const withCfe = entries.filter(e => e.cfe !== null);
  const totalMatchedKwh = withCfe.reduce((s, e) => s + e.cfe!.totalMatchedKwh, 0);
  const totalConsumptionKwh = withCfe.reduce((s, e) => s + e.cfe!.totalConsumptionKwh, 0);
  const portfolioScore = totalConsumptionKwh > 0 ? (totalMatchedKwh / totalConsumptionKwh) * 100 : 0;
  const totalUnmatchedHours = withCfe.reduce((s, e) => s + e.cfe!.unmatchedHours, 0);

  // Build monthly trend data (aggregate across all periods)
  const monthlyMap = new Map<string, { consumption: number; matched: number }>();
  for (const e of withCfe) {
    for (const mb of e.cfe!.monthlyBreakdown) {
      const key = mb.month.slice(0, 7);
      const existing = monthlyMap.get(key) ?? { consumption: 0, matched: 0 };
      monthlyMap.set(key, { consumption: existing.consumption + mb.consumptionKwh, matched: existing.matched + mb.matchedKwh });
    }
  }
  const trendData = Array.from(monthlyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { consumption, matched }]) => ({
      month,
      cfeRate: consumption > 0 ? (matched / consumption) * 100 : 0,
      matchedMwh: matched / 1000,
    }));

  if (loading) return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px", color: muted }}>Yükleniyor...</div>;

  const noData = entries.length === 0;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28, flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>CFE Portföy Özeti</div>
          <div style={{ fontSize: 14, color: muted }}>
            {withCfe.length} dönem · EnergyTag GC Standardı · Saatlik eşleştirme
          </div>
        </div>
        <Link
          to="/cfe/data-entry"
          style={{ padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#00b87a", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          + Veri Yükle
        </Link>
      </div>

      {/* KPI strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
        {[
          { label: "Portföy CFE Skoru", value: `${fmt(portfolioScore, 1)}%`, color: cfeColor(portfolioScore), desc: "Ağırlıklı ort." },
          { label: "Toplam Eşleşen", value: `${fmt(totalMatchedKwh / 1000, 0)} MWh`, color: "#059669", desc: "Tüm dönemler" },
          { label: "Toplam Tüketim", value: `${fmt(totalConsumptionKwh / 1000, 0)} MWh`, color: text, desc: "Tüm dönemler" },
          { label: "Eşleşmeyen Saat", value: totalUnmatchedHours.toLocaleString(), color: totalUnmatchedHours > 0 ? "#DC2626" : "#059669", desc: "Tüm dönemler" },
        ].map(k => (
          <div key={k.label} style={{ background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, color: muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginBottom: 2 }}>{k.value}</div>
            <div style={{ fontSize: 11, color: muted }}>{k.desc}</div>
          </div>
        ))}
      </div>

      {noData ? (
        /* Empty state */
        <div style={{ ...card, textAlign: "center", padding: "80px 40px" }}>
          <div style={{ fontSize: 48, marginBottom: 20 }}>⚡</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: text, marginBottom: 8 }}>CFE Verisi Bulunamadı</div>
          <div style={{ fontSize: 14, color: muted, marginBottom: 28, lineHeight: 1.7 }}>
            24/7 CFE analizi için önce tüketim ve üretim verilerinizi yükleyin.<br />
            EnergyTag GC Standardı — saatlik eşleştirme metodolojisi.
          </div>
          <Link
            to="/cfe/data-entry"
            style={{ padding: "12px 28px", borderRadius: 8, background: "#00b87a", color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none", display: "inline-block" }}
          >
            İlk Veriyi Yükle
          </Link>
        </div>
      ) : (
        <>
          {/* Period cards grid */}
          <div style={{ marginBottom: 24 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>
              Dönem Bazında CFE Skorları
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
              {entries.map(e => {
                const score = e.cfe?.cfeScore ?? null;
                const color = score !== null ? cfeColor(score) : muted;
                return (
                  <div key={`${e.installationId}|${e.periodId}`} style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: "16px 18px", display: "flex", gap: 14, alignItems: "center" }}>
                    {score !== null ? (
                      <CfeScoreRing score={score} size={68} />
                    ) : (
                      <div style={{ width: 68, height: 68, borderRadius: "50%", background: inputBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, fontSize: 22 }}>—</div>
                    )}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 700, color: text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.facilityName}</div>
                      <div style={{ fontSize: 12, color: muted, marginBottom: 8 }}>{e.periodName}</div>
                      {e.cfe ? (
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, background: color + "18", color, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                            {e.cfe.matchedHours}h eşleşti
                          </span>
                          <span style={{ fontSize: 11, background: isDark ? "rgba(255,255,255,.06)" : "#f4fbf8", color: muted, padding: "2px 8px", borderRadius: 10 }}>
                            {fmt(e.cfe.totalConsumptionKwh / 1000, 0)} MWh
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: muted }}>Veri yok</span>
                      )}
                      <div style={{ marginTop: 10, display: "flex", gap: 8 }}>
                        <Link
                          to="/cfe/matching"
                          style={{ fontSize: 12, color: "#00b87a", textDecoration: "none", fontWeight: 600 }}
                        >
                          Detay →
                        </Link>
                        {!e.cfe && (
                          <Link
                            to="/cfe/data-entry"
                            style={{ fontSize: 12, color: muted, textDecoration: "none" }}
                          >
                            Veri yükle
                          </Link>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Monthly trend chart */}
          {trendData.length > 0 && (
            <div style={card}>
              <div style={{ fontSize: 14, fontWeight: 600, color: text, marginBottom: 16 }}>
                Portföy Aylık CFE Trendi
              </div>
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={trendData} margin={{ top: 5, right: 30, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,.06)" : "#eef7f3"} />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: muted }} />
                  <YAxis yAxisId="mwh" tick={{ fontSize: 11, fill: muted }} />
                  <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: muted }} />
                  <Tooltip contentStyle={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: text }} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar yAxisId="mwh" dataKey="matchedMwh" name="Eşleşen (MWh)" fill="#059669" opacity={0.75} />
                  <Line yAxisId="pct" type="monotone" dataKey="cfeRate" name="CFE %" stroke="#00b87a" dot={{ r: 3, fill: "#00b87a" }} strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Methodology note */}
          <div style={{ ...card, background: isDark ? "#0d2a20" : "#f0fdf4", border: `1px solid ${isDark ? "#065f46" : "#bbf7d0"}` }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>Metodoloji</div>
            <div style={{ fontSize: 13, color: isDark ? "#6ee7b7" : "#065f46", lineHeight: 1.7 }}>
              <strong>EnergyTag Granular Certificate Standard</strong> — Her saat için tüketim (kWh) eşleşen üretim/sertifika (kWh) ile karşılaştırılır.
              CFE Skoru = Eşleşen Tüketim / Toplam Tüketim × 100. Aynı grid bölgesi, aynı saat prensibi uygulanır.
            </div>
          </div>
        </>
      )}
    </div>
  );
}
