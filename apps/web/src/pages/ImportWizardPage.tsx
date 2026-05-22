import { Fragment, useEffect, useRef, useState } from "react";
import { api } from "../lib/api.js";
import type { Installation } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";

const BASE = "/api/v1";

interface ParsedPeriod {
  periodName:       string;
  startDate:        string;
  endDate:          string;
  reportYear:       number;
  importCountry:    string;
  cnCode:           string;
  prodVolumeTonne:  number;
  scope1DirectTco2: number;
  scope1Quality:    string;
  electricityKwh:   number;
  electricitySource: string;
  baselineEf:       number;
  renewableEf:      number;
  matchingRatePct:  number;
  carbonPriceEur:   number | null;
}

interface ValidationError { row: number; field: string; error: string; }

interface PreviewResult {
  installationId: string;
  facilityName:   string;
  totalRows:      number;
  validRows:      number;
  errorCount:     number;
  periods:        ParsedPeriod[];
  errors:         ValidationError[];
}

interface ImportResult {
  created: number;
  failed:  number;
  message: string;
  details: { periodName: string; error: string }[];
}

const CSV_TEMPLATE = [
  "period_name,start_date,end_date,report_year,import_country,cn_code,prod_volume_tonne,scope1_direct_tco2,scope1_quality,electricity_kwh,electricity_source,baseline_ef,renewable_ef,matching_rate_pct,carbon_price_eur",
  "Q1-2024,2024-01-01,2024-03-31,2024,DE,7208,5000,125.5,measured,500000,grid,0.4800,0.1500,0,",
  "Q2-2024,2024-04-01,2024-06-30,2024,DE,7208,5200,130.0,measured,520000,grid,0.4800,0.1500,0,",
].join("\n");

type Step = 1 | 2 | 3;

export default function ImportWizardPage() {
  const [step,          setStep]          = useState<Step>(1);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [instId,        setInstId]        = useState("");
  const [file,          setFile]          = useState<File | null>(null);
  const [preview,       setPreview]       = useState<PreviewResult | null>(null);
  const [result,        setResult]        = useState<ImportResult | null>(null);
  const [loading,       setLoading]       = useState(false);
  const [error,         setError]         = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.installations.list().then(setInstallations);
  }, []);

  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = "voltfox-period-import-template.csv";
    a.click(); URL.revokeObjectURL(url);
  }

  async function uploadPreview() {
    if (!instId || !file) return;
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Oturum bulunamadı.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${BASE}/installations/${instId}/periods/import/preview`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${session.access_token}` },
        body: form,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message ?? "Önizleme başarısız.");
      }
      setPreview(await res.json());
      setStep(2);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Hata oluştu.");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    if (!preview || preview.periods.length === 0) return;
    setLoading(true); setError(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Oturum bulunamadı.");
      const res = await fetch(`${BASE}/installations/${instId}/periods/import/confirm`, {
        method:  "POST",
        headers: { "Authorization": `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body:    JSON.stringify({ periods: preview.periods }),
      });
      const r = await res.json();
      setResult(r);
      setStep(3);
    } catch (e: unknown) {
      setError((e as Error).message ?? "Import başarısız.");
    } finally {
      setLoading(false);
    }
  }

  function reset() {
    setStep(1); setPreview(null); setResult(null);
    setFile(null); setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  const stepStyle = (s: Step) => ({
    display: "flex", alignItems: "center", justifyContent: "center",
    width: 28, height: 28, borderRadius: "50%", fontSize: 13, fontWeight: 700,
    background: step >= s ? "#3b82f6" : "#e5e7eb",
    color: step >= s ? "#fff" : "#9ca3af",
  });

  return (
    <div style={{ padding: "28px 32px", maxWidth: 820 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0, marginBottom: 8 }}>
        CSV Import Sihirbazı
      </h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 24 }}>
        CSV dosyası ile toplu dönem yükleme — en fazla 500 satır
      </p>

      {/* Stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 32 }}>
        {([1, 2, 3] as Step[]).map((s, i) => (
          <Fragment key={s}>
            <div style={stepStyle(s)}>{s}</div>
            <div style={{ fontSize: 13, color: step >= s ? "#1d4ed8" : "#6b7280", fontWeight: step === s ? 600 : 400 }}>
              {["Dosya Yükle", "Önizleme", "Tamamlandı"][i]}
            </div>
            {i < 2 && <div style={{ flex: 1, height: 1, background: "#e5e7eb", margin: "0 4px" }} />}
          </Fragment>
        ))}
      </div>

      {error && (
        <div style={{ padding: "10px 14px", borderRadius: 6, background: "#fee2e2", color: "#b91c1c", fontSize: 14, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Step 1: Dosya seç */}
      {step === 1 && (
        <div style={{ background: "#fff", borderRadius: 10, padding: "24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              Tesis *
            </label>
            <select
              value={instId}
              onChange={e => setInstId(e.target.value)}
              style={{ width: "100%", padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
            >
              <option value="">Tesis seçin...</option>
              {installations.map(i => (
                <option key={i.id} value={i.id}>{i.facilityName} ({i.facilityCountry})</option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 13, fontWeight: 500, color: "#374151", marginBottom: 6 }}>
              CSV Dosyası *
            </label>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              onChange={e => setFile(e.target.files?.[0] ?? null)}
              style={{ fontSize: 14 }}
            />
            {file && <div style={{ fontSize: 12, color: "#6b7280", marginTop: 4 }}>
              {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </div>}
          </div>

          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button
              onClick={downloadTemplate}
              style={{ padding: "7px 14px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 13, cursor: "pointer" }}
            >
              📥 Şablon İndir (CSV)
            </button>
            <button
              onClick={uploadPreview}
              disabled={!instId || !file || loading}
              style={{
                padding: "9px 22px", borderRadius: 7, border: "none",
                background: !instId || !file || loading ? "#d1d5db" : "#3b82f6",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {loading ? "Analiz ediliyor…" : "Sonraki →"}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Önizleme */}
      {step === 2 && preview && (
        <div>
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            {[
              { label: "Toplam Satır", value: preview.totalRows, color: "#374151" },
              { label: "Geçerli", value: preview.validRows, color: "#065f46" },
              { label: "Hatalı", value: preview.errorCount, color: preview.errorCount > 0 ? "#b91c1c" : "#6b7280" },
            ].map(c => (
              <div key={c.label} style={{ background: "#fff", borderRadius: 8, padding: "14px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", flex: 1 }}>
                <div style={{ fontSize: 11, color: "#6b7280" }}>{c.label}</div>
                <div style={{ fontSize: 24, fontWeight: 700, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>

          {preview.errors.length > 0 && (
            <div style={{ background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: 8, padding: "12px 16px", marginBottom: 16, fontSize: 13, color: "#92400e" }}>
              <strong>Hatalı satırlar ({preview.errors.length}):</strong>
              <ul style={{ margin: "6px 0 0", padding: "0 0 0 16px" }}>
                {preview.errors.slice(0, 10).map((e, i) => (
                  <li key={i}>Satır {e.row} — {e.field}: {e.error}</li>
                ))}
                {preview.errors.length > 10 && <li>… ve {preview.errors.length - 10} hata daha</li>}
              </ul>
            </div>
          )}

          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "auto", marginBottom: 20 }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  {["Dönem", "Başlangıç", "Bitiş", "Yıl", "CN Kodu", "Elektrik (MWh)", "Scope 1 (tCO₂)"].map(h => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#374151", fontWeight: 600 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.periods.map((p, i) => (
                  <tr key={i} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.periodName}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{p.startDate.slice(0, 10)}</td>
                    <td style={{ padding: "8px 12px", color: "#6b7280" }}>{p.endDate.slice(0, 10)}</td>
                    <td style={{ padding: "8px 12px" }}>{p.reportYear}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace" }}>{p.cnCode}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{(p.electricityKwh / 1000).toFixed(1)}</td>
                    <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.scope1DirectTco2.toFixed(1)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <button onClick={reset} style={{ padding: "8px 16px", borderRadius: 6, border: "1px solid #d1d5db", background: "#fff", color: "#374151", fontSize: 14, cursor: "pointer" }}>
              ← Geri
            </button>
            <button
              onClick={confirm}
              disabled={preview.validRows === 0 || loading}
              style={{
                padding: "9px 22px", borderRadius: 7, border: "none",
                background: preview.validRows === 0 || loading ? "#d1d5db" : "#059669",
                color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
              }}
            >
              {loading ? "Yükleniyor…" : `${preview.validRows} Dönemi İçe Aktar`}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Tamamlandı */}
      {step === 3 && result && (
        <div style={{ background: "#fff", borderRadius: 10, padding: "40px 32px", textAlign: "center", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{result.failed === 0 ? "✅" : "⚠️"}</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 8 }}>{result.message}</div>
          {result.failed > 0 && (
            <div style={{ fontSize: 14, color: "#b91c1c", marginBottom: 16 }}>
              Başarısız: {result.details.map(d => d.periodName).join(", ")}
            </div>
          )}
          <button onClick={reset} style={{ padding: "10px 24px", borderRadius: 7, border: "none", background: "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" }}>
            Yeni Import
          </button>
        </div>
      )}
    </div>
  );
}
