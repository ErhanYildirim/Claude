import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { Installation, CFEBody } from "../lib/api.js";

function generateSlots(rows: ManualRow[]): CFEBody["slots"] {
  const slots: CFEBody["slots"] = [];
  for (const row of rows) {
    if (!row.date || row.consumptionMwh <= 0) continue;
    const [y, m] = row.date.split("-").map(Number);
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
interface PeriodItem { installationId: string; facilityName: string; periodId: string; periodName: string; }

type Step = 1 | 2 | 3 | 4;
type Method = "csv" | "manual";

const STEPS = [
  { n: 1, label: "Tesis & Dönem" },
  { n: 2, label: "Yöntem" },
  { n: 3, label: "Veri Girişi" },
  { n: 4, label: "Sonuç" },
];

export default function CfeDataEntryPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";
  const navigate = useNavigate();

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1e3830" : "#f4fbf8";

  const [step,   setStep]   = useState<Step>(1);
  const [method, setMethod] = useState<Method>("csv");
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [loadingPeriods, setLoadingPeriods] = useState(true);
  const [selectedKey, setSelectedKey] = useState("");

  // CSV state
  const [csvFile,     setCsvFile]     = useState<File | null>(null);
  const [csvDragging, setCsvDragging] = useState(false);
  const [csvPreview,  setCsvPreview]  = useState<string[][]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  // Manual state
  const [manualRows, setManualRows] = useState<ManualRow[]>([
    { date: new Date().toISOString().slice(0, 7), consumptionMwh: 0, productionMwh: 0 },
  ]);

  // Result state
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState("");
  const [result, setResult]         = useState<{ cfeScore: number; hours: number; rowCount?: number; errorCount?: number; errors?: string[] } | null>(null);

  useEffect(() => {
    async function load() {
      const list: Installation[] = await api.installations.list();
      const details = await Promise.all(list.map(i => api.installations.get(i.id)));
      const all: PeriodItem[] = [];
      for (const inst of details)
        for (const p of inst.periods)
          all.push({ installationId: inst.id, facilityName: inst.facilityName, periodId: p.id, periodName: p.periodName });
      setPeriods(all);
      if (all.length > 0) setSelectedKey(`${all[0].installationId}|${all[0].periodId}`);
      setLoadingPeriods(false);
    }
    load().catch(() => setLoadingPeriods(false));
  }, []);

  const selected = periods.find(p => `${p.installationId}|${p.periodId}` === selectedKey) ?? null;

  function parsePreview(file: File) {
    const reader = new FileReader();
    reader.onload = e => {
      const lines = ((e.target?.result as string) ?? "").split(/\r?\n/).filter(Boolean).slice(0, 6);
      setCsvPreview(lines.map(l => l.split(",")));
    };
    reader.readAsText(file);
  }

  function selectFile(file: File | null) {
    setCsvFile(file);
    setCsvPreview([]);
    if (file) parsePreview(file);
  }

  async function submit() {
    if (!selected) return;
    setSubmitting(true);
    setError("");
    try {
      if (method === "csv") {
        if (!csvFile) return;
        const res = await api.cfe.importCsv(selected.installationId, selected.periodId, csvFile);
        setResult({ cfeScore: res.result.cfeScore, hours: res.rowCount, rowCount: res.rowCount, errorCount: res.errorCount, errors: res.errors });
      } else {
        const slots = generateSlots(manualRows);
        if (slots.length === 0) { setError("En az bir ay için veri girin."); setSubmitting(false); return; }
        const res = await api.cfe.submit(selected.installationId, selected.periodId, { slots });
        setResult({ cfeScore: res.cfeScore, hours: slots.length });
      }
      setStep(4);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Bir hata oluştu");
    }
    setSubmitting(false);
  }

  const card: React.CSSProperties = { background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: "28px" };
  const btnPrimary: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#00b87a", color: "#fff", fontFamily: "inherit" };
  const btnSecondary: React.CSSProperties = { padding: "10px 24px", borderRadius: 8, border: `1px solid ${border}`, cursor: "pointer", fontWeight: 600, fontSize: 14, background: inputBg, color: text, fontFamily: "inherit" };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "9px 12px", borderRadius: 7, border: `1px solid ${border}`, fontSize: 13, background: inputBg, color: text, boxSizing: "border-box" };

  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>CFE Veri Girişi</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 32 }}>Tüketim ve üretim verisi yükle — saatlik CFE eşleştirme</div>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 36 }}>
        {STEPS.map((s, i) => (
          <div key={s.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1 }}>
              <div style={{
                width: 32, height: 32, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 13, fontWeight: 700,
                background: step === s.n ? "#00b87a" : step > s.n ? "#059669" : (isDark ? "#1a3530" : "#e5efea"),
                color: step >= s.n ? "#fff" : muted,
                transition: "background .2s",
              }}>
                {step > s.n ? "✓" : s.n}
              </div>
              <div style={{ fontSize: 11, color: step === s.n ? "#00b87a" : muted, marginTop: 6, fontWeight: step === s.n ? 700 : 400, whiteSpace: "nowrap" }}>
                {s.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ height: 2, flex: 1, background: step > s.n ? "#059669" : (isDark ? "#1a3530" : "#e5efea"), marginBottom: 24, transition: "background .2s" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Tesis & Dönem */}
      {step === 1 && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 20 }}>Tesis ve Dönem Seçin</div>
          {loadingPeriods ? (
            <div style={{ color: muted, fontSize: 13 }}>Yükleniyor...</div>
          ) : periods.length === 0 ? (
            <div style={{ color: muted, fontSize: 13 }}>Henüz tesis veya dönem oluşturulmamış.</div>
          ) : (
            <>
              <div style={{ marginBottom: 20 }}>
                <label style={{ fontSize: 12, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", display: "block", marginBottom: 8 }}>
                  Tesis › Dönem
                </label>
                <select
                  value={selectedKey}
                  onChange={e => setSelectedKey(e.target.value)}
                  style={{ ...inputStyle, cursor: "pointer" }}
                >
                  {periods.map(p => (
                    <option key={`${p.installationId}|${p.periodId}`} value={`${p.installationId}|${p.periodId}`}>
                      {p.facilityName} › {p.periodName}
                    </option>
                  ))}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button style={btnPrimary} disabled={!selectedKey} onClick={() => setStep(2)}>
                  İleri →
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Step 2: Yöntem */}
      {step === 2 && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 20 }}>Veri Yükleme Yöntemini Seçin</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 24 }}>
            {([
              { id: "csv" as Method, icon: "📄", title: "CSV Yükle", desc: "Saatlik timestamp formatında CSV — en doğru 24/7 analizi için" },
              { id: "manual" as Method, icon: "✏️", title: "Manuel Giriş", desc: "Aylık toplam tüketim/üretim girin — saatlik veriye eşit dağıtılır" },
            ] as const).map(opt => (
              <div
                key={opt.id}
                onClick={() => setMethod(opt.id)}
                style={{
                  padding: "20px", borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${method === opt.id ? "#00b87a" : border}`,
                  background: method === opt.id ? (isDark ? "#0d2a20" : "#f0fdf4") : bg,
                  transition: "border-color .15s, background .15s",
                }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>{opt.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 6 }}>{opt.title}</div>
                <div style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>{opt.desc}</div>
                {opt.id === "manual" && (
                  <div style={{ marginTop: 8, fontSize: 11, color: "#d97706", background: isDark ? "#451a03" : "#fef3c7", padding: "4px 8px", borderRadius: 6 }}>
                    Not: Düz dağıtım — %100 hassas 24/7 değil
                  </div>
                )}
              </div>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button style={btnSecondary} onClick={() => setStep(1)}>← Geri</button>
            <button style={btnPrimary} onClick={() => setStep(3)}>İleri →</button>
          </div>
        </div>
      )}

      {/* Step 3: Veri Girişi */}
      {step === 3 && (
        <div style={card}>
          <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 4 }}>
            {method === "csv" ? "CSV Dosyası Yükle" : "Aylık Veri Gir"}
          </div>
          <div style={{ fontSize: 13, color: muted, marginBottom: 20 }}>
            {selected?.facilityName} › {selected?.periodName}
          </div>

          {error && <div style={{ color: "#DC2626", fontSize: 13, marginBottom: 14, padding: "8px 12px", background: isDark ? "#450a0a" : "#fef2f2", borderRadius: 7 }}>{error}</div>}

          {method === "csv" ? (
            <>
              <div style={{ marginBottom: 6, fontSize: 12, color: muted }}>
                Format: <code style={{ background: inputBg, color: text, padding: "1px 6px", borderRadius: 4 }}>timestamp,consumption_kwh,production_kwh</code>
              </div>
              <div
                style={{
                  border: `2px dashed ${csvDragging ? "#00b87a" : border}`,
                  borderRadius: 8, padding: "32px", textAlign: "center", cursor: "pointer", marginBottom: 16,
                  background: csvDragging ? (isDark ? "#0d2a20" : "#f0fdf4") : inputBg,
                  transition: "border-color .15s, background .15s",
                }}
                onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
                onDragLeave={() => setCsvDragging(false)}
                onDrop={e => { e.preventDefault(); setCsvDragging(false); const f = e.dataTransfer.files[0]; if (f) selectFile(f); }}
                onClick={() => fileRef.current?.click()}
              >
                {csvFile ? (
                  <div>
                    <div style={{ fontWeight: 600, color: text }}>{csvFile.name}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 4 }}>{(csvFile.size / 1024).toFixed(0)} KB</div>
                  </div>
                ) : (
                  <div style={{ color: muted }}>
                    <div style={{ fontSize: 24, marginBottom: 8 }}>📄</div>
                    CSV dosyasını sürükleyin veya tıklayın
                  </div>
                )}
                <input ref={fileRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                  onChange={e => selectFile(e.target.files?.[0] ?? null)} />
              </div>

              {csvPreview.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                    Önizleme
                  </div>
                  <div style={{ overflowX: "auto", borderRadius: 7, border: `1px solid ${border}` }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                      <thead>
                        <tr style={{ background: inputBg }}>
                          {(csvPreview[0] ?? []).map((h, i) => (
                            <th key={i} style={{ padding: "6px 10px", textAlign: "left", fontWeight: 700, color: muted }}>{h.trim()}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvPreview.slice(1).map((row, ri) => (
                          <tr key={ri} style={{ borderTop: `1px solid ${border}` }}>
                            {row.map((cell, ci) => (
                              <td key={ci} style={{ padding: "5px 10px", color: text }}>{cell.trim()}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 32px", gap: 6, fontSize: 11, fontWeight: 700, color: muted, marginBottom: 8, textTransform: "uppercase", letterSpacing: ".04em" }}>
                <span>Ay (YYYY-MM)</span><span>Tüketim MWh</span><span>Üretim MWh</span><span></span>
              </div>
              <div style={{ maxHeight: 320, overflowY: "auto", marginBottom: 12 }}>
                {manualRows.map((row, i) => (
                  <div key={i} style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 32px", gap: 6, marginBottom: 8 }}>
                    <input type="month" value={row.date}
                      onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, date: e.target.value } : r))}
                      style={{ padding: "8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, background: inputBg, color: text }} />
                    <input type="number" min={0} step="0.1" value={row.consumptionMwh || ""} placeholder="0"
                      onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, consumptionMwh: parseFloat(e.target.value) || 0 } : r))}
                      style={{ padding: "8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, background: inputBg, color: text }} />
                    <input type="number" min={0} step="0.1" value={row.productionMwh || ""} placeholder="0"
                      onChange={e => setManualRows(prev => prev.map((r, j) => j === i ? { ...r, productionMwh: parseFloat(e.target.value) || 0 } : r))}
                      style={{ padding: "8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 13, background: inputBg, color: text }} />
                    <button onClick={() => setManualRows(prev => prev.filter((_, j) => j !== i))}
                      style={{ background: "none", border: `1px solid #fca5a5`, color: "#ef4444", borderRadius: 6, cursor: "pointer", fontSize: 14 }}>✕</button>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setManualRows(prev => [...prev, { date: new Date().toISOString().slice(0, 7), consumptionMwh: 0, productionMwh: 0 }])}
                style={{ fontSize: 13, color: "#009966", background: "none", border: `1px dashed ${border}`, borderRadius: 6, padding: "8px 16px", cursor: "pointer", marginBottom: 16, width: "100%", fontFamily: "inherit" }}
              >
                + Ay Ekle
              </button>
            </>
          )}

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button style={btnSecondary} onClick={() => setStep(2)}>← Geri</button>
            <button style={{ ...btnPrimary, opacity: submitting ? 0.7 : 1 }} disabled={submitting || (method === "csv" && !csvFile)} onClick={submit}>
              {submitting ? "Hesaplanıyor..." : "Hesapla & Kaydet"}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Sonuç */}
      {step === 4 && result && (
        <div style={card}>
          <div style={{ textAlign: "center", padding: "20px 0" }}>
            <div style={{ fontSize: 56, marginBottom: 16 }}>
              {result.cfeScore >= 70 ? "🌿" : result.cfeScore >= 40 ? "⚡" : "⚠️"}
            </div>
            <div style={{ fontSize: 28, fontWeight: 800, color: result.cfeScore >= 70 ? "#059669" : result.cfeScore >= 40 ? "#d97706" : "#dc2626", marginBottom: 8 }}>
              {result.cfeScore.toFixed(1)}% CFE
            </div>
            <div style={{ fontSize: 14, color: muted, marginBottom: 28 }}>
              {method === "csv" ? `${result.rowCount?.toLocaleString()} saatlik veri işlendi` : `${result.hours.toLocaleString()} saatlik slot oluşturuldu`}
              {result.errorCount ? <span style={{ color: "#d97706", marginLeft: 8 }}>· {result.errorCount} satır atlandı</span> : null}
            </div>

            {result.errors && result.errors.length > 0 && (
              <div style={{ textAlign: "left", marginBottom: 20 }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#d97706", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>
                  Atlanan Satırlar
                </div>
                <div style={{ maxHeight: 120, overflowY: "auto", border: "1px solid #fcd34d", borderRadius: 7, background: isDark ? "#451a03" : "#fffbeb", padding: "4px 0" }}>
                  {result.errors.map((err, i) => (
                    <div key={i} style={{ padding: "4px 10px", fontSize: 11, color: "#d97706" }}>{err}</div>
                  ))}
                </div>
              </div>
            )}

            <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
              <button style={btnPrimary} onClick={() => navigate("/cfe/matching")}>
                Eşleştirmeye Git →
              </button>
              <button style={btnSecondary} onClick={() => { setStep(1); setResult(null); setError(""); setCsvFile(null); setCsvPreview([]); }}>
                Yeni Veri Yükle
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
