import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import type { Installation } from "../lib/api.js";

interface Progress {
  id:             string;
  year:           number;
  metric:         string;
  targetValue:    number;
  baselineValue:  number | null;
  actualValue:    number | null;
  achievementPct: number | null;
  installationId: string | null;
  facilityName:   string;
  notes:          string | null;
}

const METRIC_LABEL: Record<string, string> = {
  see_voltfox:   "SEE Voltfox (tCO₂e/t)",
  scope2_tco2:   "Scope 2 (tCO₂)",
  reduction_pct: "Azaltım Hedefi (%)",
};

const METRIC_UNIT: Record<string, string> = {
  see_voltfox:   "tCO₂e/t",
  scope2_tco2:   "tCO₂",
  reduction_pct: "%",
};

function ProgressRing({ pct, size = 72 }: { pct: number | null; size?: number }) {
  const clamped = Math.min(100, Math.max(0, pct ?? 0));
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const dash  = (clamped / 100) * circ;
  const color = clamped >= 100 ? "#10b981" : clamped >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={6} />
      <circle
        cx={size / 2} cy={size / 2} r={r}
        fill="none" stroke={color} strokeWidth={6}
        strokeDasharray={`${dash} ${circ}`}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x={size / 2} y={size / 2 + 1} textAnchor="middle" dominantBaseline="middle" fontSize={11} fontWeight="700" fill={pct != null ? color : "#9ca3af"}>
        {pct != null ? `${Math.round(clamped)}%` : "—"}
      </text>
    </svg>
  );
}

export default function EmissionTargetsPage() {
  const [progress,      setProgress]      = useState<Progress[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [year,          setYear]          = useState(new Date().getFullYear());
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState({ metric: "see_voltfox", targetValue: "", baselineValue: "", installationId: "", notes: "" });
  const [saving,        setSaving]        = useState(false);

  function load() {
    setLoading(true);
    Promise.all([
      api.emissionTargets.progress(year),
      api.installations.list(),
    ]).then(([p, insts]) => {
      setProgress(p.progress);
      setInstallations(insts);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [year]);

  async function save() {
    if (!form.targetValue) return;
    setSaving(true);
    try {
      await api.emissionTargets.create({
        year,
        metric:         form.metric,
        targetValue:    parseFloat(form.targetValue),
        baselineValue:  form.baselineValue ? parseFloat(form.baselineValue) : undefined,
        installationId: form.installationId || undefined,
        notes:          form.notes || undefined,
      });
      setShowForm(false);
      setForm({ metric: "see_voltfox", targetValue: "", baselineValue: "", installationId: "", notes: "" });
      load();
    } finally {
      setSaving(false);
    }
  }

  async function deleteTarget(id: string) {
    await api.emissionTargets.delete(id);
    load();
  }

  const achieved = progress.filter(p => p.achievementPct != null && p.achievementPct >= 100).length;
  const inProgress = progress.filter(p => p.achievementPct != null && p.achievementPct < 100).length;

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1000 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Emisyon Hedefleri</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            Yıllık azaltım hedeflerinizi belirleyin ve ilerlemeyi takip edin
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <select
            value={year}
            onChange={e => setYear(parseInt(e.target.value))}
            style={{ padding: "7px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}
          >
            {[2023, 2024, 2025, 2026, 2027, 2028, 2030].map(y => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            onClick={() => setShowForm(v => !v)}
            style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            + Hedef Ekle
          </button>
        </div>
      </div>

      {/* Özet kartları */}
      <div style={{ display: "flex", gap: 14, marginBottom: 24 }}>
        {[
          { label: "Toplam Hedef", value: progress.length, color: "#374151" },
          { label: "Hedefe Ulaşıldı", value: achieved, color: "#065f46" },
          { label: "Devam Ediyor", value: inProgress, color: "#92400e" },
        ].map(c => (
          <div key={c.label} style={{ background: "#fff", borderRadius: 10, padding: "16px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", flex: 1 }}>
            <div style={{ fontSize: 12, color: "#6b7280" }}>{c.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: c.color }}>{c.value}</div>
          </div>
        ))}
      </div>

      {/* Hedef ekleme formu */}
      {showForm && (
        <div style={{ background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 10, padding: "20px 24px", marginBottom: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 14 }}>Yeni Hedef — {year}</div>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" }}>
              Metrik
              <select value={form.metric} onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}>
                {Object.entries(METRIC_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" }}>
              Hedef Değer
              <input type="number" step="0.001" value={form.targetValue} onChange={e => setForm(f => ({ ...f, targetValue: e.target.value }))}
                placeholder="0.350"
                style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 130 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" }}>
              Başlangıç Değeri (opsiyonel)
              <input type="number" step="0.001" value={form.baselineValue} onChange={e => setForm(f => ({ ...f, baselineValue: e.target.value }))}
                placeholder="0.480"
                style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 130 }} />
            </label>
            <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" }}>
              Tesis (opsiyonel)
              <select value={form.installationId} onChange={e => setForm(f => ({ ...f, installationId: e.target.value }))}
                style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }}>
                <option value="">Tüm Tesisler</option>
                {installations.map(i => <option key={i.id} value={i.id}>{i.facilityName}</option>)}
              </select>
            </label>
            <button onClick={save} disabled={saving || !form.targetValue}
              style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: saving || !form.targetValue ? "#d1d5db" : "#1d4ed8", color: "#fff", fontSize: 14, cursor: "pointer" }}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          </div>
        </div>
      )}

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

      {!loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {progress.map(p => {
            const clamped = Math.min(100, Math.max(0, p.achievementPct ?? 0));
            const barColor = clamped >= 100 ? "#10b981" : clamped >= 70 ? "#f59e0b" : "#3b82f6";
            const unit = METRIC_UNIT[p.metric] ?? "";
            const lowerIsBetter = p.metric === "see_voltfox" || p.metric === "scope2_tco2";
            const onTrack = p.achievementPct != null && p.achievementPct >= 70;

            return (
              <div key={p.id} style={{ background: "#fff", borderRadius: 10, padding: "18px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)", display: "flex", alignItems: "center", gap: 20 }}>
                <ProgressRing pct={p.achievementPct} />
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>
                        {METRIC_LABEL[p.metric]}
                        <span style={{ marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 10, background: onTrack ? "#d1fae5" : "#fee2e2", color: onTrack ? "#065f46" : "#b91c1c" }}>
                          {p.achievementPct != null ? (p.achievementPct >= 100 ? "Hedefe Ulaşıldı" : "Devam Ediyor") : "Veri Bekleniyor"}
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>{p.facilityName} · {year}</div>
                    </div>
                    <button onClick={() => deleteTarget(p.id)}
                      style={{ padding: "3px 8px", borderRadius: 5, border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c", fontSize: 12, cursor: "pointer" }}>
                      Sil
                    </button>
                  </div>
                  {/* Progress bar */}
                  <div style={{ background: "#f3f4f6", borderRadius: 4, height: 8, marginBottom: 8 }}>
                    <div style={{ width: `${clamped}%`, background: barColor, borderRadius: 4, height: "100%", transition: "width 0.4s" }} />
                  </div>
                  <div style={{ display: "flex", gap: 20, fontSize: 12, color: "#6b7280" }}>
                    <span>Hedef: <strong style={{ color: "#111827" }}>{p.targetValue.toFixed(4)} {unit}</strong></span>
                    {p.baselineValue != null && (
                      <span>Başlangıç: <strong>{p.baselineValue.toFixed(4)} {unit}</strong></span>
                    )}
                    {p.actualValue != null && (
                      <span>Gerçekleşen: <strong style={{ color: lowerIsBetter && p.actualValue <= p.targetValue ? "#059669" : "#374151" }}>
                        {p.actualValue.toFixed(4)} {unit}
                      </strong></span>
                    )}
                    {p.notes && <span>Not: {p.notes}</span>}
                  </div>
                </div>
              </div>
            );
          })}

          {progress.length === 0 && (
            <div style={{ padding: "48px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
              {year} yılı için henüz hedef tanımlanmamış. "+ Hedef Ekle" ile başlayın.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
