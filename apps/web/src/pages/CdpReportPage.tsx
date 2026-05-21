import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import type { Installation, InstallationDetail, Period, EmbeddedEmission, CFEResult } from "../lib/api.js";
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
  note:  { background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#92400E", marginTop: 16 },
  btn:   { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#059669", color: "#fff" },
};

export default function CdpReportPage() {
  const [installations, setInstallations]   = useState<Installation[]>([]);
  const [instDetail, setInstDetail]         = useState<InstallationDetail | null>(null);
  const [selectedInstId, setSelectedInstId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [emission, setEmission]             = useState<EmbeddedEmission | null>(null);
  const [cfe, setCfe]                       = useState<CFEResult | null>(null);
  const [loading, setLoading]               = useState(false);

  useEffect(() => { api.installations.list().then(setInstallations).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedInstId) return;
    api.installations.get(selectedInstId).then(d => { setInstDetail(d); setSelectedPeriodId(""); }).catch(() => {});
  }, [selectedInstId]);

  useEffect(() => {
    if (!selectedInstId || !selectedPeriodId) return;
    setLoading(true);
    Promise.all([
      api.periods.getResult(selectedInstId, selectedPeriodId).catch(() => null),
      api.cfe.get(selectedInstId, selectedPeriodId).catch(() => null),
    ]).then(([e, c]) => { setEmission(e); setCfe(c); setLoading(false); });
  }, [selectedInstId, selectedPeriodId]);

  const period: Period | null = instDetail?.periods.find(p => p.id === selectedPeriodId) ?? null;

  return (
    <div style={s.page}>
      <div style={s.h1}>CDP Scope 2 Raporu</div>
      <div style={s.sub}>CDP iklim değişikliği açıklama formatı — Scope 2 Rehberi</div>

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
            <div style={s.cardH}>CDP — Scope 2 Açıklaması</div>
            <div style={s.row}><span style={s.rowL}>Tesis / Dönem</span><span style={s.rowV}>{instDetail?.facilityName} · {period.periodName}</span></div>
            <div style={s.row}><span style={s.rowL}>Raporlama Yılı</span><span style={s.rowV}>{period.reportYear}</span></div>
            <div style={s.row}><span style={s.rowL}>Scope 2 Konum Bazlı</span><span style={s.rowV}>{fmt(emission.scope2BaselineTco2, 2)} tCO₂</span></div>
            <div style={s.row}><span style={s.rowL}>Scope 2 Pazar Bazlı</span><span style={{ ...s.rowV, color: "#059669" }}>{fmt(emission.scope2VoltfoxTco2, 2)} tCO₂</span></div>
            <div style={s.row}><span style={s.rowL}>Scope 2 Azaltım</span><span style={{ ...s.rowV, color: "#059669" }}>{fmt(emission.reductionTco2, 2)} tCO₂ (%{fmt(emission.reductionPct, 1)})</span></div>
            <div style={s.row}><span style={s.rowL}>CFE Skoru</span><span style={s.rowV}>{cfe ? `%${fmt(cfe.cfeScore, 1)}` : "Veri yok"}</span></div>
            <div style={s.row}><span style={s.rowL}>Elektrik Metodolojisi</span><span style={s.rowV}>24/7 saatlik CFE eşleştirmesi</span></div>
            <div style={s.row}><span style={s.rowL}>EF Standardı</span><span style={s.rowV}>EU 2023/1773 · {emission.efDataVersion}</span></div>
            <div style={s.row}><span style={s.rowL}>Hesaplama Motoru</span><span style={s.rowV}>{emission.calcEngineVersion}</span></div>
            <div style={s.row}><span style={s.rowL}>Hesaplama Tarihi</span><span style={s.rowV}>{new Date(emission.calculatedAt).toLocaleString("tr-TR")}</span></div>
          </div>

          <div style={s.note}>
            ⚠️ CDP raporuna eklemeden önce bağımsız doğrulama önerilir. Bu rapor bilgi amaçlıdır, resmi CDP sunumu için akredite doğrulayıcı incelemesi gereklidir.
          </div>
        </>
      )}
    </div>
  );
}
