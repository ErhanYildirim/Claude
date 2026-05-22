import React, { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ComposedChart, Line, Legend, Cell,
} from "recharts";
import { api } from "../lib/api.js";
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

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  kpiRow:  { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 },
  kpi:     { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:    { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  kpiV:    { fontSize: 24, fontWeight: 700, color: "#0a1f1a" },
  card:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 20 },
  cardH:   { fontSize: 14, fontWeight: 600, color: "#0a1f1a", marginBottom: 16 },
  row2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  select:  { padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, background: "#fff", cursor: "pointer" },
  btn:     { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#00b87a", color: "#fff" },
  modal:   { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto" as const },
  mCard:   { background: "#fff", borderRadius: 12, padding: "32px", width: 480, margin: "20px auto", boxShadow: "0 8px 32px rgba(0,0,0,.15)" },
  mTitle:  { fontSize: 17, fontWeight: 700, marginBottom: 16 },
  dzone:   { border: "2px dashed #D1D5DB", borderRadius: 8, padding: "24px", textAlign: "center" as const, cursor: "pointer", marginBottom: 14 },
  dzA:     { borderColor: "#00b87a", background: "#e6f9f2" },
  err:     { color: "#DC2626", fontSize: 13, marginBottom: 10 },
};

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

function CfeHeatmap({ monthly }: { monthly: MonthlyBreakdown[] }) {
  const [tip, setTip] = React.useState<{ x: number; y: number; data: MonthlyBreakdown } | null>(null);

  // index by month number (1-based)
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
          const bg = rate === null ? "#f1f5f9"
            : rate >= 70 ? "#d1fae5" : rate >= 40 ? "#fef3c7" : "#fee2e2";
          const textColor = rate === null ? "#94a3b8"
            : rate >= 70 ? "#065f46" : rate >= 40 ? "#92400e" : "#991b1b";
          return (
            <div
              key={mon}
              style={{ background: bg, borderRadius: 8, padding: "12px 8px", textAlign: "center",
                       cursor: d ? "pointer" : "default", transition: "transform .1s",
                       border: `1px solid ${rate === null ? "#e2e8f0" : rate >= 70 ? "#a7f3d0" : rate >= 40 ? "#fcd34d" : "#fca5a5"}` }}
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
                  <div style={{ marginTop: 5, height: 4, background: "rgba(0,0,0,.08)", borderRadius: 2 }}>
                    <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`,
                                  background: cfeColor(rate), borderRadius: 2 }} />
                  </div>
                </>
              ) : (
                <div style={{ fontSize: 12, color: "#cbd5e1" }}>—</div>
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
  const [entries, setEntries]       = useState<PeriodEntry[]>([]);
  const [loading, setLoading]       = useState(true);
  const [selectedKey, setSelectedKey] = useState("");
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvFile, setCsvFile]       = useState<File | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvUploading, setCsvUploading] = useState(false);
  const [csvResult, setCsvResult]   = useState<{ rowCount: number; errorCount: number; errors: string[]; cfeScore: number } | null>(null);
  const [csvErr, setCsvErr]         = useState("");
  const [eacRef, setEacRef]         = useState("");
  const [uploadTab, setUploadTab]   = useState<"csv" | "manual">("csv");
  const [manualRows, setManualRows] = useState<ManualRow[]>(
    [{ date: "2024-01", consumptionMwh: 0, productionMwh: 0 }]
  );
  const [manualLoading, setManualLoading] = useState(false);
  const [manualResult,  setManualResult]  = useState<{ cfeScore: number; hours: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

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
    matchedKwh: mb.matchedKwh,
    cfeRate: mb.cfeRate,
  }));

  async function uploadCsv() {
    if (!selected || !csvFile) return;
    setCsvUploading(true); setCsvErr("");
    try {
      const res = await api.cfe.importCsv(selected.installationId, selected.periodId, csvFile);
      setCsvResult({ rowCount: res.rowCount, errorCount: res.errorCount, errors: res.errors, cfeScore: res.result.cfeScore });
    } catch (e: unknown) { setCsvErr(e instanceof Error ? e.message : "Yükleme hatası"); }
    setCsvUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setCsvDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setCsvFile(file);
  }

  if (loading) return <div style={{ ...s.page, color: "#5c7a72" }}>Yükleniyor...</div>;

  return (
    <div style={s.page}>
      <div style={s.h1}>24/7 CFE Eşleştirme</div>
      <div style={s.sub}>Carbon-Free Energy saatlik eşleştirme analizi</div>

      {/* KPI */}
      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kpiL}>Ortalama CFE Skoru</div>
          <div style={{ ...s.kpiV, color: cfeColor(avgCfe) }}>{fmt(avgCfe, 1)}%</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Eşleşen</div>
          <div style={{ ...s.kpiV, color: "#059669" }}>{fmt(totalMatched / 1000, 0)} MWh</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Tüketim</div>
          <div style={s.kpiV}>{fmt(totalConsumption / 1000, 0)} MWh</div>
        </div>
      </div>

      {/* Period selector + CSV */}
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20, flexWrap: "wrap" }}>
        <select style={s.select} value={selectedKey} onChange={e => setSelectedKey(e.target.value)}>
          <option value="">— Dönem Seçin —</option>
          {entries.map(e => (
            <option key={`${e.installationId}|${e.periodId}`} value={`${e.installationId}|${e.periodId}`}>
              {e.facilityName} › {e.periodName}
            </option>
          ))}
        </select>
        <button style={s.btn} disabled={!selectedKey} onClick={() => { setCsvResult(null); setCsvErr(""); setCsvFile(null); setManualResult(null); setShowCsvModal(true); }}>
          Saatlik Veri Yükle
        </button>
        {selected?.cfe && (
          <button
            style={{ ...s.btn, background: "#059669" }}
            onClick={() => window.open(api.cfe.certificateUrl(selected.installationId, selected.periodId, eacRef || undefined), "_blank")}
          >
            CFE Sertifikası İndir
          </button>
        )}
      </div>

      <div style={s.row2}>
        {/* Gauge */}
        <div style={s.card}>
          <div style={s.cardH}>{selected ? `${selected.facilityName} — ${selected.periodName}` : "Dönem Seçin"}</div>
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
                    <div style={{ fontSize: 11, color: "#5c7a72" }}>{x.label} saat</div>
                  </div>
                ))}
              </div>
              {/* EAC / I-REC referans no */}
              <div style={{ marginTop: 16 }}>
                <div style={{ fontSize: 11, color: "#5c7a72", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: ".05em" }}>
                  EAC / I-REC Referans No (isteğe bağlı)
                </div>
                <input
                  value={eacRef}
                  onChange={e => setEacRef(e.target.value)}
                  placeholder="Örn: I-REC-TR-2024-000123"
                  style={{ width: "100%", padding: "7px 10px", borderRadius: 6, border: "1px solid #d4ece4", fontSize: 12, background: "#f4fbf8", boxSizing: "border-box" as const }}
                />
                <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 4 }}>
                  Sertifikaya dahil edilir
                </div>
              </div>
            </>
          ) : (
            <div style={{ color: "#5c7a72", fontSize: 13, padding: "20px 0" }}>Bu dönem için CFE verisi yok</div>
          )}
        </div>

        {/* CFE Bar Chart — tüm periodlar */}
        <div style={s.card}>
          <div style={s.cardH}>CFE Skorları — Tüm Dönemler</div>
          {barData.length === 0 ? (
            <div style={{ color: "#5c7a72", fontSize: 13 }}>CFE verisi olan dönem yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ bottom: 40, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef7f3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${fmt(Number(v), 1)}%`, "CFE"] as [string, string]} />
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
        <div style={s.card}>
          <div style={s.cardH}>Aylık CFE Isı Haritası — {selected?.facilityName} › {selected?.periodName}</div>
          <CfeHeatmap monthly={selected!.cfe!.monthlyBreakdown} />
        </div>
      )}

      {/* Aylık Breakdown */}
      {monthlyData.length > 0 && (
        <div style={s.card}>
          <div style={s.cardH}>Aylık CFE Analizi — {selected?.facilityName} › {selected?.periodName}</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 30, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#eef7f3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="kwh" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="kwh" dataKey="consumptionKwh" name="Tüketim (kWh)" fill="#d4ece4" />
              <Bar yAxisId="kwh" dataKey="matchedKwh"     name="Eşleşen (kWh)"  fill="#059669" />
              <Line yAxisId="pct" type="monotone" dataKey="cfeRate" name="CFE %" stroke="#00b87a" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aylık Detay Tablosu */}
      {monthlyData.length > 0 && (
        <div style={s.card}>
          <div style={s.cardH}>Aylık Detay — {selected?.facilityName} › {selected?.periodName}</div>
          <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
            <thead>
              <tr>
                {["Ay", "Tüketim (MWh)", "Üretim (MWh)", "Eşleşen (MWh)", "CFE Oranı"].map(h => (
                  <th key={h} style={{ textAlign: h === "Ay" ? "left" : "right" as const, fontSize: 11, color: "#5c7a72", fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".05em", padding: "8px 12px", borderBottom: "1px solid #d4ece4" }}>
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
                  <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fdfb" }}>
                    <td style={{ padding: "10px 12px", fontSize: 13, color: "#0a1f1a", borderBottom: "1px solid #eef7f3" }}>{m.month}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right" as const, borderBottom: "1px solid #eef7f3" }}>{(m.consumptionKwh / 1000).toFixed(1)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right" as const, borderBottom: "1px solid #eef7f3", color: "#5c7a72" }}>{(((m as unknown as {productionKwh?: number}).productionKwh ?? 0) / 1000).toFixed(1)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right" as const, borderBottom: "1px solid #eef7f3", color: "#059669", fontWeight: 600 }}>{(m.matchedKwh / 1000).toFixed(1)}</td>
                    <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right" as const, borderBottom: "1px solid #eef7f3" }}>
                      <span style={{ color, fontWeight: 700 }}>{rate.toFixed(1)}%</span>
                      <div style={{ marginTop: 2, height: 4, background: "#eef7f3", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min(rate, 100)}%`, background: color, borderRadius: 2 }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Veri Yükleme Modal (CSV veya Manuel) */}
      {showCsvModal && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowCsvModal(false)}>
          <div style={{ ...s.mCard, width: 520 }}>
            <div style={s.mTitle}>CFE Saatlik Veri</div>

            {/* Tab bar */}
            <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #d4ece4", marginBottom: 16 }}>
              {(["csv", "manual"] as const).map(tab => (
                <button key={tab} onClick={() => setUploadTab(tab)} style={{
                  padding: "7px 16px", border: "none", cursor: "pointer", fontWeight: 600,
                  fontSize: 13, borderRadius: "6px 6px 0 0",
                  background: uploadTab === tab ? "#fff" : "transparent",
                  color: uploadTab === tab ? "#0a1f1a" : "#5c7a72",
                  borderBottom: uploadTab === tab ? "2px solid #00b87a" : "2px solid transparent",
                }}>
                  {tab === "csv" ? "CSV Yükle" : "Manuel Giriş"}
                </button>
              ))}
            </div>

            {/* CSV tab */}
            {uploadTab === "csv" && (
              <>
                <p style={{ fontSize: 13, color: "#5c7a72", marginBottom: 14 }}>
                  Format: <code style={{ background: "#eef7f3", padding: "1px 5px", borderRadius: 3 }}>timestamp,consumption_kwh,production_kwh</code>
                </p>
                {csvErr && <div style={s.err}>{csvErr}</div>}
                {!csvResult ? (
                  <>
                    <div style={{ ...s.dzone, ...(csvDragging ? s.dzA : {}) }}
                      onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
                      onDragLeave={() => setCsvDragging(false)}
                      onDrop={handleDrop}
                      onClick={() => fileRef.current?.click()}>
                      {csvFile
                        ? <div><div style={{ fontWeight: 600 }}>{csvFile.name}</div><div style={{ fontSize: 12, color: "#5c7a72" }}>{(csvFile.size / 1024).toFixed(0)} KB</div></div>
                        : <div style={{ color: "#5c7a72" }}>CSV sürükleyin veya tıklayın</div>}
                      <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                        onChange={e => setCsvFile(e.target.files?.[0] ?? null)} />
                    </div>
                    <div style={{ display: "flex", gap: 10 }}>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#eef7f3", color: "#1a3530" }}
                        onClick={() => setShowCsvModal(false)}>İptal</button>
                      <button style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#00b87a", color: "#fff" }}
                        disabled={!csvFile || csvUploading} onClick={uploadCsv}>
                        {csvUploading ? "Yükleniyor..." : "Yükle & Hesapla"}
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                      <div style={{ fontWeight: 700, color: "#065F46" }}>CFE Skoru: {csvResult.cfeScore.toFixed(1)}%</div>
                      <div style={{ fontSize: 13, color: "#1a3530" }}>{csvResult.rowCount} satır işlendi{csvResult.errorCount > 0 && ` · ${csvResult.errorCount} atlandı`}</div>
                    </div>
                    <button style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#00b87a", color: "#fff" }}
                      onClick={() => setShowCsvModal(false)}>Kapat</button>
                  </>
                )}
              </>
            )}

            {/* Manuel Giriş tab */}
            {uploadTab === "manual" && (
              <>
                <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 12 }}>
                  Aylık toplam tüketim/üretim girin — saatlik veriye eşit dağıtılır.
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 32px", gap: 6,
                              fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 6,
                              textTransform: "uppercase", letterSpacing: ".04em" }}>
                  <span>Ay (YYYY-MM)</span><span>Tüketim MWh</span><span>Üretim MWh</span><span></span>
                </div>
                <div style={{ maxHeight: 260, overflowY: "auto" }}>
                  {manualRows.map((row, i) => (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 32px", gap: 6, marginBottom: 6 }}>
                      <input type="month" value={row.date}
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, date: e.target.value } : r))}
                        style={{ padding: "7px 8px", borderRadius: 6, border: "1px solid #d4ece4", fontSize: 13 }} />
                      <input type="number" min={0} step="0.1" value={row.consumptionMwh || ""}
                        placeholder="0"
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, consumptionMwh: parseFloat(e.target.value) || 0 } : r))}
                        style={{ padding: "7px 8px", borderRadius: 6, border: "1px solid #d4ece4", fontSize: 13 }} />
                      <input type="number" min={0} step="0.1" value={row.productionMwh || ""}
                        placeholder="0"
                        onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, productionMwh: parseFloat(e.target.value) || 0 } : r))}
                        style={{ padding: "7px 8px", borderRadius: 6, border: "1px solid #d4ece4", fontSize: 13 }} />
                      <button onClick={() => setManualRows(prev => prev.filter((_, j) => j !== i))}
                        style={{ background: "none", border: "1px solid #fca5a5", color: "#ef4444", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>✕</button>
                    </div>
                  ))}
                </div>
                <button onClick={() => setManualRows(prev => [...prev, { date: "2024-01", consumptionMwh: 0, productionMwh: 0 }])}
                  style={{ fontSize: 12, color: "#009966", background: "none", border: "1px dashed #d4ece4", borderRadius: 6,
                           padding: "6px 12px", cursor: "pointer", marginBottom: 14, width: "100%" }}>
                  + Ay Ekle
                </button>
                {manualResult && (
                  <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 12, marginBottom: 12 }}>
                    <div style={{ fontWeight: 700, color: "#065F46" }}>CFE Skoru: {manualResult.cfeScore.toFixed(1)}%</div>
                    <div style={{ fontSize: 12, color: "#1a3530" }}>{manualResult.hours} saatlik slot işlendi</div>
                  </div>
                )}
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#eef7f3", color: "#1a3530" }}
                    onClick={() => setShowCsvModal(false)}>İptal</button>
                  <button
                    disabled={manualLoading || !selected}
                    style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#00b87a", color: "#fff" }}
                    onClick={async () => {
                      if (!selected) return;
                      const slots = generateSlots(manualRows);
                      if (slots.length === 0) return;
                      setManualLoading(true);
                      try {
                        const res = await api.cfe.submit(selected.installationId, selected.periodId, { slots });
                        setManualResult({ cfeScore: res.cfeScore, hours: slots.length });
                      } catch (e: unknown) { setCsvErr(e instanceof Error ? e.message : "Hata"); }
                      setManualLoading(false);
                    }}>
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
