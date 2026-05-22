import { useState, useRef, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell, LineChart, Line, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import type { GecResult, GecMonthlyPoint, GecColMap, EFZoneEntry, Installation, Period } from "../lib/api.js";

/* ── Styles ──────────────────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:    { fontSize: 14, color: "#5c7a72", marginBottom: 28 },

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 },
  kpi:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:   { fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 6,
            textTransform: "uppercase" as const, letterSpacing: ".06em" },
  kpiV:   { fontSize: 26, fontWeight: 800, color: "#0a1f1a", lineHeight: 1 },
  kpiU:   { fontSize: 11, color: "#5c7a72", marginTop: 4 },

  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4",
            padding: "20px", marginBottom: 20 },
  cardH:  { fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 16,
            textTransform: "uppercase" as const, letterSpacing: ".08em" },

  table:  { width: "100%", borderCollapse: "collapse" as const },
  th:     { textAlign: "left" as const, fontSize: 11, color: "#5c7a72", fontWeight: 700,
            textTransform: "uppercase" as const, letterSpacing: ".05em",
            padding: "10px 14px", borderBottom: "1px solid #d4ece4" },
  td:     { padding: "12px 14px", fontSize: 13, color: "#1a3530",
            borderBottom: "1px solid #eef7f3" },
  tdR:    { padding: "12px 14px", fontSize: 13, color: "#1a3530",
            borderBottom: "1px solid #eef7f3", textAlign: "right" as const },

  btn:    { padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 14, background: "#00b87a", color: "#fff" },
  btnSm:  { padding: "7px 16px", borderRadius: 7, border: "1px solid #d4ece4",
            cursor: "pointer", fontSize: 13, background: "#fff", color: "#1a3530" },

  dzone:  { border: "2px dashed #d4ece4", borderRadius: 12, padding: "48px 32px",
            textAlign: "center" as const, cursor: "pointer", transition: "all .15s" },
  dzA:    { borderColor: "#00b87a", background: "#e6f9f2" },

  how:    { background: "#f4fbf8", borderRadius: 8, padding: "14px 16px",
            fontSize: 12, color: "#5c7a72", marginTop: 16, lineHeight: 1.7 },
  err:    { color: "#DC2626", fontSize: 13, marginTop: 12, textAlign: "center" as const },

  infoRow:{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24,
            background: "#e6f9f2", border: "1px solid rgba(0,184,122,.25)",
            borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#009966" },

  cfeBox: { background: "linear-gradient(135deg,#e6f9f2,#f4fbf8)", border: "1px solid #a7f3d0",
            borderRadius: 10, padding: "16px 20px", marginBottom: 20 },
  cfeH:   { fontSize: 13, fontWeight: 700, color: "#009966", marginBottom: 10 },
  cfeGrid:{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 },
  cfeKpi: { background: "#fff", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const },
  cfeKL:  { fontSize: 10, color: "#5c7a72", fontWeight: 700, textTransform: "uppercase" as const,
            letterSpacing: ".05em", marginBottom: 4 },
  cfeKV:  { fontSize: 20, fontWeight: 800 },
  cfeKU:  { fontSize: 10, color: "#5c7a72", marginTop: 2 },
};

function co2Color(tco2: number, max: number) {
  const r = max > 0 ? tco2 / max : 0;
  if (r > 0.8) return "#ef4444";
  if (r > 0.5) return "#f59e0b";
  return "#00b87a";
}

/* ── Upload View ──────────────────────────────────────────────────────────── */
function UploadView({ onResult }: { onResult: (r: GecResult) => void }) {
  const [step,       setStep]       = useState<"pick" | "mapping">("pick");
  const [file,       setFile]       = useState<File | null>(null);
  const [drag,       setDrag]       = useState(false);
  const [loading,    setLoading]    = useState(false);  // hesaplama
  const [colsLoading,setColsLoading]= useState(false);  // kolon çekme
  const [err,        setErr]        = useState("");
  const [zoneId,     setZoneId]     = useState("TR");
  const [zones,      setZones]      = useState<EFZoneEntry[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [instId,     setInstId]     = useState("");
  const [periods,    setPeriods]    = useState<Period[]>([]);
  const [periodId,   setPeriodId]   = useState("");

  // Kolon eşleştirme state
  const [columns,    setColumns]    = useState<string[]>([]);
  const [colPreview, setColPreview] = useState<Record<string, string>[]>([]);
  const [colMap,     setColMap]     = useState<GecColMap>({ hour: "", consumption: "", production: "" });

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.ef.zones().then(r => setZones(r.zones)).catch(() => {});
    api.installations.list().then(r => setInstallations(r)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!instId) { setPeriods([]); setPeriodId(""); return; }
    api.installations.get(instId).then(r => { setPeriods(r.periods ?? []); setPeriodId(""); }).catch(() => {});
  }, [instId]);

  async function pick(f: File) {
    const ext = f.name.split(".").pop()?.toLowerCase() ?? "";
    if (!["csv", "xlsx", "xls"].includes(ext)) {
      setErr("Yalnızca CSV veya Excel (.xlsx, .xls) dosyası kabul edilir."); return;
    }
    setFile(f); setErr(""); setColsLoading(true);
    try {
      const result = await api.gec.columns(f);
      setColumns(result.columns);
      setColPreview(result.preview);
      setColMap({
        hour:        result.suggestedMap.hour        ?? "",
        consumption: result.suggestedMap.consumption ?? "",
        production:  result.suggestedMap.production  ?? "",
      });
      setStep("mapping");
    } catch {
      setErr("Kolon bilgisi alınamadı. Dosyayı kontrol edin.");
    } finally {
      setColsLoading(false);
    }
  }

  async function calculate() {
    if (!file || !colMap.hour || !colMap.consumption) return;
    setLoading(true); setErr("");
    try {
      const result = await api.gec.calculate(file, zoneId, periodId || undefined, {
        hour:        colMap.hour        || undefined,
        consumption: colMap.consumption || undefined,
        production:  colMap.production  || undefined,
      });
      onResult(result);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hesaplama hatası oluştu.");
      setLoading(false);
    }
  }

  function resetPick() {
    setStep("pick"); setFile(null); setColumns([]); setColPreview([]);
    setColMap({ hour: "", consumption: "", production: "" }); setErr("");
    if (inputRef.current) inputRef.current.value = "";
  }

  const selectedZone = zones.find(z => z.zoneId === zoneId);
  const canCalculate = !!colMap.hour && !!colMap.consumption;

  // ── Ortak üst panel: zone + dönem ─────────────────────────────────────────
  const topPanel = (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 }}>
          EF Zone (Emisyon Faktörü Bölgesi)
        </div>
        <select
          style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
                   fontSize: 13, background: "#fff", color: "#0a1f1a" }}
          value={zoneId} onChange={e => setZoneId(e.target.value)}
        >
          {zones.length === 0 && <option value="TR">TR — Türkiye (yükleniyor…)</option>}
          {zones.map(z => (
            <option key={z.zoneId} value={z.zoneId}>{z.zoneId} — {z.zoneName || z.country}</option>
          ))}
        </select>
        {selectedZone && (
          <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 3 }}>
            {selectedZone.rowCount.toLocaleString()} saatlik kayıt · 2024
          </div>
        )}
      </div>

      <div style={{ marginBottom: 20, padding: "12px 14px", background: "#f4fbf8",
                    borderRadius: 8, border: "1px solid #d4ece4" }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 8,
                      textTransform: "uppercase" as const, letterSpacing: ".05em" }}>
          Döneme Bağla (opsiyonel)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d4ece4",
                           fontSize: 13, background: "#fff", color: "#0a1f1a" }}
            value={instId} onChange={e => setInstId(e.target.value)}>
            <option value="">— Tesis seç —</option>
            {installations.map(i => <option key={i.id} value={i.id}>{i.facilityName}</option>)}
          </select>
          <select style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #d4ece4",
                           fontSize: 13, background: "#fff", color: "#0a1f1a" }}
            value={periodId} onChange={e => setPeriodId(e.target.value)}
            disabled={!instId || periods.length === 0}>
            <option value="">— Dönem seç —</option>
            {periods.map(p => <option key={p.id} value={p.id}>{p.periodName}</option>)}
          </select>
        </div>
        {periodId && (
          <div style={{ fontSize: 11, color: "#009966", marginTop: 5 }}>
            Saatlik veriler bu döneme kaydedilecek · Üretim varsa CFE otomatik hesaplanır
          </div>
        )}
      </div>
    </>
  );

  // ── Adım 1: Dosya seçimi ───────────────────────────────────────────────────
  if (step === "pick") {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        {topPanel}

        <div
          style={{ ...s.dzone, ...(drag ? s.dzA : {}) }}
          onDragOver={e => { e.preventDefault(); setDrag(true); }}
          onDragLeave={() => setDrag(false)}
          onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
          onClick={() => !colsLoading && inputRef.current?.click()}
        >
          <div style={{ fontSize: 38, marginBottom: 10 }}>
            {colsLoading ? "⏳" : "📂"}
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#0a1f1a", marginBottom: 6 }}>
            {colsLoading ? "Kolon bilgisi alınıyor…" : "CSV veya Excel dosyasını yükle"}
          </div>
          <div style={{ fontSize: 13, color: "#5c7a72" }}>
            {colsLoading ? "Lütfen bekleyin" : "Dosyayı buraya sürükle veya tıklayarak seç"}
          </div>
          <input
            ref={inputRef} type="file" accept=".csv,.xlsx,.xls"
            style={{ display: "none" }}
            onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }}
          />
        </div>

        <div style={s.how}>
          <strong>Desteklenen:</strong> CSV (virgül / <code>;</code>), Excel (.xlsx)<br />
          <strong>Kolon formatları:</strong><br />
          <code>hour &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;consumptionKwh &nbsp;&nbsp;production_kwh</code><br />
          <code>EIC &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Zaman &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Tüketim (Çekiş) &nbsp;Üretim (Veriş)</code><br />
          <code style={{ color: "#94A3B8" }}>Konsolide &nbsp;2025-01-01 00:00:00 &nbsp;&nbsp;&nbsp;14068,5 &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;0</code><br />
          <br />
          Dosya yüklendikten sonra <strong>kolon eşleştirme</strong> ekranı açılır.
        </div>

        {err && <div style={s.err}>{err}</div>}
      </div>
    );
  }

  // ── Adım 2: Kolon Eşleştirme ───────────────────────────────────────────────
  const selStyle: React.CSSProperties = {
    width: "100%", padding: "8px 10px", borderRadius: 7,
    border: "1px solid #d4ece4", fontSize: 13,
    background: "#fff", color: "#0a1f1a", fontFamily: "inherit",
  };
  const lblStyle: React.CSSProperties = {
    fontSize: 12, fontWeight: 700, color: "#1a3530", marginBottom: 5, display: "block",
  };

  const mappedPreview = colPreview.map(row => ({
    _hour:        colMap.hour        ? row[colMap.hour]        ?? "—" : "—",
    _consumption: colMap.consumption ? row[colMap.consumption] ?? "—" : "—",
    _production:  colMap.production  ? row[colMap.production]  ?? "—" : "—",
  }));

  return (
    <div style={{ maxWidth: 780, margin: "0 auto" }}>
      {topPanel}

      {/* Dosya başlığı */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20,
                    padding: "12px 16px", background: "#e6f9f2", borderRadius: 8,
                    border: "1px solid rgba(0,184,122,.3)" }}>
        <span style={{ fontSize: 22 }}>{file?.name.endsWith(".csv") ? "📄" : "📊"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1f1a" }}>{file?.name}</div>
          <div style={{ fontSize: 12, color: "#5c7a72" }}>
            {file ? `${(file.size / 1024).toFixed(1)} KB · ${columns.length} sütun tespit edildi` : ""}
          </div>
        </div>
        <button onClick={resetPick}
          style={{ ...s.btnSm, fontSize: 12, padding: "6px 12px" }}>
          ← Değiştir
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 }}>
        {/* Kolon eşleştirme */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5c7a72", marginBottom: 12,
                        textTransform: "uppercase" as const, letterSpacing: ".07em" }}>
            Kolon Eşleştirme
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lblStyle}>
              ⏱ Zaman / Saat <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select style={selStyle} value={colMap.hour ?? ""}
              onChange={e => setColMap(m => ({ ...m, hour: e.target.value }))}>
              <option value="">— Sütun seçin —</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lblStyle}>
              ⚡ Tüketim (kWh) <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <select style={selStyle} value={colMap.consumption ?? ""}
              onChange={e => setColMap(m => ({ ...m, consumption: e.target.value }))}>
              <option value="">— Sütun seçin —</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={lblStyle}>
              ☀ Üretim (kWh)
              <span style={{ color: "#5c7a72", fontWeight: 400, marginLeft: 6 }}>— opsiyonel</span>
            </label>
            <select style={selStyle} value={colMap.production ?? ""}
              onChange={e => setColMap(m => ({ ...m, production: e.target.value }))}>
              <option value="">— Yok / Atla —</option>
              {columns.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          {!canCalculate && (
            <div style={{ fontSize: 12, color: "#f59e0b", background: "#fef3c7",
                          borderRadius: 6, padding: "8px 10px" }}>
              Zaman ve Tüketim sütunları seçilmeden hesaplama başlatılamaz.
            </div>
          )}
        </div>

        {/* Tüm sütunlar listesi */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5c7a72", marginBottom: 12,
                        textTransform: "uppercase" as const, letterSpacing: ".07em" }}>
            Dosyadaki Sütunlar ({columns.length})
          </div>
          <div style={{ border: "1px solid #d4ece4", borderRadius: 8, overflow: "hidden" }}>
            {columns.map(col => {
              const isHour  = colMap.hour        === col;
              const isCons  = colMap.consumption === col;
              const isProd  = colMap.production  === col;
              const tag     = isHour ? "ZAMAN" : isCons ? "TÜKETİM" : isProd ? "ÜRETİM" : null;
              const tagClr  = isHour ? "#3b82f6" : isCons ? "#00b87a" : "#f59e0b";
              return (
                <div key={col} style={{
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                  padding: "8px 12px", borderBottom: "1px solid #eef7f3",
                  background: tag ? "#f4fbf8" : "#fff",
                }}>
                  <span style={{ fontSize: 13, color: "#1a3530", fontFamily: "monospace" }}>{col}</span>
                  {tag && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: "#fff",
                                   background: tagClr, borderRadius: 4, padding: "2px 7px" }}>
                      {tag}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Veri önizlemesi */}
      {colPreview.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5c7a72", marginBottom: 8,
                        textTransform: "uppercase" as const, letterSpacing: ".07em" }}>
            Veri Önizlemesi — ilk {colPreview.length} satır (seçilen kolonlar)
          </div>
          <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #d4ece4" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" as const, fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#f4fbf8" }}>
                  <th style={{ padding: "8px 12px", textAlign: "left" as const,
                               fontWeight: 700, color: "#3b82f6", whiteSpace: "nowrap" as const }}>
                    Zaman {colMap.hour ? `(${colMap.hour})` : "— seçilmedi"}
                  </th>
                  <th style={{ padding: "8px 12px", textAlign: "right" as const,
                               fontWeight: 700, color: "#00b87a", whiteSpace: "nowrap" as const }}>
                    Tüketim kWh {colMap.consumption ? `(${colMap.consumption})` : "— seçilmedi"}
                  </th>
                  {colMap.production && (
                    <th style={{ padding: "8px 12px", textAlign: "right" as const,
                                 fontWeight: 700, color: "#f59e0b", whiteSpace: "nowrap" as const }}>
                      Üretim kWh ({colMap.production})
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {mappedPreview.map((row, i) => (
                  <tr key={i} style={{ borderTop: "1px solid #eef7f3" }}>
                    <td style={{ padding: "7px 12px", color: "#1a3530",
                                 whiteSpace: "nowrap" as const, fontFamily: "monospace", fontSize: 11 }}>
                      {row._hour}
                    </td>
                    <td style={{ padding: "7px 12px", textAlign: "right" as const,
                                 color: "#0a1f1a", fontWeight: 600 }}>
                      {row._consumption}
                    </td>
                    {colMap.production && (
                      <td style={{ padding: "7px 12px", textAlign: "right" as const,
                                   color: "#0a1f1a" }}>
                        {row._production}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {err && <div style={s.err}>{err}</div>}

      <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
        <button style={s.btnSm} onClick={resetPick}>← Farklı Dosya</button>
        <button
          style={{ ...s.btn, opacity: !canCalculate || loading ? 0.5 : 1, minWidth: 220 }}
          disabled={!canCalculate || loading}
          onClick={calculate}
        >
          {loading ? "Hesaplanıyor…" : "Onayla ve Hesapla →"}
        </button>
      </div>
    </div>
  );
}

/* ── Print Report ─────────────────────────────────────────────────────────── */
function printGecReport(result: GecResult) {
  const hasProduction = result.hasProduction && result.totalProductionKwh > 0;

  const rows = result.monthly.map(m => `
    <tr>
      <td>${m.monthName}</td>
      <td style="text-align:right">${(m.consumptionKwh / 1000).toFixed(2)}</td>
      ${hasProduction ? `<td style="text-align:right">${(m.productionKwh / 1000).toFixed(2)}</td>` : ""}
      <td style="text-align:right">${m.avgEfGco2Kwh.toFixed(1)}</td>
      <td style="text-align:right;font-weight:700">${m.tco2.toFixed(3)}</td>
      <td style="text-align:right;color:#555">${m.hours}</td>
    </tr>`).join("");

  const cfeSection = result.cfeResult ? `
    <div class="section-title">24/7 CFE Eşleştirme Sonucu</div>
    <div class="kpi-row">
      <div class="kpi">
        <div class="kpi-l">CFE Skoru</div>
        <div class="kpi-v" style="color:#00b87a">${result.cfeResult.cfeScore.toFixed(1)}%</div>
      </div>
      <div class="kpi">
        <div class="kpi-l">Eşleşen Enerji</div>
        <div class="kpi-v">${(result.cfeResult.totalMatchedKwh / 1000).toFixed(1)}</div>
        <div style="font-size:10px;color:#5c7a72">MWh</div>
      </div>
      <div class="kpi">
        <div class="kpi-l">Toplam Üretim</div>
        <div class="kpi-v">${(result.cfeResult.totalProductionKwh / 1000).toFixed(1)}</div>
        <div style="font-size:10px;color:#5c7a72">MWh</div>
      </div>
      <div class="kpi">
        <div class="kpi-l">Eşleşen Saat</div>
        <div class="kpi-v">${result.cfeResult.matchedHours.toLocaleString()}</div>
        <div style="font-size:10px;color:#5c7a72">saat</div>
      </div>
    </div>` : "";

  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8"/>
<title>GEC Raporu — ${result.zoneId}</title>
<style>
  body{font-family:Arial,sans-serif;color:#0a1f1a;margin:0;padding:32px 48px;font-size:13px}
  .logo{font-size:22px;font-weight:900;color:#00b87a;margin-bottom:4px}
  .title{font-size:18px;font-weight:700;margin-bottom:2px}
  .sub{font-size:12px;color:#5c7a72;margin-bottom:20px}
  .kpi-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:20px}
  .kpi{border:1px solid #d4ece4;border-radius:8px;padding:14px}
  .kpi-l{font-size:10px;color:#5c7a72;font-weight:700;text-transform:uppercase;letter-spacing:.06em;margin-bottom:4px}
  .kpi-v{font-size:22px;font-weight:800}
  .section-title{font-size:11px;font-weight:700;color:#5c7a72;text-transform:uppercase;
                  letter-spacing:.08em;margin:20px 0 10px}
  table{width:100%;border-collapse:collapse;margin-bottom:20px}
  th{text-align:left;font-size:11px;color:#5c7a72;font-weight:700;text-transform:uppercase;
     padding:8px 10px;border-bottom:2px solid #d4ece4}
  td{padding:8px 10px;border-bottom:1px solid #eef7f3;font-size:12px}
  tr:last-child td{font-weight:700;background:#f4fbf8}
  .method{background:#f4fbf8;border-radius:8px;padding:14px 16px;font-size:11px;color:#5c7a72;line-height:1.8}
  .footer{margin-top:28px;padding-top:10px;border-top:1px solid #d4ece4;font-size:10px;
          color:#94a3b8;display:flex;justify-content:space-between}
  @media print{body{padding:24px 32px}}
</style>
</head>
<body>
<div class="logo">Voltfox</div>
<div class="title">Granüler Emisyon Hesaplama Raporu</div>
<div class="sub">
  Zone: <strong>${result.zoneId}</strong> &nbsp;·&nbsp;
  Metodoloji: Saatlik tüketim × Lokasyon bazlı EF &nbsp;·&nbsp;
  Hesaplama tarihi: ${new Date().toLocaleDateString("tr-TR", { day:"2-digit", month:"long", year:"numeric" })}
</div>

<div class="section-title">GEC — Emisyon Hesaplama</div>
<div class="kpi-row">
  <div class="kpi">
    <div class="kpi-l">Toplam Emisyon</div>
    <div class="kpi-v">${result.totalTco2.toFixed(2)}</div>
    <div style="font-size:10px;color:#5c7a72">tCO₂eq · Scope 2</div>
  </div>
  <div class="kpi">
    <div class="kpi-l">Toplam Tüketim</div>
    <div class="kpi-v">${(result.totalConsumptionKwh / 1000).toFixed(1)}</div>
    <div style="font-size:10px;color:#5c7a72">MWh</div>
  </div>
  <div class="kpi">
    <div class="kpi-l">Ort. Emisyon Faktörü</div>
    <div class="kpi-v">${result.avgEfGco2Kwh.toFixed(0)}</div>
    <div style="font-size:10px;color:#5c7a72">gCO₂/kWh</div>
  </div>
  <div class="kpi">
    <div class="kpi-l">Eşleşen Saat</div>
    <div class="kpi-v">${result.matchedHours.toLocaleString()}</div>
    <div style="font-size:10px;color:#5c7a72">${result.totalRows > 0 ? `${((result.matchedHours / result.totalRows) * 100).toFixed(0)}% kapsam` : "saat"}</div>
  </div>
</div>

${cfeSection}

<div class="section-title">Aylık Detay</div>
<table>
  <thead>
    <tr>
      <th>Ay</th>
      <th style="text-align:right">Tüketim (MWh)</th>
      ${hasProduction ? `<th style="text-align:right">Üretim (MWh)</th>` : ""}
      <th style="text-align:right">Ort. EF (gCO₂/kWh)</th>
      <th style="text-align:right">Emisyon (tCO₂eq)</th>
      <th style="text-align:right">Saat</th>
    </tr>
  </thead>
  <tbody>
    ${rows}
    <tr>
      <td>Toplam</td>
      <td style="text-align:right">${(result.totalConsumptionKwh / 1000).toFixed(2)}</td>
      ${hasProduction ? `<td style="text-align:right">${(result.totalProductionKwh / 1000).toFixed(2)}</td>` : ""}
      <td style="text-align:right">${result.avgEfGco2Kwh.toFixed(1)}</td>
      <td style="text-align:right">${result.totalTco2.toFixed(3)}</td>
      <td style="text-align:right;color:#555">${result.matchedHours}</td>
    </tr>
  </tbody>
</table>

<div class="method">
  <strong>Hesaplama:</strong> Σ(tüketimKwh × ci_direct_gCO₂/kWh) ÷ 1.000.000 = tCO₂eq<br/>
  <strong>EF Kaynağı:</strong> Electricity Maps · ${result.zoneId} · 2024 saatlik · lokasyon bazlı<br/>
  <strong>Kapsam:</strong> GHG Protocol Scope 2 — market-based (saatlik granüler)<br/>
  <strong>Referans:</strong> EU 2023/1773 Ek IV · ISO 14064-1:2018
</div>

<div class="footer">
  <span>Voltfox Platform v1.0 | ISO 14064-1 uyumlu</span>
  <span>${new Date().toISOString().slice(0, 10)}</span>
</div>

<script>window.onload = function(){ window.print(); }<\/script>
</body>
</html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (w) { w.document.write(html); w.document.close(); }
}

/* ── Result View ──────────────────────────────────────────────────────────── */
function ResultView({ result, onReset }: { result: GecResult; onReset: () => void }) {
  const maxTco2       = Math.max(...result.monthly.map(m => m.tco2));
  const hasProduction = result.hasProduction && result.totalProductionKwh > 0;

  // Grafik verisi: tüketim + üretim birlikte göster
  const chartData = result.monthly.map(m => ({
    monthName:      m.monthName,
    tco2:           m.tco2,
    consumptionMwh: m.consumptionKwh / 1000,
    productionMwh:  m.productionKwh  / 1000,
  }));

  return (
    <>
      {/* Info banner */}
      <div style={s.infoRow}>
        <span style={{ fontSize: 18 }}>✅</span>
        <span>
          <strong>{result.matchedHours.toLocaleString()}</strong> saatlik EF eşleştirmesi tamamlandı —
          zone: <strong>{result.zoneId}</strong> · metodoloji: saatlik tüketim × lokasyon bazlı EF
          {result.savedToPeriod && <span style={{ marginLeft: 8, fontWeight: 700 }}>· Döneme kaydedildi</span>}
          {result.savedCFE     && <span style={{ marginLeft: 8, fontWeight: 700, color: "#059669" }}>· CFE hesaplandı</span>}
        </span>
        <div style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
          <button style={{ ...s.btnSm, whiteSpace: "nowrap" as const }} onClick={() => printGecReport(result)}>
            ↓ PDF İndir
          </button>
          <button style={{ ...s.btnSm, whiteSpace: "nowrap" as const }} onClick={onReset}>
            Yeni Hesap
          </button>
        </div>
      </div>

      {/* GEC KPI row */}
      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Emisyon</div>
          <div style={{ ...s.kpiV, color: "#0a1f1a" }}>{result.totalTco2.toFixed(2)}</div>
          <div style={s.kpiU}>tCO₂eq · Scope 2</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Tüketim</div>
          <div style={s.kpiV}>{(result.totalConsumptionKwh / 1000).toFixed(1)}</div>
          <div style={s.kpiU}>MWh</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Ort. Emisyon Faktörü</div>
          <div style={{ ...s.kpiV, color: result.avgEfGco2Kwh < 200 ? "#059669" : result.avgEfGco2Kwh < 400 ? "#d97706" : "#ef4444" }}>
            {result.avgEfGco2Kwh.toFixed(0)}
          </div>
          <div style={s.kpiU}>gCO₂/kWh · ağırlıklı ort.</div>
        </div>
        {hasProduction ? (
          <div style={s.kpi}>
            <div style={s.kpiL}>Toplam Üretim</div>
            <div style={{ ...s.kpiV, color: "#059669" }}>{(result.totalProductionKwh / 1000).toFixed(1)}</div>
            <div style={s.kpiU}>MWh · yenilenebilir</div>
          </div>
        ) : (
          <div style={s.kpi}>
            <div style={s.kpiL}>Eşleşen Saat</div>
            <div style={s.kpiV}>{result.matchedHours.toLocaleString()}</div>
            <div style={s.kpiU}>
              {result.totalRows > 0 ? `${((result.matchedHours / result.totalRows) * 100).toFixed(0)}% kapsam` : "saat"}
            </div>
          </div>
        )}
      </div>

      {/* CFE Sonucu (production_kwh ve periodId varsa) */}
      {result.cfeResult && (
        <div style={s.cfeBox}>
          <div style={s.cfeH}>24/7 CFE Eşleştirme Sonucu — Otomatik Hesaplandı</div>
          <div style={s.cfeGrid}>
            <div style={s.cfeKpi}>
              <div style={s.cfeKL}>CFE Skoru</div>
              <div style={{ ...s.cfeKV, color: result.cfeResult.cfeScore >= 70 ? "#059669" : result.cfeResult.cfeScore >= 40 ? "#d97706" : "#ef4444" }}>
                {result.cfeResult.cfeScore.toFixed(1)}%
              </div>
              <div style={s.cfeKU}>karbon serbest</div>
            </div>
            <div style={s.cfeKpi}>
              <div style={s.cfeKL}>Eşleşen Enerji</div>
              <div style={{ ...s.cfeKV, color: "#059669" }}>
                {(result.cfeResult.totalMatchedKwh / 1000).toFixed(1)}
              </div>
              <div style={s.cfeKU}>MWh</div>
            </div>
            <div style={s.cfeKpi}>
              <div style={s.cfeKL}>Toplam Üretim</div>
              <div style={s.cfeKV}>{(result.cfeResult.totalProductionKwh / 1000).toFixed(1)}</div>
              <div style={s.cfeKU}>MWh · yenilenebilir</div>
            </div>
            <div style={s.cfeKpi}>
              <div style={s.cfeKL}>Eşleşen Saat</div>
              <div style={s.cfeKV}>{result.cfeResult.matchedHours.toLocaleString()}</div>
              <div style={s.cfeKU}>saat</div>
            </div>
          </div>
        </div>
      )}

      {/* Aylık bar chart — emisyon */}
      <div style={s.card}>
        <div style={s.cardH}>Aylık Emisyon Dağılımı — tCO₂eq</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
            <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: "#5c7a72" }} />
            <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit=" t" width={56} />
            <Tooltip
              formatter={(v: unknown) => [`${Number(v).toFixed(3)} tCO₂eq`, "Emisyon"] as [string, string]}
              labelStyle={{ fontWeight: 600, color: "#0a1f1a" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #d4ece4", fontSize: 12 }}
            />
            <Bar dataKey="tco2" radius={[4, 4, 0, 0]}>
              {result.monthly.map((m) => (
                <Cell key={m.month} fill={co2Color(m.tco2, maxTco2)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Tüketim + Üretim karşılaştırma (üretim varsa) */}
      {hasProduction && (
        <div style={s.card}>
          <div style={s.cardH}>Aylık Tüketim vs Üretim — MWh</div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
              <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: "#5c7a72" }} />
              <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit=" MWh" width={70} />
              <Tooltip
                formatter={(v: unknown, name: unknown) =>
                  [`${Number(v).toFixed(1)} MWh`, name === "consumptionMwh" ? "Tüketim" : "Üretim"] as [string, string]}
                labelStyle={{ fontWeight: 600, color: "#0a1f1a" }}
                contentStyle={{ borderRadius: 8, border: "1px solid #d4ece4", fontSize: 12 }}
              />
              <Legend
                formatter={(v) => v === "consumptionMwh" ? "Tüketim" : "Üretim"}
                wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
              />
              <Bar dataKey="consumptionMwh" fill="#0a1f1a"  radius={[4, 4, 0, 0]} />
              <Bar dataKey="productionMwh"  fill="#00b87a"  radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Aylık detay tablosu */}
      <div style={s.card}>
        <div style={s.cardH}>Aylık Detay</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Ay</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Tüketim (MWh)</th>
              {hasProduction && (
                <th style={{ ...s.th, textAlign: "right" as const }}>Üretim (MWh)</th>
              )}
              <th style={{ ...s.th, textAlign: "right" as const }}>Ort. EF (gCO₂/kWh)</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Emisyon (tCO₂eq)</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Saat</th>
            </tr>
          </thead>
          <tbody>
            {result.monthly.map((m: GecMonthlyPoint) => (
              <tr key={m.month}>
                <td style={s.td}>{m.monthName}</td>
                <td style={s.tdR}>{(m.consumptionKwh / 1000).toFixed(2)}</td>
                {hasProduction && (
                  <td style={{ ...s.tdR, color: "#059669" }}>{(m.productionKwh / 1000).toFixed(2)}</td>
                )}
                <td style={s.tdR}>
                  <span style={{ color: m.avgEfGco2Kwh < 200 ? "#059669" : m.avgEfGco2Kwh < 400 ? "#d97706" : "#ef4444", fontWeight: 600 }}>
                    {m.avgEfGco2Kwh.toFixed(1)}
                  </span>
                </td>
                <td style={{ ...s.tdR, fontWeight: 600 }}>{m.tco2.toFixed(3)}</td>
                <td style={{ ...s.tdR, color: "#5c7a72" }}>{m.hours}</td>
              </tr>
            ))}
            <tr style={{ background: "#f4fbf8" }}>
              <td style={{ ...s.td, fontWeight: 700 }}>Toplam</td>
              <td style={{ ...s.tdR, fontWeight: 700 }}>{(result.totalConsumptionKwh / 1000).toFixed(2)}</td>
              {hasProduction && (
                <td style={{ ...s.tdR, fontWeight: 700, color: "#059669" }}>
                  {(result.totalProductionKwh / 1000).toFixed(2)}
                </td>
              )}
              <td style={{ ...s.tdR, fontWeight: 700 }}>{result.avgEfGco2Kwh.toFixed(1)}</td>
              <td style={{ ...s.tdR, fontWeight: 700, color: "#0a1f1a" }}>{result.totalTco2.toFixed(3)}</td>
              <td style={{ ...s.tdR, fontWeight: 700, color: "#5c7a72" }}>{result.matchedHours}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Metodoloji notu */}
      <div style={{ ...s.card, marginBottom: 0, fontSize: 12, color: "#5c7a72" }}>
        <div style={s.cardH}>Metodoloji</div>
        <div>
          <strong>Hesaplama:</strong> Σ(tüketimKwh × ci_direct_gCO₂/kWh) ÷ 1.000.000 = tCO₂eq<br />
          <strong>EF Kaynağı:</strong> Electricity Maps · {result.zoneId} · 2024 saatlik · lokasyon bazlı<br />
          <strong>Kapsam:</strong> GHG Protocol Scope 2 — market-based (saatlik granüler)<br />
          <strong>Referans:</strong> EU 2023/1773 Ek IV · ISO 14064-1:2018
          {result.savedCFE && (
            <><br /><strong>CFE Metodoloji:</strong> EnergyTag Granular Certificate scheme · min(tüketim, üretim) / saat</>
          )}
        </div>
      </div>
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function GecPage() {
  const [result, setResult] = useState<GecResult | null>(null);

  return (
    <div style={s.page}>
      <div style={s.h1}>Granüler Emisyon Hesaplama</div>
      <div style={s.sub}>
        CSV veya Excel yükle · saatlik tüketim × saatlik EF → Scope 2 tCO₂
        {result && (
          <span style={{ color: "#00b87a", marginLeft: 8 }}>
            · {result.zoneId} · {result.matchedHours} saat
            {result.hasProduction && result.cfeResult && ` · CFE %${result.cfeResult.cfeScore.toFixed(1)}`}
          </span>
        )}
      </div>

      {result
        ? <ResultView result={result} onReset={() => setResult(null)} />
        : <UploadView onResult={setResult} />
      }
    </div>
  );
}
