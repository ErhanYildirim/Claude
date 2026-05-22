import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import type { Installation, Period, EmbeddedEmission } from "../lib/api.js";

interface PeriodWithResult extends Period {
  result?: EmbeddedEmission;
  installation?: Installation;
}

interface ComparisonRow {
  installationId: string;
  periodId:       string;
  facilityName:   string;
  facilityCountry: string;
  periodName:     string;
  seeVoltfox:     number;
  seeBaseline:    number;
  defaultSee:     number | null;
  reductionPct:   number;
  reductionTco2:  number;
  electricityKwh: number;
  calculatedAt:   string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#14b8a6"];

function BarChart({ data, label }: { data: { name: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 0.01);
  return (
    <div>
      <div style={{ fontSize: 12, fontWeight: 600, color: "#6b7280", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((d, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 12, color: "#374151", width: 140, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={d.name}>
              {d.name}
            </div>
            <div style={{ flex: 1, background: "#f3f4f6", borderRadius: 4, height: 18, position: "relative" }}>
              <div style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color, borderRadius: 4, height: "100%",
                transition: "width 0.4s ease",
              }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: "#111827", width: 60, textAlign: "right" }}>
              {d.value.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ComparisonPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [selected,      setSelected]      = useState<{ installationId: string; periodId: string }[]>([]);
  const [rows,          setRows]          = useState<ComparisonRow[]>([]);
  const [periods,       setPeriods]       = useState<Record<string, Period[]>>({});
  const [loading,       setLoading]       = useState(true);
  const [comparing,     setComparing]     = useState(false);

  useEffect(() => {
    api.installations.list()
      .then(list => setInstallations(list))
      .finally(() => setLoading(false));
  }, []);

  async function loadPeriods(installationId: string) {
    if (periods[installationId]) return;
    const detail = await api.installations.get(installationId);
    setPeriods(prev => ({ ...prev, [installationId]: detail.periods }));
  }

  function addRow() {
    setSelected(prev => [...prev, { installationId: "", periodId: "" }]);
  }

  function removeRow(i: number) {
    setSelected(prev => prev.filter((_, idx) => idx !== i));
  }

  function updateRow(i: number, field: "installationId" | "periodId", value: string) {
    setSelected(prev => prev.map((r, idx) => {
      if (idx !== i) return r;
      if (field === "installationId") {
        loadPeriods(value);
        return { installationId: value, periodId: "" };
      }
      return { ...r, [field]: value };
    }));
  }

  async function compare() {
    const valid = selected.filter(s => s.installationId && s.periodId);
    if (valid.length < 2) return;
    setComparing(true);

    const results = await Promise.all(
      valid.map(async s => {
        try {
          const [inst, result] = await Promise.all([
            api.installations.get(s.installationId),
            api.periods.getResult(s.installationId, s.periodId),
          ]);
          const period = inst.periods.find(p => p.id === s.periodId);
          if (!period || !result) return null;
          return {
            installationId:  s.installationId,
            periodId:        s.periodId,
            facilityName:    inst.facilityName,
            facilityCountry: inst.facilityCountry,
            periodName:      period.periodName,
            seeVoltfox:      result.seeVoltfox,
            seeBaseline:     result.seeBaseline,
            defaultSee:      result.defaultSee,
            reductionPct:    result.reductionPct,
            reductionTco2:   result.reductionTco2,
            electricityKwh:  period.electricityKwh,
            calculatedAt:    result.calculatedAt,
          } as ComparisonRow;
        } catch {
          return null;
        }
      })
    );

    setRows(results.filter((r): r is ComparisonRow => r !== null));
    setComparing(false);
  }

  const sortedBySee  = [...rows].sort((a, b) => a.seeVoltfox - b.seeVoltfox);
  const best         = sortedBySee[0];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Tesis Karşılaştırma</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Farklı tesislerin veya dönemlerin SEE değerlerini yan yana karşılaştırın
        </p>
      </div>

      {/* Seçim alanı */}
      <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)", marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>Karşılaştırılacak Dönemler</div>

        {loading && <div style={{ color: "#6b7280", fontSize: 14 }}>Tesisler yükleniyor...</div>}

        {!loading && (
          <>
            {selected.map((s, i) => (
              <div key={i} style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ width: 14, height: 14, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                <select
                  value={s.installationId}
                  onChange={e => updateRow(i, "installationId", e.target.value)}
                  style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, flex: 1, minWidth: 180 }}
                >
                  <option value="">Tesis seçin...</option>
                  {installations.map(inst => (
                    <option key={inst.id} value={inst.id}>
                      {inst.facilityName} ({inst.facilityCountry})
                    </option>
                  ))}
                </select>
                <select
                  value={s.periodId}
                  onChange={e => updateRow(i, "periodId", e.target.value)}
                  disabled={!s.installationId}
                  style={{ padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, flex: 1, minWidth: 150 }}
                >
                  <option value="">Dönem seçin...</option>
                  {(periods[s.installationId] ?? []).map(p => (
                    <option key={p.id} value={p.id}>{p.periodName}</option>
                  ))}
                </select>
                <button
                  onClick={() => removeRow(i)}
                  style={{ padding: "7px 10px", borderRadius: 6, border: "1px solid #fca5a5", background: "#fee2e2", color: "#b91c1c", fontSize: 13, cursor: "pointer" }}
                >
                  ✕
                </button>
              </div>
            ))}

            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              <button
                onClick={addRow}
                disabled={selected.length >= 6}
                style={{
                  padding: "7px 16px", borderRadius: 6, border: "1px dashed #d1d5db",
                  background: "#f9fafb", color: "#374151", fontSize: 14, cursor: "pointer",
                }}
              >
                + Dönem Ekle
              </button>
              <button
                onClick={compare}
                disabled={selected.filter(s => s.installationId && s.periodId).length < 2 || comparing}
                style={{
                  padding: "7px 20px", borderRadius: 6, border: "none",
                  background: selected.filter(s => s.installationId && s.periodId).length < 2 || comparing ? "#d1d5db" : "#3b82f6",
                  color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer",
                }}
              >
                {comparing ? "Hesaplanıyor…" : "Karşılaştır"}
              </button>
            </div>
          </>
        )}
      </div>

      {/* Sonuçlar */}
      {rows.length >= 2 && (
        <>
          {/* Grafikler */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 20 }}>
            <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <BarChart
                label="Voltfox SEE (tCO₂/MWh)"
                data={rows.map((r, i) => ({
                  name:  `${r.facilityName} / ${r.periodName}`,
                  value: r.seeVoltfox,
                  color: COLORS[i % COLORS.length],
                }))}
              />
            </div>
            <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <BarChart
                label="Emisyon Azaltımı (%)"
                data={rows.map((r, i) => ({
                  name:  `${r.facilityName} / ${r.periodName}`,
                  value: r.reductionPct,
                  color: COLORS[i % COLORS.length],
                }))}
              />
            </div>
          </div>

          {/* En iyi performer banner */}
          {best && (
            <div style={{
              background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
              borderRadius: 10, padding: "14px 20px", marginBottom: 20,
              display: "flex", alignItems: "center", gap: 12,
            }}>
              <span style={{ fontSize: 20 }}>🏆</span>
              <div>
                <span style={{ fontWeight: 700, color: "#065f46" }}>{best.facilityName} / {best.periodName}</span>
                <span style={{ color: "#047857", fontSize: 14 }}> en düşük SEE değerine sahip: </span>
                <span style={{ fontWeight: 700, color: "#065f46" }}>{best.seeVoltfox.toFixed(4)} tCO₂/MWh</span>
              </div>
            </div>
          )}

          {/* Karşılaştırma tablosu */}
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Tesis / Dönem</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>SEE Voltfox</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>SEE Baseline</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Default SEE</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Azaltım (%)</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Azaltım (tCO₂)</th>
                  <th style={{ textAlign: "right", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Elektrik (MWh)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.periodId} style={{ borderBottom: "1px solid #f3f4f6", background: r === best ? "#f0fdf4" : undefined }}>
                    <td style={{ padding: "11px 16px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ width: 10, height: 10, borderRadius: "50%", background: COLORS[i % COLORS.length], flexShrink: 0 }} />
                        <div>
                          <div style={{ fontWeight: 500, color: "#111827" }}>{r.facilityName}</div>
                          <div style={{ fontSize: 11, color: "#9ca3af" }}>{r.periodName} · {r.facilityCountry}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "right", fontWeight: 700, color: r === best ? "#065f46" : "#111827" }}>
                      {r.seeVoltfox.toFixed(4)}
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "right", color: "#374151" }}>{r.seeBaseline.toFixed(4)}</td>
                    <td style={{ padding: "11px 16px", textAlign: "right", color: "#374151" }}>
                      {r.defaultSee != null ? r.defaultSee.toFixed(4) : "—"}
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "right", color: "#059669", fontWeight: 600 }}>
                      {r.reductionPct.toFixed(1)}%
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "right", color: "#374151" }}>
                      {r.reductionTco2.toFixed(1)}
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "right", color: "#374151" }}>
                      {(r.electricityKwh / 1000).toFixed(1)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {rows.length === 0 && selected.length === 0 && (
        <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
          Karşılaştırmak için en az 2 dönem seçin ve "Karşılaştır" butonuna tıklayın.
        </div>
      )}
    </div>
  );
}
