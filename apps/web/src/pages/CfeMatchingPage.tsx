import React, { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ComposedChart, Line, Legend, Cell,
} from "recharts";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { Installation, CFEResult, MonthlyBreakdown } from "../lib/api.js";
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

const MONTH_NAMES_TR = ["Oca","Şub","Mar","Nis","May","Haz","Tem","Ağu","Eyl","Eki","Kas","Ara"];

function CfeHeatmap({ monthly, isDark }: { monthly: MonthlyBreakdown[]; isDark: boolean }) {
  const [tip, setTip] = React.useState<{ x: number; y: number; data: MonthlyBreakdown } | null>(null);
  const byMonth = new Map<number, MonthlyBreakdown>();
  for (const m of monthly) byMonth.set(new Date(m.month).getUTCMonth() + 1, m);

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(mon => {
          const d = byMonth.get(mon);
          const rate = d?.cfeRate ?? null;
          const bg = rate === null ? (isDark ? "#1a3530" : "#f1f5f9")
            : rate >= 70 ? (isDark ? "#064e3b" : "#d1fae5")
            : rate >= 40 ? (isDark ? "#451a03" : "#fef3c7")
            : (isDark ? "#450a0a" : "#fee2e2");
          const textColor = rate === null ? (isDark ? "#4b6a62" : "#94a3b8")
            : rate >= 70 ? "#059669" : rate >= 40 ? "#d97706" : "#dc2626";
          const borderColor = rate === null ? (isDark ? "#1e3830" : "#e2e8f0")
            : rate >= 70 ? "#a7f3d0" : rate >= 40 ? "#fcd34d" : "#fca5a5";
          return (
            <div
              key={mon}
              style={{ background: bg, borderRadius: 8, padding: "12px 8px", textAlign: "center",
                       cursor: d ? "pointer" : "default", border: `1px solid ${borderColor}` }}
              onMouseEnter={e => d && setTip({ x: (e.target as HTMLElement).getBoundingClientRect().left, y: (e.target as HTMLElement).getBoundingClientRect().top, data: d })}
              onMouseLeave={() => setTip(null)}
            >
              <div style={{ fontSize: 11, color: textColor, fontWeight: 600, marginBottom: 4 }}>
                {MONTH_NAMES_TR[mon - 1]}
              </div>
              {rate !== null ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 800, color: textColor, lineHeight: 1 }}>{rate.toFixed(0)}%</div>
                  <div style={{ marginTop: 5, height: 4, background: "rgba(0,0,0,.12)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`, background: cfeColor(rate), borderRadius: 2 }} />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: isDark ? "#2d5046" : "#cbd5e1" }}>—</div>
              )}
            </div>
          );
        })}
      </div>
      {tip && (
        <div style={{ position: "fixed", left: tip.x + 8, top: tip.y - 80, background: "#0a1f1a",
                      color: "#fff", borderRadius: 8, padding: "10px 14px", fontSize: 12,
                      zIndex: 999, pointerEvents: "none", whiteSpace: "nowrap" }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>
            {new Date(tip.data.month).toLocaleString("tr-TR", { month: "long", year: "numeric", timeZone: "UTC" })}
          </div>
          <div>CFE: <strong>{tip.data.cfeRate.toFixed(1)}%</strong></div>
          <div>Tüketim: {(tip.data.consumptionKwh / 1000).toFixed(1)} MWh</div>
          <div>Eşleşen: {(tip.data.matchedKwh / 1000).toFixed(1)} MWh</div>
        </div>
      )}
    </div>
  );
}

function CfeGauge({ score }: { score: number }) {
  const r = 70, cx = 80, cy = 80, circ = 2 * Math.PI * r;
  const color = cfeColor(score);
  return (
    <svg viewBox="0 0 160 160" width={160} height={160} style={{ display: "block", margin: "0 auto" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef7f3" strokeWidth={16} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={16}
        strokeDasharray={`${(score / 100) * circ} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 26, fontWeight: 700, fill: color }}>
        {score.toFixed(1)}%
      </text>
    </svg>
  );
}

export default function CfeMatchingPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [entries, setEntries]   = useState<PeriodEntry[]>([]);
  const [loading, setLoading]   = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [eacRef, setEacRef]     = useState("");

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1e3830" : "#f4fbf8";
  const stripeBg = isDark ? "#1a3530" : "#f9fdfb";
  const card: React.CSSProperties  = { background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "20px", marginBottom: 20 };
  const cardH: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: text, marginBottom: 16 };

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
      if (all.length > 0) setSelectedKey(`${all[0].installationId}|${all[0].periodId}`);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const withCfe = entries.filter(e => e.cfe !== null);
  const selected = entries.find(e => `${e.installationId}|${e.periodId}` === selectedKey) ?? null;

  const barData = withCfe.map(e => ({
    name: `${e.facilityName.slice(0, 8)}/${e.periodName.slice(0, 6)}`,
    cfeScore: e.cfe!.cfeScore,
  }));

  const monthlyData = (selected?.cfe?.monthlyBreakdown ?? []).map((mb: MonthlyBreakdown) => ({
    month: mb.month.slice(0, 7),
    consumptionKwh: mb.consumptionKwh,
    productionKwh: mb.productionKwh,
    matchedKwh: mb.matchedKwh,
    cfeRate: mb.cfeRate,
  }));

  if (loading) return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", color: muted }}>Yükleniyor...</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>Eşleştirme Detayı</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 24 }}>Saatlik CFE eşleştirme analizi — dönem bazında</div>

      {/* Period selector */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 24, flexWrap: "wrap" }}>
        <select
          style={{ padding: "9px 12px", borderRadius: 7, border: `1px solid ${border}`, fontSize: 14, background: inputBg, color: text, cursor: "pointer" }}
          value={selectedKey}
          onChange={e => setSelectedKey(e.target.value)}
        >
          <option value="">— Dönem Seçin —</option>
          {entries.map(e => (
            <option key={`${e.installationId}|${e.periodId}`} value={`${e.installationId}|${e.periodId}`}>
              {e.facilityName} › {e.periodName}
            </option>
          ))}
        </select>
        <Link
          to="/cfe/data-entry"
          style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#00b87a", color: "#fff", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
        >
          Veri Yükle
        </Link>
        {selected?.cfe && (
          <button
            style={{ padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#059669", color: "#fff" }}
            onClick={() => window.open(api.cfe.certificateUrl(selected.installationId, selected.periodId, eacRef || undefined), "_blank")}
          >
            Sertifika İndir
          </button>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Gauge */}
        <div style={card}>
          <div style={cardH}>{selected ? `${selected.facilityName} — ${selected.periodName}` : "Dönem Seçin"}</div>
          {selected?.cfe ? (
            <>
              <CfeGauge score={selected.cfe.cfeScore} />
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginTop: 16, textAlign: "center" }}>
                {[
                  { label: "Eşleşen",   value: selected.cfe.matchedHours,   color: "#059669" },
                  { label: "Kısmi",     value: selected.cfe.partialHours,   color: "#D97706" },
                  { label: "Eşleşmez", value: selected.cfe.unmatchedHours, color: "#DC2626" },
                ].map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: x.color }}>{x.value}</div>
                    <div style={{ fontSize: 11, color: muted }}>{x.label} saat</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: muted, fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: ".05em" }}>
                  EAC / I-REC Referans No (isteğe bağlı)
                </div>
                <input
                  value={eacRef}
                  onChange={e => setEacRef(e.target.value)}
                  placeholder="Örn: I-REC-TR-2024-000123"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 12, background: inputBg, color: text, boxSizing: "border-box" }}
                />
              </div>
            </>
          ) : (
            <div style={{ color: muted, fontSize: 13, padding: "20px 0" }}>
              Bu dönem için CFE verisi yok.{" "}
              <Link to="/cfe/data-entry" style={{ color: "#00b87a" }}>Veri yükleyin →</Link>
            </div>
          )}
        </div>

        {/* Bar Chart */}
        <div style={card}>
          <div style={cardH}>CFE Skorları — Tüm Dönemler</div>
          {barData.length === 0 ? (
            <div style={{ color: muted, fontSize: 13 }}>CFE verisi olan dönem yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ bottom: 40, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,.06)" : "#eef7f3"} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: muted }} angle={-30} textAnchor="end" interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: muted }} />
                <Tooltip formatter={(v: unknown) => [`${fmt(Number(v), 1)}%`, "CFE"] as [string, string]}
                  contentStyle={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: text }} />
                <ReferenceLine y={70} stroke="#059669" strokeDasharray="4 4"
                  label={{ value: "Hedef %70", fill: "#059669", fontSize: 10, position: "right" }} />
                <Bar dataKey="cfeScore">
                  {barData.map((_, i) => <Cell key={i} fill={cfeColor(barData[i].cfeScore)} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {monthlyData.length > 0 && (
        <>
          <div style={card}>
            <div style={cardH}>Aylık CFE Isı Haritası</div>
            <CfeHeatmap monthly={selected!.cfe!.monthlyBreakdown} isDark={isDark} />
          </div>

          <div style={card}>
            <div style={cardH}>Aylık CFE Analizi</div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={monthlyData} margin={{ top: 5, right: 30, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,.06)" : "#eef7f3"} />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: muted }} />
                <YAxis yAxisId="kwh" tick={{ fontSize: 11, fill: muted }} />
                <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: muted }} />
                <Tooltip contentStyle={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }} labelStyle={{ color: text }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar yAxisId="kwh" dataKey="consumptionKwh" name="Tüketim (kWh)" fill={isDark ? "#1a3530" : "#d4ece4"} />
                <Bar yAxisId="kwh" dataKey="matchedKwh" name="Eşleşen (kWh)" fill="#059669" />
                <Line yAxisId="pct" type="monotone" dataKey="cfeRate" name="CFE %" stroke="#00b87a" dot={false} strokeWidth={2} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>

          <div style={card}>
            <div style={cardH}>Aylık Detay</div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Ay", "Tüketim (MWh)", "Üretim (MWh)", "Eşleşen (MWh)", "CFE Oranı"].map(h => (
                      <th key={h} style={{ textAlign: h === "Ay" ? "left" : "right", fontSize: 11, color: muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: ".05em", padding: "8px 12px", borderBottom: `1px solid ${border}` }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {monthlyData.map((m, i) => {
                    const color = m.cfeRate >= 70 ? "#059669" : m.cfeRate >= 40 ? "#D97706" : "#DC2626";
                    return (
                      <tr key={i} style={{ background: i % 2 === 0 ? bg : stripeBg }}>
                        <td style={{ padding: "10px 12px", fontSize: 13, color: text, borderBottom: `1px solid ${border}` }}>{m.month}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}`, color: text }}>{(m.consumptionKwh / 1000).toFixed(1)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}`, color: muted }}>{(m.productionKwh / 1000).toFixed(1)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}`, color: "#059669", fontWeight: 600 }}>{(m.matchedKwh / 1000).toFixed(1)}</td>
                        <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}` }}>
                          <span style={{ color, fontWeight: 700 }}>{m.cfeRate.toFixed(1)}%</span>
                          <div style={{ marginTop: 2, height: 4, background: isDark ? "rgba(255,255,255,.1)" : "#eef7f3", borderRadius: 2, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${Math.min(m.cfeRate, 100)}%`, background: color, borderRadius: 2 }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
