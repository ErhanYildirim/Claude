import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import type { Installation, EmbeddedEmission } from "../lib/api.js";

// ESRS E1 — Klima Değişikliği Açıklama Noktaları
interface E1Field {
  id:          string;
  section:     string;
  ref:         string;
  question:    string;
  hint?:       string;
  type:        "text" | "number" | "select" | "computed";
  options?:    string[];
  computed?:   (data: ComputedData) => string;
}

interface ComputedData {
  scope2Tco2?:      number;
  scope1Tco2?:      number;
  reductionPct?:    number;
  reductionTco2?:   number;
  seeVoltfox?:      number;
  electricityKwh?:  number;
  facilityName?:    string;
  reportYear?:      number;
}

const E1_FIELDS: E1Field[] = [
  // E1-1 İklim Politikaları
  { id: "policy_netzero", section: "E1-1", ref: "ESRS E1-1 AR 7(a)", type: "select", options: ["Evet", "Hayır", "Planlanıyor"], question: "Şirketin net-sıfır hedefi var mı?", hint: "Resmi net-zero taahhüdü veya hedef tarihi" },
  { id: "policy_scope", section: "E1-1", ref: "ESRS E1-1 §14", type: "text", question: "İklim politikasının kapsamı", hint: "Hangi Scope 1/2/3 emisyonları kapsanıyor?" },

  // E1-2 İklim Geçiş Planı
  { id: "transition_plan", section: "E1-2", ref: "ESRS E1-2 §18", type: "text", question: "İklim geçiş planı özeti", hint: "2030/2050 hedefleri, anahtar aksiyonlar" },
  { id: "capex_climate", section: "E1-2", ref: "ESRS E1-2 AR 18(c)", type: "number", question: "İklim ile ilgili CapEx (€)", hint: "Raporlama döneminde iklim amaçlı yatırım" },

  // E1-4 Emisyon Hedefleri
  { id: "target_year", section: "E1-4", ref: "ESRS E1-4 §34(a)", type: "number", question: "Emisyon hedef yılı", hint: "Örn. 2030, 2040, 2050" },
  { id: "target_base_year", section: "E1-4", ref: "ESRS E1-4 §34(b)", type: "number", question: "Baz yıl", hint: "Hedeflerin karşılaştırıldığı başlangıç yılı" },
  { id: "target_reduction_pct", section: "E1-4", ref: "ESRS E1-4 §34(c)", type: "number", question: "Hedeflenen azaltım (%)", hint: "Baz yıla göre azaltım yüzdesi" },
  { id: "science_based", section: "E1-4", ref: "ESRS E1-4 §34(g)", type: "select", options: ["Evet — SBTi doğrulandı", "Evet — iç metodoloji", "Hayır"], question: "Hedef bilimsel temelli (Science-Based) mi?" },

  // E1-5 Enerji
  { id: "total_energy_mwh", section: "E1-5", ref: "ESRS E1-5 §37(a)", type: "computed", question: "Toplam elektrik tüketimi (MWh)", computed: (d) => d.electricityKwh != null ? (d.electricityKwh / 1000).toFixed(0) : "—" },
  { id: "renewable_pct", section: "E1-5", ref: "ESRS E1-5 §37(b)", type: "number", question: "Yenilenebilir enerji oranı (%)", hint: "Toplam tüketim içindeki YE payı" },
  { id: "energy_intensity", section: "E1-5", ref: "ESRS E1-5 §38", type: "number", question: "Enerji yoğunluğu (MWh/tonne)", hint: "Enerji tüketimi / üretim hacmi" },

  // E1-6 Scope 1 & 2 Emisyonları
  { id: "scope1_tco2", section: "E1-6", ref: "ESRS E1-6 §44(a)", type: "computed", question: "Scope 1 emisyonları (tCO₂e)", computed: (d) => d.scope1Tco2 != null ? d.scope1Tco2.toFixed(1) : "—" },
  { id: "scope2_lb_tco2", section: "E1-6", ref: "ESRS E1-6 §44(b)", type: "computed", question: "Scope 2 emisyonları — location-based (tCO₂e)", computed: (d) => d.scope2Tco2 != null ? d.scope2Tco2.toFixed(1) : "—" },
  { id: "scope2_mb_tco2", section: "E1-6", ref: "ESRS E1-6 §44(c)", type: "number", question: "Scope 2 emisyonları — market-based (tCO₂e)", hint: "EAC/I-REC sonrası net Scope 2" },
  { id: "see_value", section: "E1-6", ref: "ESRS E1-6 AR 46", type: "computed", question: "Spesifik Dolaylı Emisyon (SEE) (tCO₂/MWh)", computed: (d) => d.seeVoltfox != null ? d.seeVoltfox.toFixed(4) : "—" },
  { id: "ef_methodology", section: "E1-6", ref: "ESRS E1-6 §49(a)", type: "text", question: "Emisyon faktörü metodolojisi", hint: "Saatlik lokasyon bazlı EF (ESRS E1 uyumlu)" },

  // E1-7 Karbon Giderme
  { id: "carbon_removal", section: "E1-7", ref: "ESRS E1-7 §51", type: "number", question: "Karbon giderme miktarı (tCO₂e)", hint: "Certified removal — nature-based veya teknoloji" },
  { id: "offsets_used", section: "E1-7", ref: "ESRS E1-7 §52", type: "number", question: "Kullanılan offset miktarı (tCO₂e)", hint: "Net-zero hedefi için kullanılan telafi" },

  // E1-9 Fiziksel Risk
  { id: "physical_risk", section: "E1-9", ref: "ESRS E1-9 §66", type: "select", options: ["Yüksek", "Orta", "Düşük", "Değerlendirilmedi"], question: "İklimle bağlantılı fiziksel risk seviyesi" },
];

const SECTIONS = [...new Set(E1_FIELDS.map(f => f.section))];

export default function CsrdReportPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [instId,        setInstId]        = useState("");
  const [emissions,     setEmissions]     = useState<EmbeddedEmission | null>(null);
  const [period,        setPeriod]        = useState<{ periodName: string; reportYear: number; electricityKwh: number; scope1DirectTco2: number } | null>(null);
  const [answers,       setAnswers]       = useState<Record<string, string>>({});
  const [activeSection, setActiveSection] = useState(SECTIONS[0]);
  const [loading,       setLoading]       = useState(false);
  const [exporting,     setExporting]     = useState(false);

  useEffect(() => {
    api.installations.list().then(setInstallations);
  }, []);

  async function loadData(id: string) {
    if (!id) return;
    setLoading(true);
    try {
      const detail = await api.installations.get(id);
      const latest = detail.periods.find(p => p.result != null) ?? detail.periods[0];
      if (latest?.result) {
        setEmissions(latest.result);
        setPeriod({
          periodName:      latest.periodName,
          reportYear:      latest.reportYear,
          electricityKwh:  latest.electricityKwh,
          scope1DirectTco2: latest.scope1DirectTco2,
        });
      }
    } finally {
      setLoading(false);
    }
  }

  const computed: ComputedData = {
    scope2Tco2:     emissions?.scope2VoltfoxTco2,
    scope1Tco2:     period?.scope1DirectTco2,
    reductionPct:   emissions?.reductionPct,
    reductionTco2:  emissions?.reductionTco2,
    seeVoltfox:     emissions?.seeVoltfox,
    electricityKwh: period?.electricityKwh,
    facilityName:   installations.find(i => i.id === instId)?.facilityName,
    reportYear:     period?.reportYear,
  };

  function exportMarkdown() {
    setExporting(true);
    const inst = installations.find(i => i.id === instId);
    const lines = [
      `# CSRD ESRS E1 — İklim Değişikliği Açıklamaları`,
      `**Şirket:** ${inst?.facilityName ?? "—"} · **Yıl:** ${period?.reportYear ?? "—"}`,
      `**Oluşturulma:** ${new Date().toISOString().slice(0, 10)}`,
      "",
    ];

    for (const section of SECTIONS) {
      lines.push(`## ${section}`);
      const fields = E1_FIELDS.filter(f => f.section === section);
      for (const f of fields) {
        const value = f.type === "computed" ? (f.computed?.(computed) ?? "—") : (answers[f.id] ?? "—");
        lines.push(`**[${f.ref}]** ${f.question}`);
        lines.push(`> ${value}`);
        lines.push("");
      }
    }

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `CSRD-E1-${inst?.facilityName ?? "rapor"}-${period?.reportYear ?? "2024"}.md`;
    a.click();
    URL.revokeObjectURL(url);
    setExporting(false);
  }

  const sectionFields = E1_FIELDS.filter(f => f.section === activeSection);
  const answered      = E1_FIELDS.filter(f => f.type === "computed" || answers[f.id]).length;
  const completionPct = Math.round((answered / E1_FIELDS.length) * 100);

  return (
    <div style={{ padding: "28px 32px", maxWidth: 980 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>CSRD ESRS E1 Raporlama</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            İklim değişikliği açıklama noktaları — ESRS E1 uyumlu şablon
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <div style={{ fontSize: 13, color: "#374151" }}>
            <span style={{ fontWeight: 700, color: "#3b82f6" }}>{completionPct}%</span> tamamlandı
          </div>
          <button
            onClick={exportMarkdown}
            disabled={exporting || !instId}
            style={{ padding: "8px 16px", borderRadius: 7, border: "none", background: instId ? "#059669" : "#d1d5db", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer" }}
          >
            {exporting ? "İndiriliyor…" : "Markdown İndir"}
          </button>
        </div>
      </div>

      {/* Tesis seç */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <select
          value={instId}
          onChange={e => { setInstId(e.target.value); loadData(e.target.value); }}
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 320 }}
        >
          <option value="">Tesis seçin (veriler otomatik doldurulur)…</option>
          {installations.map(i => <option key={i.id} value={i.id}>{i.facilityName}</option>)}
        </select>
        {loading && <span style={{ fontSize: 13, color: "#6b7280" }}>Yükleniyor…</span>}
        {period && <span style={{ fontSize: 13, color: "#059669" }}>✓ {period.periodName} · {period.reportYear} verisi yüklendi</span>}
      </div>

      {/* İlerleme çubuğu */}
      <div style={{ height: 6, background: "#e5e7eb", borderRadius: 3, marginBottom: 24 }}>
        <div style={{ width: `${completionPct}%`, height: "100%", background: "#3b82f6", borderRadius: 3, transition: "width 0.3s" }} />
      </div>

      <div style={{ display: "flex", gap: 20 }}>
        {/* Section nav */}
        <div style={{ width: 140, flexShrink: 0 }}>
          {SECTIONS.map(s => {
            const sFields = E1_FIELDS.filter(f => f.section === s);
            const done    = sFields.filter(f => f.type === "computed" || answers[f.id]).length;
            return (
              <button
                key={s}
                onClick={() => setActiveSection(s)}
                style={{
                  width: "100%", textAlign: "left", padding: "8px 10px", borderRadius: 6,
                  border: "none", marginBottom: 4, fontSize: 13, cursor: "pointer",
                  background: activeSection === s ? "#dbeafe" : "transparent",
                  color: activeSection === s ? "#1d4ed8" : "#374151",
                  fontWeight: activeSection === s ? 600 : 400,
                }}
              >
                {s}
                <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 1 }}>
                  {done}/{sFields.length}
                </div>
              </button>
            );
          })}
        </div>

        {/* Fields */}
        <div style={{ flex: 1 }}>
          {sectionFields.map(field => {
            const value = field.type === "computed" ? (field.computed?.(computed) ?? "—") : (answers[field.id] ?? "");
            const isComputed = field.type === "computed";

            return (
              <div key={field.id} style={{
                background: "#fff", borderRadius: 8, padding: "16px 20px",
                boxShadow: "0 1px 3px rgba(0,0,0,0.06)", marginBottom: 12,
                borderLeft: isComputed ? "3px solid #3b82f6" : "3px solid transparent",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: "#111827" }}>{field.question}</div>
                  <span style={{ fontSize: 10, color: "#9ca3af", fontFamily: "monospace" }}>{field.ref}</span>
                </div>
                {field.hint && (
                  <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8 }}>{field.hint}</div>
                )}
                {isComputed ? (
                  <div style={{
                    padding: "8px 12px", background: "#eff6ff", borderRadius: 5,
                    fontSize: 14, fontWeight: 600, color: "#1d4ed8",
                  }}>
                    {value} <span style={{ fontSize: 11, fontWeight: 400, color: "#60a5fa" }}>otomatik</span>
                  </div>
                ) : field.type === "select" ? (
                  <select
                    value={value}
                    onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 14 }}
                  >
                    <option value="">Seçin…</option>
                    {field.options?.map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : field.type === "number" ? (
                  <input
                    type="number"
                    value={value}
                    onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder="Değer girin…"
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 14, boxSizing: "border-box" }}
                  />
                ) : (
                  <textarea
                    value={value}
                    onChange={e => setAnswers(prev => ({ ...prev, [field.id]: e.target.value }))}
                    placeholder="Açıklama girin…"
                    rows={3}
                    style={{ width: "100%", padding: "7px 10px", border: "1px solid #d1d5db", borderRadius: 5, fontSize: 14, resize: "vertical", boxSizing: "border-box" }}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
