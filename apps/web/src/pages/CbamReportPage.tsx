import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import type { Installation, InstallationDetail, Period, EmbeddedEmission, CFEResult } from "../lib/api.js";
import { fmt, fmtEur } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:  { maxWidth: 1000, margin: "0 auto", padding: "32px 28px" },
  h1:    { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:   { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  card:  { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 16 },
  cardH: { fontSize: 14, fontWeight: 600, color: "#0a1f1a", marginBottom: 12 },
  row:   { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eef7f3" },
  rowL:  { fontSize: 13, color: "#5c7a72" },
  rowV:  { fontSize: 13, fontWeight: 600, color: "#0a1f1a" },
  select:{ padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, background: "#fff", minWidth: 220 },
  btn:   { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnP:  { background: "#00b87a", color: "#fff" },
  btnG:  { background: "#059669", color: "#fff" },
  warn:  { background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8, padding: "12px 14px", fontSize: 13, color: "#92400E", marginBottom: 16 },
  badge: { display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
};

const DQ_COLORS: Record<string, { bg: string; color: string }> = {
  measured:   { bg: "#D1FAE5", color: "#065F46" },
  calculated: { bg: "#FEF3C7", color: "#92400E" },
  estimated:  { bg: "#FED7AA", color: "#C2410C" },
};

export default function CbamReportPage() {
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
    api.installations.get(selectedInstId).then(d => { setInstDetail(d); setSelectedPeriodId(""); setEmission(null); setCfe(null); }).catch(() => {});
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

  function downloadJson() {
    const data = { period, emission, cfe, generatedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `cbam-report-${selectedPeriodId}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  const dqBadge = (q: string) => {
    const c = DQ_COLORS[q] ?? { bg: "#eef7f3", color: "#5c7a72" };
    return <span style={{ ...s.badge, ...c }}>{q}</span>;
  };

  return (
    <div style={s.page}>
      <div style={s.h1}>CBAM Teknik Dosyası</div>
      <div style={s.sub}>EU 2023/1773 Ek-IV formatında emisyon raporu</div>

      {/* Seçiciler */}
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
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...s.btn, ...s.btnG }} onClick={() => window.open(api.periods.reportUrl(selectedInstId, selectedPeriodId), "_blank")}>PDF İndir</button>
            <button style={{ ...s.btn, background: "#1a3530", color: "#fff" }} onClick={downloadJson}>JSON İndir</button>
          </div>
        )}
      </div>

      {loading && <div style={{ color: "#5c7a72", fontSize: 14 }}>Yükleniyor...</div>}

      {period && !emission && !loading && (
        <div style={s.warn}>Bu dönem için henüz hesaplama yapılmamış. Dönem detayına gidip SEE Hesapla butonuna basın.</div>
      )}

      {period && emission && (
        <>
          <div style={s.card}>
            <div style={s.cardH}>Dönem Bilgileri</div>
            <div style={s.row}><span style={s.rowL}>Tesis</span><span style={s.rowV}>{instDetail?.facilityName}</span></div>
            <div style={s.row}><span style={s.rowL}>Operatör</span><span style={s.rowV}>{instDetail?.operator}</span></div>
            <div style={s.row}><span style={s.rowL}>Dönem Adı</span><span style={s.rowV}>{period.periodName}</span></div>
            <div style={s.row}><span style={s.rowL}>Tarih Aralığı</span><span style={s.rowV}>{period.startDate?.slice(0,10)} – {period.endDate?.slice(0,10)}</span></div>
            <div style={s.row}><span style={s.rowL}>Rapor Yılı</span><span style={s.rowV}>{period.reportYear}</span></div>
            <div style={s.row}><span style={s.rowL}>CN Kodu</span><span style={s.rowV}>{period.cnCode}</span></div>
            <div style={s.row}><span style={s.rowL}>İthalat Ülkesi</span><span style={s.rowV}>{period.importCountry}</span></div>
          </div>

          <div style={s.card}>
            <div style={s.cardH}>Emisyon Verileri</div>
            <div style={s.row}><span style={s.rowL}>Üretim Hacmi</span><span style={s.rowV}>{period.prodVolumeTonne.toLocaleString("tr-TR")} tonne</span></div>
            <div style={s.row}><span style={s.rowL}>Scope 1 (Direkt)</span><span style={s.rowV}>{period.scope1DirectTco2} tCO₂ {dqBadge(period.scope1Quality)}</span></div>
            <div style={s.row}><span style={s.rowL}>Elektrik Tüketimi</span><span style={s.rowV}>{(period.electricityKwh / 1000).toLocaleString("tr-TR")} MWh</span></div>
            <div style={s.row}><span style={s.rowL}>Baseline EF</span><span style={s.rowV}>{period.baselineEf} tCO₂/MWh</span></div>
            <div style={s.row}><span style={s.rowL}>CFE Eşleşme Oranı</span><span style={s.rowV}>{period.matchingRatePct}%</span></div>
            <div style={s.row}><span style={s.rowL}>Scope 2 Baseline</span><span style={s.rowV}>{fmt(emission.scope2BaselineTco2, 2)} tCO₂</span></div>
            <div style={s.row}><span style={s.rowL}>Scope 2 Voltfox</span><span style={{ ...s.rowV, color: "#059669" }}>{fmt(emission.scope2VoltfoxTco2, 2)} tCO₂</span></div>
            <div style={s.row}><span style={s.rowL}>SEE Baseline</span><span style={s.rowV}>{fmt(emission.seeBaseline, 4)} tCO₂e/t</span></div>
            <div style={s.row}><span style={s.rowL}>SEE Voltfox</span><span style={{ ...s.rowV, color: "#059669" }}>{fmt(emission.seeVoltfox, 4)} tCO₂e/t</span></div>
            {emission.defaultSee !== null && (
              <>
                <div style={s.row}><span style={s.rowL}>AB Default SEE</span><span style={s.rowV}>{fmt(emission.defaultSee, 4)} tCO₂e/t</span></div>
                <div style={s.row}><span style={s.rowL}>Fark (default − actual)</span><span style={{ ...s.rowV, color: "#059669" }}>{fmt(emission.defaultSee - emission.seeVoltfox, 4)} tCO₂e/t</span></div>
                {emission.savingsVsDefaultEur !== null && (
                  <div style={s.row}><span style={s.rowL}>CBAM Tasarruf</span><span style={{ ...s.rowV, color: "#059669" }}>{fmtEur(emission.savingsVsDefaultEur)}/yıl</span></div>
                )}
              </>
            )}
          </div>

          <div style={{ background: "#F0F9FF", borderLeft: "3px solid #00b87a", borderRadius: "0 8px 8px 0", padding: "12px 14px", fontSize: 12, color: "#0369A1" }}>
            Motor: {emission.calcEngineVersion} · EF Veri: {emission.efDataVersion} · Tarih: {new Date(emission.calculatedAt).toLocaleString("tr-TR")}
          </div>
        </>
      )}
    </div>
  );
}
