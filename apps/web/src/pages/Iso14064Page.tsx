import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import type { Installation, InstallationDetail, Period, EmbeddedEmission } from "../lib/api.js";
import { fmt } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:  { maxWidth: 900, margin: "0 auto", padding: "32px 28px" },
  h1:    { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:   { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  card:  { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 16 },
  cardH: { fontSize: 14, fontWeight: 600, color: "#0a1f1a", marginBottom: 12 },
  row:   { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eef7f3" },
  rowL:  { fontSize: 13, color: "#5c7a72" },
  rowV:  { fontSize: 13, fontWeight: 600, color: "#0a1f1a" },
  select:{ padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, background: "#fff", minWidth: 220 },
  warn:  { background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#92400E", marginBottom: 16 },
  badge: { display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th:    { padding: "8px 12px", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "#5c7a72", background: "#f4fbf8", borderBottom: "1px solid #d4ece4" },
  td:    { padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #eef7f3" },
  btn:   { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#059669", color: "#fff" },
};

const DQ_COLORS: Record<string, { bg: string; color: string; uncertainty: string }> = {
  measured:   { bg: "#D1FAE5", color: "#065F46", uncertainty: "±2%" },
  calculated: { bg: "#FEF3C7", color: "#92400E", uncertainty: "±5%" },
  estimated:  { bg: "#FED7AA", color: "#C2410C", uncertainty: "±15%" },
};

export default function Iso14064Page() {
  const [installations, setInstallations]   = useState<Installation[]>([]);
  const [instDetail, setInstDetail]         = useState<InstallationDetail | null>(null);
  const [selectedInstId, setSelectedInstId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [emission, setEmission]             = useState<EmbeddedEmission | null>(null);
  const [loading, setLoading]               = useState(false);

  useEffect(() => { api.installations.list().then(setInstallations).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedInstId) return;
    api.installations.get(selectedInstId).then(d => { setInstDetail(d); setSelectedPeriodId(""); }).catch(() => {});
  }, [selectedInstId]);

  useEffect(() => {
    if (!selectedInstId || !selectedPeriodId) return;
    setLoading(true);
    api.periods.getResult(selectedInstId, selectedPeriodId)
      .then(e => { setEmission(e); setLoading(false); })
      .catch(() => { setEmission(null); setLoading(false); });
  }, [selectedInstId, selectedPeriodId]);

  const period: Period | null = instDetail?.periods.find(p => p.id === selectedPeriodId) ?? null;
  const dq = period ? (DQ_COLORS[period.scope1Quality] ?? DQ_COLORS.estimated) : null;

  const fields = period && emission ? [
    { alan: "Kapsam 1 — Direkt Emisyon", değer: `${period.scope1DirectTco2} tCO₂`, kaynak: "Müşteri verisi", kalite: period.scope1Quality },
    { alan: "Kapsam 2 — Dolaylı (Pazar)", değer: `${fmt(emission.scope2VoltfoxTco2, 2)} tCO₂`, kaynak: "Voltfox GEC", kalite: "calculated" },
    { alan: "Kapsam 2 — Dolaylı (Konum)", değer: `${fmt(emission.scope2BaselineTco2, 2)} tCO₂`, kaynak: "Ülke ort. EF", kalite: "calculated" },
    { alan: "SEE (Specific Embedded)", değer: `${fmt(emission.seeVoltfox, 4)} tCO₂e/t`, kaynak: "Hesaplama motoru", kalite: "calculated" },
  ] : [];

  return (
    <div style={s.page}>
      <div style={s.h1}>ISO 14064-1:2018 Raporu</div>
      <div style={s.sub}>Madde 6.4 — Sera gazı envanteri ve nicelendirme</div>

      <div style={{ display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" as const }}>
        <div>
          <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 4 }}>Tesis</div>
          <select style={s.select} value={selectedInstId} onChange={e => setSelectedInstId(e.target.value)}>
            <option value="">— Tesis Seçin —</option>
            {installations.map(i => <option key={i.id} value={i.id}>{i.facilityName}</option>)}
          </select>
        </div>
        <div>
          <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 4 }}>Dönem</div>
          <select style={s.select} value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)} disabled={!instDetail}>
            <option value="">— Dönem Seçin —</option>
            {instDetail?.periods.map(p => <option key={p.id} value={p.id}>{p.periodName}</option>)}
          </select>
        </div>
        {emission && (
          <button style={s.btn} onClick={() => window.print()}>PDF Olarak Kaydet</button>
        )}
      </div>

      {loading && <div style={{ color: "#5c7a72", fontSize: 14 }}>Yükleniyor...</div>}
      {period && !emission && !loading && (
        <div style={s.warn}>Bu dönem için henüz hesaplama yapılmamış. Dönem detayına gidip SEE Hesapla butonuna basın.</div>
      )}

      {period && emission && (
        <>
          <div style={s.card}>
            <div style={s.cardH}>Organizasyon Sınırı (Madde 6.4.2)</div>
            <div style={s.row}><span style={s.rowL}>Organizasyon</span><span style={s.rowV}>{instDetail?.operator}</span></div>
            <div style={s.row}><span style={s.rowL}>Tesis</span><span style={s.rowV}>{instDetail?.facilityName}</span></div>
            <div style={s.row}><span style={s.rowL}>Dönem</span><span style={s.rowV}>{period.startDate?.slice(0,10)} – {period.endDate?.slice(0,10)}</span></div>
            <div style={s.row}><span style={s.rowL}>Kapsam Yaklaşımı</span><span style={s.rowV}>Operasyonel Kontrol</span></div>
          </div>

          <div style={s.card}>
            <div style={s.cardH}>EF Kaynağı ve Metodoloji (Madde 6.3)</div>
            <div style={s.row}><span style={s.rowL}>EF Standardı</span><span style={s.rowV}>EU 2023/1773 Ek-IV</span></div>
            <div style={s.row}><span style={s.rowL}>EF Veri Versiyonu</span><span style={{ ...s.rowV, fontFamily: "monospace" }}>{emission.efDataVersion}</span></div>
            <div style={s.row}><span style={s.rowL}>Hesaplama Motoru</span><span style={{ ...s.rowV, fontFamily: "monospace" }}>{emission.calcEngineVersion}</span></div>
            <div style={s.row}><span style={s.rowL}>Doğrulama Durumu</span>
              <span style={{ ...s.badge, background: "#FEF3C7", color: "#92400E" }}>Doğrulanmamış — GHG doğrulayıcı gereklidir</span>
            </div>
          </div>

          <div style={s.card}>
            <div style={s.cardH}>Veri Kalite Tablosu (Madde 6.6)</div>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>Alan</th>
                  <th style={s.th}>Değer</th>
                  <th style={s.th}>Kaynak</th>
                  <th style={s.th}>Kalite</th>
                  <th style={s.th}>Belirsizlik</th>
                </tr>
              </thead>
              <tbody>
                {fields.map((f, i) => {
                  const dqF = DQ_COLORS[f.kalite] ?? DQ_COLORS.estimated;
                  return (
                    <tr key={i}>
                      <td style={s.td}>{f.alan}</td>
                      <td style={{ ...s.td, fontWeight: 600 }}>{f.değer}</td>
                      <td style={{ ...s.td, color: "#5c7a72" }}>{f.kaynak}</td>
                      <td style={s.td}><span style={{ ...s.badge, background: dqF.bg, color: dqF.color }}>{f.kalite}</span></td>
                      <td style={{ ...s.td, color: "#5c7a72" }}>{dqF.uncertainty}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {dq && (
            <div style={{ background: "#F0F9FF", borderLeft: "3px solid #00b87a", padding: "12px 14px", borderRadius: "0 8px 8px 0", fontSize: 12, color: "#0369A1" }}>
              Motor: {emission.calcEngineVersion} · EF: {emission.efDataVersion} · {new Date(emission.calculatedAt).toLocaleString("tr-TR")} · Kapsam 1 belirsizlik: {dq.uncertainty}
            </div>
          )}
        </>
      )}
    </div>
  );
}
