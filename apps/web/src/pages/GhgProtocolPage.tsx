import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import type { Installation, InstallationDetail, Period, EmbeddedEmission, CFEResult } from "../lib/api.js";
import { fmt, fmtEur } from "../lib/chart-utils.js";

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
  dual:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 16 },
  dCard: { borderRadius: 8, padding: "16px 18px", border: "1px solid #d4ece4" },
  dLabel:{ fontSize: 12, color: "#5c7a72", marginBottom: 6 },
  dVal:  { fontSize: 20, fontWeight: 700 },
};

export default function GhgProtocolPage() {
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

  const cbamLiability = period?.carbonPriceEur && emission
    ? emission.scope2BaselineTco2 * period.carbonPriceEur
    : null;
  const cbamWithVoltfox = period?.carbonPriceEur && emission
    ? emission.scope2VoltfoxTco2 * period.carbonPriceEur
    : null;

  return (
    <div style={s.page}>
      <div style={s.h1}>GHG Protocol Scope 2 Raporu</div>
      <div style={s.sub}>GHG Protocol Scope 2 Rehberi — Dual raporlama</div>

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
      </div>

      {loading && <div style={{ color: "#5c7a72", fontSize: 14 }}>Yükleniyor...</div>}
      {period && !emission && !loading && (
        <div style={s.warn}>Bu dönem için henüz hesaplama yapılmamış. Dönem detayına gidip SEE Hesapla butonuna basın.</div>
      )}

      {period && emission && (
        <>
          {/* Dual Raporlama */}
          <div style={s.card}>
            <div style={s.cardH}>Scope 2 — Dual Raporlama (GHG Protocol Md. 7)</div>
            <div style={s.dual}>
              <div style={{ ...s.dCard, background: "#f4fbf8" }}>
                <div style={s.dLabel}>Konum Bazlı (Location-Based)</div>
                <div style={{ ...s.dVal }}>{fmt(emission.scope2BaselineTco2, 2)} tCO₂</div>
                <div style={{ fontSize: 12, color: "#5c7a72", marginTop: 4 }}>Ülke ortalama EF: {period.baselineEf} tCO₂/MWh</div>
              </div>
              <div style={{ ...s.dCard, background: "#F0FDF4", borderColor: "#A7F3D0" }}>
                <div style={{ ...s.dLabel, color: "#059669" }}>Pazar Bazlı (Market-Based)</div>
                <div style={{ ...s.dVal, color: "#059669" }}>{fmt(emission.scope2VoltfoxTco2, 2)} tCO₂</div>
                <div style={{ fontSize: 12, color: "#059669", marginTop: 4 }}>24/7 CFE eşleştirme · {cfe ? `%${fmt(cfe.cfeScore, 1)} CFE` : ""}</div>
              </div>
            </div>
            <div style={s.row}><span style={s.rowL}>Azaltım (konum→pazar)</span><span style={{ ...s.rowV, color: "#059669" }}>{fmt(emission.reductionTco2, 2)} tCO₂ (%{fmt(emission.reductionPct, 1)})</span></div>
          </div>

          <div style={s.card}>
            <div style={s.cardH}>Eşleştirme Metodolojisi</div>
            <div style={s.row}><span style={s.rowL}>Yöntem</span><span style={s.rowV}>24/7 saatlik CFE eşleştirmesi</span></div>
            <div style={s.row}><span style={s.rowL}>Enstrüman Tipi</span><span style={s.rowV}>EAC / I-REC (GEC)</span></div>
            <div style={s.row}><span style={s.rowL}>CFE Skoru</span><span style={s.rowV}>{cfe ? `%${fmt(cfe.cfeScore, 1)}` : "Veri yok"}</span></div>
            <div style={s.row}><span style={s.rowL}>Eşleşen Enerji</span><span style={s.rowV}>{cfe ? `${fmt(cfe.totalMatchedKwh / 1000, 0)} MWh` : "—"}</span></div>
            <div style={s.row}><span style={s.rowL}>Eşleşme Oranı</span><span style={s.rowV}>{period.matchingRatePct}%</span></div>
            <div style={s.row}><span style={s.rowL}>EF Kaynağı</span><span style={s.rowV}>EU 2023/1773 · {emission.efDataVersion}</span></div>
          </div>

          {period.carbonPriceEur && (
            <div style={s.card}>
              <div style={s.cardH}>Tahmini CBAM Yükümlülüğü (€{period.carbonPriceEur}/tCO₂)</div>
              <div style={s.row}><span style={s.rowL}>Baseline CBAM Yükümlülüğü</span><span style={{ ...s.rowV, color: "#DC2626" }}>{cbamLiability !== null ? fmtEur(cbamLiability) : "—"}/yıl</span></div>
              <div style={s.row}><span style={s.rowL}>Voltfox ile CBAM Yükümlülüğü</span><span style={{ ...s.rowV, color: "#059669" }}>{cbamWithVoltfox !== null ? fmtEur(cbamWithVoltfox) : "—"}/yıl</span></div>
              {emission.savingsVsDefaultEur !== null && (
                <div style={s.row}><span style={s.rowL}>Potansiyel Tasarruf (vs AB Default)</span><span style={{ ...s.rowV, color: "#059669" }}>{fmtEur(emission.savingsVsDefaultEur)}/yıl</span></div>
              )}
            </div>
          )}

          <div style={{ background: "#F0F9FF", borderLeft: "3px solid #00b87a", padding: "12px 14px", borderRadius: "0 8px 8px 0", fontSize: 12, color: "#0369A1" }}>
            Motor: {emission.calcEngineVersion} · EF Veri: {emission.efDataVersion} · {new Date(emission.calculatedAt).toLocaleString("tr-TR")}
          </div>
        </>
      )}
    </div>
  );
}
