import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import type {
  Installation, InstallationDetail, Period, EmbeddedEmission, CFEResult,
  CbamProduct, CbamProductPeriod, DefaultResult,
} from "../lib/api.js";
import { fmt, fmtEur } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1040, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 20 },

  tabs:    { display: "flex", gap: 0, borderBottom: "2px solid #d4ece4", marginBottom: 24 },
  tab:     { padding: "10px 22px", fontSize: 14, fontWeight: 600, cursor: "pointer",
             border: "none", background: "transparent", borderBottom: "2px solid transparent",
             marginBottom: -2, color: "#5c7a72" },
  tabA:    { borderBottomColor: "#00b87a", color: "#00b87a" },

  selRow:  { display: "flex", gap: 12, alignItems: "flex-end", marginBottom: 20, flexWrap: "wrap" as const },
  selL:    { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  sel:     { padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, background: "#fff", minWidth: 200 },

  card:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 16 },
  cardH:   { fontSize: 14, fontWeight: 600, color: "#0a1f1a", marginBottom: 12 },
  row:     { display: "flex", justifyContent: "space-between", padding: "8px 0", borderBottom: "1px solid #eef7f3" },
  rowL:    { fontSize: 13, color: "#5c7a72" },
  rowV:    { fontSize: 13, fontWeight: 600, color: "#0a1f1a" },

  btn:     { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnG:    { background: "#059669", color: "#fff" },
  btnD:    { background: "#1a3530", color: "#fff" },
  warn:    { background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8,
             padding: "12px 14px", fontSize: 13, color: "#92400E", marginBottom: 16 },
  badge:   { display: "inline-block", padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600 },

  tbl:     { width: "100%", borderCollapse: "collapse" as const },
  th:      { textAlign: "left" as const, fontSize: 11, color: "#5c7a72", fontWeight: 700,
             textTransform: "uppercase" as const, letterSpacing: ".05em",
             padding: "10px 12px", borderBottom: "2px solid #d4ece4" },
  thR:     { textAlign: "right" as const, fontSize: 11, color: "#5c7a72", fontWeight: 700,
             textTransform: "uppercase" as const, letterSpacing: ".05em",
             padding: "10px 12px", borderBottom: "2px solid #d4ece4" },
  td:      { padding: "11px 12px", fontSize: 13, color: "#1a3530", borderBottom: "1px solid #eef7f3" },
  tdR:     { padding: "11px 12px", fontSize: 13, color: "#1a3530", borderBottom: "1px solid #eef7f3",
             textAlign: "right" as const },
  tdB:     { padding: "11px 12px", fontSize: 13, fontWeight: 700, color: "#0a1f1a",
             borderBottom: "1px solid #d4ece4", borderTop: "1px solid #d4ece4" },
  tdBR:    { padding: "11px 12px", fontSize: 13, fontWeight: 700, color: "#0a1f1a",
             borderBottom: "1px solid #d4ece4", borderTop: "1px solid #d4ece4",
             textAlign: "right" as const },

  summary: { background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac",
             borderRadius: 10, padding: "18px 20px", marginBottom: 16 },
  sumGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginTop: 12 },
  sumKpi:  { background: "#fff", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const,
             border: "1px solid #d4ece4" },
  sumKpiL: { fontSize: 11, color: "#5c7a72", marginBottom: 4 },
  sumKpiV: { fontSize: 18, fontWeight: 700, color: "#0a1f1a" },

  efChip:  { display: "inline-block", padding: "1px 6px", borderRadius: 4, fontSize: 10,
             fontWeight: 700, marginLeft: 4, background: "#dbeafe", color: "#1e40af" },
  noData:  { color: "#5c7a72", fontSize: 14, padding: "32px 0", textAlign: "center" as const },
};

const DQ_COLORS: Record<string, { bg: string; color: string }> = {
  measured:   { bg: "#D1FAE5", color: "#065F46" },
  calculated: { bg: "#FEF3C7", color: "#92400E" },
  estimated:  { bg: "#FED7AA", color: "#C2410C" },
};

function dqBadge(q: string) {
  const c = DQ_COLORS[q] ?? { bg: "#eef7f3", color: "#5c7a72" };
  return <span style={{ ...s.badge, ...c }}>{q}</span>;
}

function n(v: string | null | undefined, dec = 4): string {
  if (v == null) return "—";
  const num = parseFloat(v);
  return isNaN(num) ? "—" : num.toFixed(dec);
}

// ── Dönem Bazlı Rapor ─────────────────────────────────────────────────────────
function PeriodReport({ installations }: { installations: Installation[] }) {
  const [instDetail, setInstDetail]             = useState<InstallationDetail | null>(null);
  const [selectedInstId, setSelectedInstId]     = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [emission, setEmission]                 = useState<EmbeddedEmission | null>(null);
  const [cfe, setCfe]                           = useState<CFEResult | null>(null);
  const [loading, setLoading]                   = useState(false);

  useEffect(() => {
    if (!selectedInstId) return;
    api.installations.get(selectedInstId)
      .then(d => { setInstDetail(d); setSelectedPeriodId(""); setEmission(null); setCfe(null); })
      .catch(() => {});
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
    const a = document.createElement("a"); a.href = url; a.download = `cbam-period-${selectedPeriodId}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div style={s.selRow}>
        <div>
          <div style={s.selL}>Tesis</div>
          <select style={s.sel} value={selectedInstId} onChange={e => setSelectedInstId(e.target.value)}>
            <option value="">— Tesis Seçin —</option>
            {installations.map(i => <option key={i.id} value={i.id}>{i.facilityName}</option>)}
          </select>
        </div>
        <div>
          <div style={s.selL}>Dönem</div>
          <select style={s.sel} value={selectedPeriodId} onChange={e => setSelectedPeriodId(e.target.value)} disabled={!instDetail}>
            <option value="">— Dönem Seçin —</option>
            {instDetail?.periods.map(p => <option key={p.id} value={p.id}>{p.periodName}</option>)}
          </select>
        </div>
        {emission && (
          <div style={{ display: "flex", gap: 8 }}>
            <button style={{ ...s.btn, ...s.btnG }}
              onClick={() => window.open(api.periods.reportUrl(selectedInstId, selectedPeriodId), "_blank")}>
              PDF İndir
            </button>
            <button style={{ ...s.btn, ...s.btnD }} onClick={downloadJson}>JSON İndir</button>
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
    </>
  );
}

// ── Ürün Bazlı Teknik Dosya ───────────────────────────────────────────────────
interface ProductWithPeriod {
  product:    CbamProduct;
  period:     CbamProductPeriod | null;
  annexIvDef: DefaultResult | null;
}

function ProductReport({ installations }: { installations: Installation[] }) {
  const [selectedInstId, setSelectedInstId] = useState("");
  const [selectedYear,   setSelectedYear]   = useState<number>(new Date().getFullYear() - 1);
  const [rows,           setRows]           = useState<ProductWithPeriod[]>([]);
  const [loading,        setLoading]        = useState(false);
  const [instDetail,     setInstDetail]     = useState<Installation | null>(null);
  const [batchCalc,      setBatchCalc]      = useState<{ running: boolean; done: number; total: number }>({ running: false, done: 0, total: 0 });

  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  async function loadRows(instId: string, year: number) {
    if (!instId) { setRows([]); return; }
    const inst = installations.find(i => i.id === instId) ?? null;
    setInstDetail(inst);
    setLoading(true);
    try {
      const { products } = await api.cbamProducts.list(instId);
      const country = inst?.facilityCountry ?? "";
      const mapped: ProductWithPeriod[] = await Promise.all(products.map(async p => {
        const pp = p.productPeriods.find(x => x.reportYear === year) ?? null;
        let annexIvDef: DefaultResult | null = null;
        if (p.cnCode && country) {
          annexIvDef = await api.defaults.lookup(country, p.cnCode).catch(() => null);
        }
        return { product: p, period: pp, annexIvDef };
      }));
      setRows(mapped);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadRows(selectedInstId, selectedYear); },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedInstId, selectedYear, installations]);

  async function batchCalculate() {
    const toCalc = rows.filter(r => r.period != null);
    if (toCalc.length === 0) return;
    setBatchCalc({ running: true, done: 0, total: toCalc.length });
    for (let i = 0; i < toCalc.length; i++) {
      const { product: p, period: pp } = toCalc[i];
      if (!pp) continue;
      try {
        const r = await api.cbamProducts.periods.calculate(selectedInstId, p.id, pp.id);
        setRows(prev => prev.map(row =>
          row.product.id === p.id
            ? { ...row, period: r.period }
            : row
        ));
      } catch { /* continue on error */ }
      setBatchCalc(b => ({ ...b, done: b.done + 1 }));
    }
    setBatchCalc(b => ({ ...b, running: false }));
  }

  const calculated = rows.filter(r => r.period?.see != null);

  const totalScope1    = calculated.reduce((a, r) => a + parseFloat(r.period!.scope1DirectTco2 ?? "0"), 0);
  const totalScope2    = calculated.reduce((a, r) => a + parseFloat(r.period!.totalIndirectTco2 ?? "0"), 0);
  const totalEmbedded  = calculated.reduce((a, r) => a + parseFloat(r.period!.totalEmbeddedTco2 ?? "0"), 0);
  const totalProdVol   = calculated.reduce((a, r) => a + parseFloat(r.period!.productionVolumeTonne ?? "0"), 0);

  function downloadJson() {
    const payload = {
      regulation: "EU 2023/1773 Annex IV",
      generatedAt: new Date().toISOString(),
      installation: instDetail?.facilityName,
      reportYear: selectedYear,
      products: rows.map(r => ({
        productName:          r.product.productName,
        cnCode:               r.product.cnCode,
        isCbamScope:          r.product.isCbamScope,
        energyAllocationMode: r.product.energyAllocationMode,
        unit:                 r.product.unit,
        period:               r.period,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `cbam-technical-file-${selectedInstId}-${selectedYear}.json`; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadXml() {
    const esc = (v: string | null | undefined) => (v ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
    const lines: string[] = [
      `<?xml version="1.0" encoding="UTF-8"?>`,
      `<CBAMTechnicalFile xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" regulation="EU 2023/1773 Annex IV">`,
      `  <GeneratedAt>${new Date().toISOString()}</GeneratedAt>`,
      `  <ReportYear>${selectedYear}</ReportYear>`,
      `  <Installation>${esc(instDetail?.facilityName)}</Installation>`,
      `  <Products>`,
    ];
    for (const { product: p, period: pp } of rows) {
      lines.push(`    <Product>`);
      lines.push(`      <ProductName>${esc(p.productName)}</ProductName>`);
      lines.push(`      <CNCode>${esc(p.cnCode)}</CNCode>`);
      lines.push(`      <IsCBAMScope>${p.isCbamScope}</IsCBAMScope>`);
      lines.push(`      <Unit>${esc(p.unit)}</Unit>`);
      lines.push(`      <EnergyAllocationMode>${p.energyAllocationMode}</EnergyAllocationMode>`);
      if (pp?.see != null) {
        lines.push(`      <ProductionVolumeTonne>${pp.productionVolumeTonne}</ProductionVolumeTonne>`);
        lines.push(`      <Scope1DirectTCO2>${pp.scope1DirectTco2}</Scope1DirectTCO2>`);
        lines.push(`      <AllocatedElecKWh>${pp.allocatedElecKwh}</AllocatedElecKWh>`);
        lines.push(`      <AllocatedRenewKWh>${pp.allocatedRenewKwh}</AllocatedRenewKWh>`);
        lines.push(`      <MatchedKWh>${pp.matchedKwh}</MatchedKWh>`);
        lines.push(`      <UnmatchedKWh>${pp.unmatchedKwh}</UnmatchedKWh>`);
        lines.push(`      <RenewableSource>${esc(pp.renewableSource)}</RenewableSource>`);
        lines.push(`      <RenewableSourceEF>${pp.renewableSourceEf}</RenewableSourceEF>`);
        lines.push(`      <UnmatchedEFUsed>${pp.unmatchedEfUsed}</UnmatchedEFUsed>`);
        lines.push(`      <UnmatchedEFSource>${esc(pp.unmatchedEfSource)}</UnmatchedEFSource>`);
        lines.push(`      <MatchedIndirectTCO2>${pp.matchedIndirectTco2}</MatchedIndirectTCO2>`);
        lines.push(`      <UnmatchedIndirectTCO2>${pp.unmatchedIndirectTco2}</UnmatchedIndirectTCO2>`);
        lines.push(`      <TotalIndirectTCO2>${pp.totalIndirectTco2}</TotalIndirectTCO2>`);
        lines.push(`      <TotalEmbeddedTCO2>${pp.totalEmbeddedTco2}</TotalEmbeddedTCO2>`);
        lines.push(`      <SEE unit="tCO2e/t">${pp.see}</SEE>`);
        lines.push(`      <EffectiveEF>${pp.effectiveEf}</EffectiveEF>`);
        lines.push(`      <CalculatedAt>${pp.calculatedAt}</CalculatedAt>`);
      } else {
        lines.push(`      <Status>not-calculated</Status>`);
      }
      lines.push(`    </Product>`);
    }
    lines.push(`  </Products>`);
    lines.push(`</CBAMTechnicalFile>`);

    const blob = new Blob([lines.join("\n")], { type: "application/xml" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `cbam-technical-file-${selectedInstId}-${selectedYear}.xml`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <div style={s.selRow}>
        <div>
          <div style={s.selL}>Tesis</div>
          <select style={s.sel} value={selectedInstId} onChange={e => setSelectedInstId(e.target.value)}>
            <option value="">— Tesis Seçin —</option>
            {installations.map(i => <option key={i.id} value={i.id}>{i.facilityName}</option>)}
          </select>
        </div>
        <div>
          <div style={s.selL}>Rapor Yılı</div>
          <select style={s.sel} value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}>
            {years.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        {rows.length > 0 && (
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" as const }}>
            {rows.some(r => r.period != null) && (
              <button
                style={{ ...s.btn, background: "#1a3530", color: "#fff", opacity: batchCalc.running ? 0.6 : 1 }}
                disabled={batchCalc.running}
                onClick={batchCalculate}
              >
                {batchCalc.running
                  ? `Hesaplanıyor… ${batchCalc.done}/${batchCalc.total}`
                  : "Tümünü Hesapla"}
              </button>
            )}
            {calculated.length > 0 && (
              <>
                <button style={{ ...s.btn, ...s.btnG }} onClick={downloadXml}>XML İndir</button>
                <button style={{ ...s.btn, ...s.btnD }} onClick={downloadJson}>JSON İndir</button>
              </>
            )}
          </div>
        )}
      </div>

      {loading && <div style={{ color: "#5c7a72", fontSize: 14 }}>Yükleniyor...</div>}

      {!selectedInstId && !loading && (
        <div style={s.noData}>Teknik dosya oluşturmak için bir tesis seçin.</div>
      )}

      {selectedInstId && !loading && rows.length === 0 && (
        <div style={s.warn}>Bu tesis için henüz CBAM ürünü tanımlanmamış. Tesis detayından ürün ekleyin.</div>
      )}

      {rows.length > 0 && !loading && (
        <>
          {calculated.length > 0 && (
            <div style={s.summary}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46" }}>
                {selectedYear} Yılı Özet — {instDetail?.facilityName}
              </div>
              <div style={s.sumGrid}>
                <div style={s.sumKpi}>
                  <div style={s.sumKpiL}>Toplam Üretim</div>
                  <div style={s.sumKpiV}>{totalProdVol.toLocaleString("tr-TR", { maximumFractionDigits: 1 })} t</div>
                </div>
                <div style={s.sumKpi}>
                  <div style={s.sumKpiL}>Scope 1 Toplam</div>
                  <div style={s.sumKpiV}>{totalScope1.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} tCO₂</div>
                </div>
                <div style={s.sumKpi}>
                  <div style={s.sumKpiL}>Scope 2 Toplam</div>
                  <div style={s.sumKpiV}>{totalScope2.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} tCO₂</div>
                </div>
                <div style={s.sumKpi}>
                  <div style={s.sumKpiL}>Gömülü Emisyon</div>
                  <div style={s.sumKpiV}>{totalEmbedded.toLocaleString("tr-TR", { maximumFractionDigits: 2 })} tCO₂e</div>
                </div>
              </div>
            </div>
          )}

          <div style={{ background: "#fff", border: "1px solid #d4ece4", borderRadius: 10, overflow: "hidden", marginBottom: 16 }}>
            <table style={s.tbl}>
              <thead>
                <tr>
                  <th style={s.th}>Ürün</th>
                  <th style={s.th}>CN Kodu</th>
                  <th style={s.th}>Mod</th>
                  <th style={s.thR}>Üretim (t)</th>
                  <th style={s.thR}>Scope 1 (tCO₂)</th>
                  <th style={s.thR}>Scope 2 (tCO₂)</th>
                  <th style={s.thR}>SEE (tCO₂e/t)</th>
                  <th style={s.thR}>Default SEE</th>
                  <th style={s.thR}>Tasarruf</th>
                  <th style={s.th}>Eşleşme</th>
                  <th style={s.th}>EF Kaynağı</th>
                  <th style={s.th}>Durum</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ product: p, period: pp, annexIvDef }) => {
                  const hasResult = pp?.see != null;
                  const matchedKwh   = parseFloat(pp?.matchedKwh ?? "0");
                  const allocatedKwh = parseFloat(pp?.allocatedElecKwh ?? "0");
                  const matchPct     = allocatedKwh > 0 ? (matchedKwh / allocatedKwh * 100).toFixed(1) : null;
                  const defTotal     = annexIvDef?.totalDefault ?? null;
                  const actualSee    = pp?.see != null ? parseFloat(pp.see) : null;
                  const saving       = defTotal != null && actualSee != null ? defTotal - actualSee : null;
                  return (
                    <tr key={p.id}>
                      <td style={s.td}>
                        <div style={{ fontWeight: 600 }}>{p.productName}</div>
                        <div style={{ fontSize: 11, color: "#5c7a72" }}>
                          {p.isCbamScope
                            ? <span style={{ color: "#059669" }}>CBAM Kapsamı</span>
                            : <span style={{ color: "#6b7280" }}>Kapsam Dışı</span>}
                        </div>
                      </td>
                      <td style={s.td}>{p.cnCode ?? "—"}</td>
                      <td style={s.td}>
                        <span style={{
                          background: p.energyAllocationMode === "band" ? "#dbeafe" : "#fef3c7",
                          color: p.energyAllocationMode === "band" ? "#1e40af" : "#92400e",
                          padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700,
                        }}>
                          {p.energyAllocationMode === "band" ? "Band" : "Tesis"}
                        </span>
                      </td>
                      <td style={s.tdR}>{hasResult ? parseFloat(pp!.productionVolumeTonne).toLocaleString("tr-TR", { maximumFractionDigits: 2 }) : "—"}</td>
                      <td style={s.tdR}>{hasResult ? n(pp!.scope1DirectTco2, 4) : "—"}</td>
                      <td style={s.tdR}>{hasResult ? n(pp!.totalIndirectTco2, 4) : "—"}</td>
                      <td style={{ ...s.tdR, color: hasResult ? "#059669" : "#9ca3af", fontWeight: hasResult ? 700 : 400 }}>
                        {hasResult ? n(pp!.see, 4) : "—"}
                      </td>
                      <td style={{ ...s.tdR, color: "#dc2626" }}>
                        {defTotal != null ? defTotal.toFixed(4) : "—"}
                      </td>
                      <td style={{ ...s.tdR, color: saving != null && saving > 0 ? "#059669" : "#9ca3af",
                                   fontWeight: saving != null && saving > 0 ? 700 : 400 }}>
                        {saving != null && saving > 0 ? `+${saving.toFixed(4)}` : saving != null ? saving.toFixed(4) : "—"}
                      </td>
                      <td style={s.td}>{matchPct != null ? `${matchPct}%` : "—"}</td>
                      <td style={s.td}>
                        {pp?.unmatchedEfSource
                          ? <span style={s.efChip}>{pp.unmatchedEfSource === "cbam_default" ? "CBAM Default" : "Şebeke EF"}</span>
                          : "—"}
                      </td>
                      <td style={s.td}>
                        {!pp
                          ? <span style={{ color: "#9ca3af", fontSize: 12 }}>Dönem yok</span>
                          : hasResult
                          ? <span style={{ color: "#059669", fontWeight: 600, fontSize: 12 }}>Hesaplandı</span>
                          : <span style={{ color: "#d97706", fontSize: 12 }}>Hesaplanmadı</span>}
                      </td>
                    </tr>
                  );
                })}
                {calculated.length > 0 && (
                  <tr>
                    <td style={s.tdB} colSpan={3}>Toplam ({calculated.length} ürün)</td>
                    <td style={s.tdBR}>{totalProdVol.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}</td>
                    <td style={s.tdBR}>{totalScope1.toFixed(4)}</td>
                    <td style={s.tdBR}>{totalScope2.toFixed(4)}</td>
                    <td style={s.tdBR}>{totalEmbedded.toFixed(4)} tCO₂e</td>
                    <td style={s.tdB} colSpan={6}></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ fontSize: 12, color: "#5c7a72", lineHeight: 1.7 }}>
            <strong>Metodoloji:</strong> EU 2023/956 (CBAM Tüzüğü) &amp; EU 2023/1773 (Uygulama Tüzüğü) Ek IV — Granüler 24/7 CFE eşleştirmesi.
            Eşleşen kısım: yenilenebilir kaynak EF. Eşleşmeyen kısım: min(CBAM default EF, ülke şebeke EF).
            SEE = (Scope 1 + Scope 2) / Üretim Hacmi.
          </div>
        </>
      )}
    </>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
export default function CbamReportPage() {
  const [tab, setTab]                     = useState<"period" | "product">("product");
  const [installations, setInstallations] = useState<Installation[]>([]);

  useEffect(() => {
    api.installations.list().then(setInstallations).catch(() => {});
  }, []);

  return (
    <div style={s.page}>
      <div style={s.h1}>CBAM Teknik Dosyası</div>
      <div style={s.sub}>EU 2023/956 · EU 2023/1773 Ek-IV formatında emisyon raporu</div>

      <div style={s.tabs}>
        <button style={{ ...s.tab, ...(tab === "product" ? s.tabA : {}) }} onClick={() => setTab("product")}>
          Ürün Bazlı Hesaplama
        </button>
        <button style={{ ...s.tab, ...(tab === "period" ? s.tabA : {}) }} onClick={() => setTab("period")}>
          GEC Dönem Raporu
        </button>
      </div>

      {tab === "product"
        ? <ProductReport installations={installations} />
        : <PeriodReport  installations={installations} />}
    </div>
  );
}
