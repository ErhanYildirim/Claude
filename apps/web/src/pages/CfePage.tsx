import { useState, useEffect, useRef } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ReferenceLine, ComposedChart, Line, Legend, Cell,
} from "recharts";
import { api } from "../lib/api.js";
import type { Installation, CFEResult, MonthlyBreakdown } from "../lib/api.js";
import { fmt } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#6B7280", marginBottom: 24 },
  kpiRow:  { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 },
  kpi:     { background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "18px 20px" },
  kpiL:    { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  kpiV:    { fontSize: 24, fontWeight: 700, color: "#111827" },
  card:    { background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "20px", marginBottom: 20 },
  cardH:   { fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 16 },
  row2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  select:  { padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, background: "#fff", cursor: "pointer" },
  btn:     { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#0066CC", color: "#fff" },
  modal:   { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto" as const },
  mCard:   { background: "#fff", borderRadius: 12, padding: "32px", width: 480, margin: "20px auto", boxShadow: "0 8px 32px rgba(0,0,0,.15)" },
  mTitle:  { fontSize: 17, fontWeight: 700, marginBottom: 16 },
  dzone:   { border: "2px dashed #D1D5DB", borderRadius: 8, padding: "24px", textAlign: "center" as const, cursor: "pointer", marginBottom: 14 },
  dzA:     { borderColor: "#0066CC", background: "#EFF6FF" },
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

function CfeGauge({ score }: { score: number }) {
  const r = 70, cx = 80, cy = 80;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = cfeColor(score);
  return (
    <svg viewBox="0 0 160 160" width={160} height={160} style={{ display: "block", margin: "0 auto" }}>
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F3F4F6" strokeWidth={16} />
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

  if (loading) return <div style={{ ...s.page, color: "#6B7280" }}>Yükleniyor...</div>;

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
      <div style={{ display: "flex", gap: 12, alignItems: "center", marginBottom: 20 }}>
        <select style={s.select} value={selectedKey} onChange={e => setSelectedKey(e.target.value)}>
          <option value="">— Dönem Seçin —</option>
          {entries.map(e => (
            <option key={`${e.installationId}|${e.periodId}`} value={`${e.installationId}|${e.periodId}`}>
              {e.facilityName} › {e.periodName}
            </option>
          ))}
        </select>
        <button style={s.btn} disabled={!selectedKey} onClick={() => { setCsvResult(null); setCsvErr(""); setCsvFile(null); setShowCsvModal(true); }}>
          Saatlik Veri Yükle
        </button>
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
                  { label: "Eşleşen", value: selected.cfe.matchedHours, color: "#059669" },
                  { label: "Kısmi",   value: selected.cfe.partialHours,  color: "#D97706" },
                  { label: "Eşleşmez",value: selected.cfe.unmatchedHours,color: "#DC2626" },
                ].map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize: 18, fontWeight: 700, color: x.color }}>{x.value}</div>
                    <div style={{ fontSize: 11, color: "#6B7280" }}>{x.label} saat</div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div style={{ color: "#9CA3AF", fontSize: 13, padding: "20px 0" }}>Bu dönem için CFE verisi yok</div>
          )}
        </div>

        {/* CFE Bar Chart — tüm periodlar */}
        <div style={s.card}>
          <div style={s.cardH}>CFE Skorları — Tüm Dönemler</div>
          {barData.length === 0 ? (
            <div style={{ color: "#9CA3AF", fontSize: 13 }}>CFE verisi olan dönem yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} margin={{ bottom: 40, top: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${fmt(v, 1)}%`, "CFE"]} />
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

      {/* Aylık Breakdown */}
      {monthlyData.length > 0 && (
        <div style={s.card}>
          <div style={s.cardH}>Aylık CFE Analizi — {selected?.facilityName} › {selected?.periodName}</div>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyData} margin={{ top: 5, right: 30, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F3F4F6" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="kwh" tick={{ fontSize: 11 }} />
              <YAxis yAxisId="pct" orientation="right" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar yAxisId="kwh" dataKey="consumptionKwh" name="Tüketim (kWh)" fill="#E5E7EB" />
              <Bar yAxisId="kwh" dataKey="matchedKwh"     name="Eşleşen (kWh)"  fill="#059669" />
              <Line yAxisId="pct" type="monotone" dataKey="cfeRate" name="CFE %" stroke="#0066CC" dot={false} strokeWidth={2} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* CSV Modal */}
      {showCsvModal && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowCsvModal(false)}>
          <div style={s.mCard}>
            <div style={s.mTitle}>CFE Saatlik Veri Yükleme</div>
            <p style={{ fontSize: 13, color: "#6B7280", marginBottom: 14 }}>
              Format: <code style={{ background: "#F3F4F6", padding: "1px 5px", borderRadius: 3 }}>timestamp,consumption_kwh,production_kwh</code>
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
                    ? <div><div style={{ fontWeight: 600 }}>{csvFile.name}</div><div style={{ fontSize: 12, color: "#6B7280" }}>{(csvFile.size / 1024).toFixed(0)} KB</div></div>
                    : <div style={{ color: "#9CA3AF" }}>CSV sürükleyin veya tıklayın</div>}
                  <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                    onChange={e => setCsvFile(e.target.files?.[0] ?? null)} />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#F3F4F6", color: "#374151" }}
                    onClick={() => setShowCsvModal(false)}>İptal</button>
                  <button style={{ flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#0066CC", color: "#fff" }}
                    disabled={!csvFile || csvUploading} onClick={uploadCsv}>
                    {csvUploading ? "Yükleniyor..." : "Yükle & Hesapla"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 14, marginBottom: 14 }}>
                  <div style={{ fontWeight: 700, color: "#065F46" }}>CFE Skoru: {csvResult.cfeScore.toFixed(1)}%</div>
                  <div style={{ fontSize: 13, color: "#374151" }}>{csvResult.rowCount} satır işlendi{csvResult.errorCount > 0 && ` · ${csvResult.errorCount} atlandı`}</div>
                </div>
                <button style={{ width: "100%", padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, background: "#0066CC", color: "#fff" }}
                  onClick={() => setShowCsvModal(false)}>Kapat</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
