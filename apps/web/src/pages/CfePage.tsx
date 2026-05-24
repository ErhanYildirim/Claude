import React, { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ComposedChart, Line, Legend, Cell,
} from "recharts";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { Installation, CFEResult, MonthlyBreakdown, CFEBody } from "../lib/api.js";
import { fmt } from "../lib/chart-utils.js";

// Generate hourly slots from month-level data (flat distribution)
function generateSlots(rows: ManualRow[]): CFEBody["slots"] {
  const slots: CFEBody["slots"] = [];
  for (const row of rows) {
    if (!row.date || row.consumptionMwh <= 0) continue;
    const [y, m, d] = row.date.split("-").map(Number);
    const daysInMonth = new Date(y, m, 0).getDate();
    const perHour = (row.consumptionMwh * 1000) / (daysInMonth * 24);
    const perHourProd = (row.productionMwh * 1000) / (daysInMonth * 24);
    for (let day = 1; day <= daysInMonth; day++) {
      for (let h = 0; h < 24; h++) {
        const hour = new Date(Date.UTC(y, m - 1, day, h)).toISOString();
        slots.push({ hour, consumptionKwh: perHour, productionKwh: perHourProd });
      }
    }
  }
  return slots;
}

interface ManualRow { date: string; consumptionMwh: number; productionMwh: number; }

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
  for (const m of monthly) {
    const d = new Date(m.month);
    byMonth.set(d.getUTCMonth() + 1, m);
  }

  return (
    <div style={{ position: "relative" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
        {Array.from({ length: 12 }, (_, i) => i + 1).map(mon => {
          const d = byMonth.get(mon);
          const rate = d?.cfeRate ?? null;
          const bg = rate === null
            ? (isDark ? "#1a3530" : "#f1f5f9")
            : rate >= 70 ? (isDark ? "#064e3b" : "#d1fae5")
            : rate >= 40 ? (isDark ? "#451a03" : "#fef3c7")
            : (isDark ? "#450a0a" : "#fee2e2");
          const textColor = rate === null
            ? (isDark ? "#4b6a62" : "#94a3b8")
            : rate >= 70 ? "#059669"
            : rate >= 40 ? "#d97706"
            : "#dc2626";
          const borderColor = rate === null
            ? (isDark ? "#1e3830" : "#e2e8f0")
            : rate >= 70 ? "#a7f3d0"
            : rate >= 40 ? "#fcd34d"
            : "#fca5a5";
          return (
            <div
              key={mon}
              style={{ background: bg, borderRadius: 8, padding: "12px 8px", textAlign: "center",
                       cursor: d ? "pointer" : "default", transition: "transform .1s",
                       border: `1px solid ${borderColor}` }}
              onMouseEnter={e => d && setTip({ x: (e.target as HTMLElement).getBoundingClientRect().left, y: (e.target as HTMLElement).getBoundingClientRect().top, data: d })}
              onMouseLeave={() => setTip(null)}
            >
              <div style={{ fontSize: 11, color: textColor, fontWeight: 600, marginBottom: 4 }}>
                {MONTH_NAMES_TR[mon - 1]}
              </div>
              {rate !== null ? (
                <>
                  <div style={{ fontSize: 18, fontWeight: 800, color: textColor, lineHeight: 1 }}>
                    {rate.toFixed(0)}%
                  </div>
                  <div style={{ marginTop: 5, height: 4, background: "rgba(0,0,0,.12)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`,
                                  background: cfeColor(rate), borderRadius: 2 }} />
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
                      zIndex: 999, pointerEvents: "none", whiteSpace: "nowrap", boxShadow: "0 4px 12px rgba(0,0,0,.25)" }}>
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
  const r = 70, cx = 80, cy = 80;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = cfeColor(score);
  return (
    <svg viewBox="0 0 160 160" width={160} height={160} style={{ display: "block", margin: "0 auto" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#eef7f3" strokeWidth={16} />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke={color} strokeWidth={16}
        strokeDasharray={`${dash} ${circ}`} strokeLinecap="round"
        transform={`rotate(-90 ${cx} ${cy})`} />
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle"
        style={{ fontSize: 26, fontWeight: 700, fill: color }}>
        {score.toFixed(1)}%
      </text>
    </svg>
  );
}

export default function CfePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [entries, setEntries]       = useState<PeriodEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile]       = useState<File | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult,   setCsvResult]   = useState<{ rowCount: number; errorCount: number; errors: string[]; cfeScore: number } | null>(null);
  const [csvErr,      setCsvErr]      = useState("");
  const [csvPreview,  setCsvPreview]  = useState<string[][]>([]);
  const [eacRef, setEacRef]         = useState("");
  const [uploadTab, setUploadTab]   = useState<"csv" | "manual">("csv");
  const [manualRows, setManualRows] = useState<ManualRow[]>(
    [{ date: new Date().toISOString().slice(0, 7), consumptionMwh: 0, productionMwh: 0 }]
  );
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult,  setManualResult]  = useState<{ cfeScore: number; hours: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1e3830" : "#f4fbf8";
  const stripeBg = isDark ? "#1a3530" : "#f9fdfb";

  const card: React.CSSProperties  = { background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "20px", marginBottom: 20 };
  const cardH: React.CSSProperties = { fontSize: 14, fontWeight: 600, color: text, marginBottom: 16 };

  async function loadEntries() {
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
    return all;
  }

  useEffect(() => {
    loadEntries()
      .then(all => {
        setEntries(all);
        if (all.length > 0) setSelectedKey(`${all[0].installationId}|${all[0].periodId}`);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function reloadSelectedCfe(installationId: string, periodId: string) {
    try {
      const cfe = await api.cfe.get(installationId, periodId);
      setEntries(prev => prev.map(e =>
        e.installationId === installationId && e.periodId === periodId ? { ...e, cfe } : e
      ));
    } catch { /* keep old */ }
  }

  const withCfe = entries.filter(e => e.cfe !== null);
  const avgCfe = withCfe.length > 0 ? withCfe.reduce((s, e) => s + e.cfe!.cfeScore, 0) / withCfe.length : 0;
  const totalMatched = withCfe.reduce((s, e) => s + e.cfe!.totalMatchedKwh, 0);
  const totalConsumption = withCfe.reduce((s, e) => s + e.cfe!.totalConsumptionKwh, 0);

  const selected = entries.find(e => `${e.installationId}|${e.periodId}` === selectedKey) ?? null;

  const barData = withCfe.map(e => ({
    name: `${e.facilityName.slice(0, 8)}/${e.periodName.slice(0, 6)}`,
    cfeScore: e.cfe!.cfeScore,
    installationId: e.installationId,
    periodId: e.periodId,
  }));

  const monthlyData = (selected?.cfe?.monthlyBreakdown ?? []).map((mb: MonthlyBreakdown) => ({
    month: mb.month.slice(0, 7),
    consumptionKwh: mb.consumptionKwh,
    productionKwh: mb.productionKwh,
    matchedKwh: mb.matchedKwh,
    cfeRate: mb.cfeRate,
  }));

  function parsePreview(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const text = (e.target?.result as string) ?? "";
      const lines = text.split(/\r?\n/).filter(Boolean).slice(0, 6);
      setCsvPreview(lines.map(l => l.split(",")));
    };
    reader.readAsText(file);
  }

  function selectFile(file: File | null) {
    setCsvFile(file);
    setCsvPreview([]);
    if (file) parsePreview(file);
  }

  async function uploadCsv() {
    if (!selected || !csvFile) return;
    setCsvUploading(true); setCsvErr("");
    try {
      const res = await api.cfe.importCsv(selected.installationId, selected.periodId, csvFile);
      setCsvResult({ rowCount: res.rowCount, errorCount: res.errorCount, errors: res.errors, cfeScore: res.result.cfeScore });
      await reloadSelectedCfe(selected.installationId, selected.periodId);
    } catch (e: unknown) { setCsvErr(e instanceof Error ? e.message : "Yükleme hatası"); }
    setCsvUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setCsvDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) selectFile(file);
  }

  const selectStyle: React.CSSProperties = {
    padding: "9px 12px", borderRadius: 7, border: `1px solid ${border}`,
    fontSize: 14, background: isDark ? "#1e3830" : "#fff",
    color: text, cursor: "pointer",
  };
  const btnStyle: React.CSSProperties = {
    padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
    fontWeight: 600, fontSize: 14, background: "#00b87a", color: "#fff",
  };
  const modalCard: React.CSSProperties = {
    background: bg, borderRadius: 12, padding: "32px", width: 520,
    margin: "20px auto", boxShadow: "0 8px 32px rgba(0,0,0,.25)",
    border: `1px solid ${border}`,
  };
  const dzStyle: React.CSSProperties = {
    border: `2px dashed ${border}`, borderRadius: 8, padding: "24px",
    textAlign: "center", cursor: "pointer", marginBottom: 14,
  };

  if (loading) return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", color: muted }}>
      Yükleniyor...
    </div>
  );

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>24/7 CFE Eşleştirme</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 24 }}>Carbon-Free Energy saatlik eşleştirme analizi</div>

      {/* KPI */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Ortalama CFE Skoru",  value: `${fmt(avgCfe, 1)}%`,                          color: cfeColor(avgCfe) },
          { label: "Toplam Eşleşen",      value: `${fmt(totalMatched / 1000, 0)} MWh`,          color: "#059669" },
          { label: "Toplam Tüketim",      value: `${fmt(totalConsumption / 1000, 0)} MWh`,      color: text },
        ].map(k => (
          <div key={k.label} style={{ background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "18px 20px" }}>
            <div style={{ fontSize: 12, color: muted, marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Period selector + CSV */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <select style={selectStyle} value={selectedKey} onChange={e => setSelectedKey(e.target.value)}>
          <option value="">— Dönem Seçin —</option>
          {entries.map(e => (
            <option key={`${e.installationId}|${e.periodId}`} value={`${e.installationId}|${e.periodId}`}>
              {e.facilityName} › {e.periodName}
            </option>
          ))}
        </select>
        <button style={btnStyle} disabled={!selectedKey} onClick={() => {
          setCsvResult(null); setCsvErr(""); setCsvFile(null); setManualResult(null); setShowCsvModal(true);
        }}>
          Saatlik Veri Yükle
        </button>
        {selected?.cfe && (
          <button
            style={{ ...btnStyle, background: "#059669" }}
            onClick={() => window.open(api.cfe.certificateUrl(selected.installationId, selected.periodId, eacRef || undefined), "_blank")}
          >
            CFE Sertifikası İndir
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
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: `1px solid ${border}`,
                           fontSize: 12, background: inputBg, color: text, boxSizing: "border-box" }}
                />
                <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>Sertifikaya dahil edilir</div>
              </div>
            </>
          ) : (
            <div style={{ color: muted, fontSize: 13, padding: "20px 0" }}>Bu dönem için CFE verisi yok</div>
          )}
        </div>

        {/* CFE Bar Chart */}
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
                <Tooltip
                  formatter={(v: unknown) => [`${fmt(Number(v), 1)}%`, "CFE"] as [string, string]}
                  contentStyle={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }}
                  labelStyle={{ color: text }}
                />
                <ReferenceLine y={70} stroke="#059669" strokeDasharray="4 4"
                  label={{ value: "Hedef %70", fill: "#059669", fontSize: 10, position: "right" }} />
                <Bar dataKey="cfeScore" name="CFE Skoru (%)">
                  {barData.map((entry, i) => (
                    <Cell key={i} fill={cfeColor(entry.cfeScore)} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Aylık CFE Isı Haritası */}
      {monthlyData.length > 0 && (
        <div style={card}>
          <div style={cardH}>Aylık CFE Isı Haritası — {selected?.facilityName} › {selected?.periodName}</div>
          <CfeHeatmap monthly={selected!.cfe!.monthlyBreakdown} isDark={isDark} />
        </div>
      )}

      {/* Aylık Breakdown Chart */}
      {monthlyData.length > 0 && (
        <div style={card}>
          <div style={cardH}>Aylık CFE Analizi — {selected?.facilityName} › {selected?.periodName}</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 30, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={isDark ? "rgba(255,255,255,.06)" : "#eef7f3"} />
              <XAxis dataKey="month" tick={{ fontSize: 11, fill: muted }} />
              <YAxis yAxisId="kwh" tick={{ fontSize: 11, fill: muted }} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11, fill: muted }} />
              <Tooltip
                contentStyle={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: text }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar yAxisId="kwh" dataKey="consumptionKwh" name="Tüketim (kWh)" fill={isDark ? "#1a3530" : "#d4ece4"} />
              <Bar yAxisId="kwh" dataKey="matchedKwh"     name="Eşleşen (kWh)"  fill="#059669" />
              <Line yAxisId="pct" type="monotone" dataKey="cfeRate" name="CFE %" stroke="#00b87a" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aylık Detay Tablosu */}
      {monthlyData.length > 0 && (
        <div style={card}>
          <div style={cardH}>Aylık Detay — {selected?.facilityName} › {selected?.periodName}</div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Ay", "Tüketim (MWh)", "Üretim (MWh)", "Eşleşen (MWh)", "CFE Oranı"].map(h => (
                    <th key={h} style={{
                      textAlign: h === "Ay" ? "left" : "right",
                      fontSize: 11, color: muted, fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: ".05em",
                      padding: "8px 12px", borderBottom: `1px solid ${border}`,
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((m, i) => {
                  const rate = m.cfeRate;
                  const color = rate >= 70 ? "#059669" : rate >= 40 ? "#D97706" : "#DC2626";
                  return (
                    <tr key={i} style={{ background: i % 2 === 0 ? bg : stripeBg }}>
                      <td style={{ padding: "10px 12px", fontSize: 13, color: text, borderBottom: `1px solid ${border}` }}>{m.month}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}`, color: text }}>{(m.consumptionKwh / 1000).toFixed(1)}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}`, color: muted }}>{(m.productionKwh / 1000).toFixed(1)}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}`, color: "#059669", fontWeight: 600 }}>{(m.matchedKwh / 1000).toFixed(1)}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: `1px solid ${border}` }}>
                        <span style={{ color, fontWeight: 700 }}>{rate.toFixed(1)}%</span>
                        <div style={{ marginTop: 2, height: 4, background: isDark ? "rgba(255,255,255,.1)" : "#eef7f3", borderRadius: 2, overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`, background: color, borderRadius: 2 }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Veri Yükleme Modal */}
      {showCsvModal && (
        <div
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", display: "flex",
                   alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto" }}
          onClick={e => e.target === e.currentTarget && setShowCsvModal(false)}
        >
          <div style={modalCard}>
            <div style={{ fontSize: 17, fontWeight: 700, color: text, marginBottom: 16 }}>CFE Saatlik Veri</div>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 4, borderBottom: `1px solid ${border}`, marginBottom: 16 }}>
              {(["csv", "manual"] as const).map(tab => (
                <button key={tab} onClick={() => setUploadTab(tab)} style={{
                  padding: "7px 16px", border: "none", cursor: "pointer", fontWeight: 600,
                  fontSize: 13, borderRadius: "6px 6px 0 0",
                  background: uploadTab === tab ? bg : "transparent",
                  color: uploadTab === tab ? text : muted,
                  borderBottom: uploadTab === tab ? "2px solid #00b87a" : "2px solid transparent",
                  fontFamily: "inherit",
                }}>
                  {tab === "csv" ? "CSV Yükle" : "Manuel Giriş"}
                </button>
              ))}
            </div>

            {/* CSV tab */}
            {uploadTab === "csv" && (
              <>
                <p style={{ fontSize: 13, color: muted, marginBottom: 14 }}>
                  Format: <code style={{ background: inputBg, color: text, padding: "1px 5px", borderRadius: 3 }}>timestamp,consumption_kwh,production_kwh</code>
                </p>
                {csvErr && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 10 }}>{csvErr}</div>}
                {!csvResult ? (
                  <>
                    <div
                      style={{ ...dzStyle, ...(csvDragging ? { borderColor: "#00b87a", background: isDark ? "#0d3326" : "#e6f9f2" } : {}) }}
                      onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
                      onDragLeave={() => setCsvDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}
                    >
                      {csvFile
                        ? <div><div style={{ fontWeight: 600, color: text }}>{csvFile.name}</div><div style={{ fontSize: 12, color: muted }}>{(csvFile.size / 1024).toFixed(0)} KB</div></div>
                        : <div style={{ color: muted }}>CSV sürükleyin veya tıklayın</div>}
                      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                        onChange={e => selectFile(e.target.files?.[0] ?? null)} />
                    </div>

                    {csvPreview.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                          Önizleme (ilk {csvPreview.length - 1} satır)
                        </div>
                        <div style={{ overflowX: "auto", borderRadius: 7, border: `1px solid ${border}` }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                            <thead>
                              <tr style={{ background: inputBg }}>
                                {(csvPreview[0] ?? []).map((h, i) => (
                                  <th key={i} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: muted, whiteSpace: "nowrap" }}>{h.trim()}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {csvPreview.slice(1).map((row, ri) => (
                                <tr key={ri} style={{ borderTop: `1px solid ${border}` }}>
                                  {row.map((cell, ci) => (
                                    <td key={ci} style={{ padding: "5px 10px", color: text, whiteSpace: "nowrap" }}>{cell.trim()}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: 10 }}>
                      <button
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: inputBg, color: text, fontFamily: "inherit" }}
                        onClick={() => setShowCsvModal(false)}
                      >İptal</button>
                      <button
                        style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#00b87a", color: "#fff", fontFamily: "inherit" }}
                        disabled={!csvFile || csvUploading} onClick={uploadCsv}
                      >
                        {csvUploading ? "Yükleniyor..." : "Yükle & Hesapla"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: isDark ? "#064e3b" : "#F0FDF4", border: `1px solid ${isDark ? "#065f46" : "#BBF7D0"}`, borderRadius: 8, padding: 14, marginBottom: 12 }}>
                      <div style={{ fontWeight: 700, color: "#059669", fontSize: 15 }}>✓ CFE Skoru: {csvResult.cfeScore.toFixed(1)}%</div>
                      <div style={{ fontSize: 13, color: text, marginTop: 2 }}>
                        {csvResult.rowCount} satır işlendi
                        {csvResult.errorCount > 0 && <span style={{ color: "#d97706", marginLeft: 6 }}>· {csvResult.errorCount} satır atlandı</span>}
                      </div>
                    </div>

                    {csvResult.errors.length > 0 && (
                      <div style={{ marginBottom: 12 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                          Atlanan Satırlar ({csvResult.errors.length})
                        </div>
                        <div style={{ maxHeight: 160, overflowY: "auto", border: "1px solid #fcd34d", borderRadius: 7, background: isDark ? "#451a03" : "#fffbeb" }}>
                          {csvResult.errors.map((err, i) => (
                            <div key={i} style={{ padding: "5px 10px", fontSize: 11, color: "#d97706", borderBottom: i < csvResult.errors.length - 1 ? "1px solid #fde68a" : "none" }}>
                              {err}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <button
                      style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#00b87a", color: "#fff", fontFamily: "inherit" }}
                      onClick={() => setShowCsvModal(false)}
                    >Kapat</button>
                  </>
                )}
              </>
            )}

            {/* Manuel Giriş tab */}
            {uploadTab === "manual" && (
              <>
                <div style={{ fontSize: 12, color: muted, marginBottom: 12 }}>
                  Aylık toplam tüketim/üretim girin — saatlik veriye eşit dağıtılır.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 32px", gap: 6,
                              fontSize: 11, fontWeight: 700, color: muted, marginBottom: 6,
                              textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <span>Ay (YYYY-MM)</span><span>Tüketim MWh</span><span>Üretim MWh</span><span></span>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {manualRows.map((row, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 32px", gap: 6, marginBottom: 6 }}>
                      <input type="month" value={row.date}
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, date: e.target.value } : r))}
                        style={{ padding: "7px 8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, background: inputBg, color: text }} />
                      <input type="number" min={0} step="0.1" value={row.consumptionMwh || ""}
                        placeholder="0"
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, consumptionMwh: parseFloat(e.target.value) || 0 } : r))}
                        style={{ padding: "7px 8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, background: inputBg, color: text }} />
                      <input type="number" min={0} step="0.1" value={row.productionMwh || ""}
                        placeholder="0"
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, productionMwh: parseFloat(e.target.value) || 0 } : r))}
                        style={{ padding: "7px 8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, background: inputBg, color: text }} />
                      <button onClick={() => setManualRows(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setManualRows(prev => [...prev, { date: new Date().toISOString().slice(0, 7), consumptionMwh: 0, productionMwh: 0 }])}
                  style={{ fontSize: 12, color: "#009966", background: "none", border: `1px dashed ${border}`, borderRadius: 6,
                           padding: "6px 12px", cursor: "pointer", marginBottom: 14, width: "100%", fontFamily: "inherit" }}>
                  + Ay Ekle
                </button>
                {manualResult && (
                  <div style={{ background: isDark ? "#064e3b" : "#F0FDF4", border: `1px solid ${isDark ? "#065f46" : "#BBF7D0"}`, borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: "#059669" }}>CFE Skoru: {manualResult.cfeScore.toFixed(1)}%</div>
                    <div style={{ fontSize: 12, color: text }}>{manualResult.hours} saatlik slot işlendi</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: inputBg, color: text, fontFamily: "inherit" }}
                    onClick={() => setShowCsvModal(false)}
                  >İptal</button>
                  <button
                    disabled={manualLoading || !selected}
                    style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#00b87a", color: "#fff", fontFamily: "inherit" }}
                    onClick={async () => {
                      if (!selected) return;
                      const slots = generateSlots(manualRows);
                      if (slots.length === 0) return;
                      setManualLoading(true);
                      try {
                        const res = await api.cfe.submit(selected.installationId, selected.periodId, { slots });
                        setManualResult({ cfeScore: res.cfeScore, hours: slots.length });
                        await reloadSelectedCfe(selected.installationId, selected.periodId);
                      } catch (e: unknown) { setCsvErr(e instanceof Error ? e.message : "Hata"); }
                      setManualLoading(false);
                    }}
                  >
                    {manualLoading ? "Hesaplanıyor..." : "Hesapla & Kaydet"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
