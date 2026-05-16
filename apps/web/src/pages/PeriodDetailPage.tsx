import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Period, EmbeddedEmission, MonthlyBreakdown } from "../lib/api.js";

const s: Record<string, React.CSSProperties> = {
  nav:    { background: "#0066CC", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 },
  back:   { color: "rgba(255,255,255,.8)", textDecoration: "none", fontSize: 13 },
  brand:  { fontWeight: 700, fontSize: 18, color: "#fff" },
  page:   { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  h1:     { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub:    { color: "#6B7280", fontSize: 14, marginBottom: 28 },
  grid:   { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 },
  kpi:    { background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "18px 20px" },
  kpiL:   { fontSize: 12, color: "#6B7280", marginBottom: 4 },
  kpiV:   { fontSize: 22, fontWeight: 700, color: "#111827" },
  kpiG:   { color: "#059669" },
  kpiR:   { color: "#DC2626" },
  section:{ fontSize: 13, fontWeight: 600, color: "#6B7280", marginTop: 28, marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: ".05em" },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "20px", marginBottom: 16 },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #F3F4F6" },
  rowL:   { fontSize: 13, color: "#6B7280" },
  rowV:   { fontSize: 14, fontWeight: 600, color: "#111827" },
  btn:    { padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, marginRight: 10 },
  btnP:   { background: "#0066CC", color: "#fff" },
  btnG:   { background: "#059669", color: "#fff" },
  btnR:   { background: "#EF4444", color: "#fff" },
  bar:    { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" },
  barL:   { width: 60, fontSize: 12, color: "#6B7280", flexShrink: 0 },
  barW:   { flex: 1, height: 8, background: "#F3F4F6", borderRadius: 4, overflow: "hidden" },
  barF:   { height: "100%", borderRadius: 4, background: "#0066CC", transition: "width .3s" },
  barV:   { width: 50, fontSize: 12, fontWeight: 600, color: "#374151", textAlign: "right" as const },
};

function DataQualityBadge({ quality }: { quality: string }) {
  const colors: Record<string, { bg: string; color: string; label: string }> = {
    measured:   { bg: "#D1FAE5", color: "#065F46", label: "Ölçülen" },
    calculated: { bg: "#FEF3C7", color: "#92400E", label: "Hesaplanan" },
    estimated:  { bg: "#FED7AA", color: "#C2410C", label: "Tahmini" },
  };
  const c = colors[quality] ?? { bg: "#F3F4F6", color: "#6B7280", label: quality };
  return (
    <span style={{ background: c.bg, color: c.color, padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 600 }}>
      {c.label}
    </span>
  );
}

export default function PeriodDetailPage() {
  const { installationId, periodId } = useParams<{ installationId: string; periodId: string }>();
  const [period,   setPeriod]   = useState<Period | null>(null);
  const [emission, setEmission] = useState<EmbeddedEmission | null>(null);
  const [cfe,      setCfe]      = useState<{ cfeScore: number; monthlyBreakdown: MonthlyBreakdown[] } | null>(null);
  const [calcLoad, setCalcLoad]   = useState(false);
  const [shareToken, setShareToken] = useState<string | null>(null);
  const [shareTtl, setShareTtl]     = useState(30);
  const [shareLoad, setShareLoad]   = useState(false);

  useEffect(() => {
    if (!installationId || !periodId) return;
    api.installations.get(installationId).then(inst => {
      const p = inst.periods.find(x => x.id === periodId);
      if (p) { setPeriod(p); if (p.result) setEmission(p.result); }
    });
    api.cfe.get(installationId, periodId).then(setCfe).catch(() => {});
  }, [installationId, periodId]);

  async function calculate() {
    if (!installationId || !periodId) return;
    setCalcLoad(true);
    try {
      const res = await api.periods.calculate(installationId, periodId);
      setEmission(res.stored);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
    setCalcLoad(false);
  }

  function openReport() {
    if (!installationId || !periodId) return;
    window.open(api.periods.reportUrl(installationId, periodId), "_blank");
  }

  async function createShareLink() {
    if (!installationId || !periodId) return;
    setShareLoad(true);
    try {
      const res = await api.shareLinks.create(installationId, periodId, shareTtl);
      setShareToken(res.token);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Paylaşım linki oluşturulamadı"); }
    setShareLoad(false);
  }

  if (!period) return <div style={{ padding: 40, textAlign: "center", color: "#6B7280" }}>Yükleniyor...</div>;

  return (
    <>
      <nav style={s.nav}>
        <Link to={`/installations/${installationId}`} style={s.back}>← Tesis</Link>
        <span style={s.brand}>{period.periodName}</span>
      </nav>
      <div style={s.page}>
        <div style={s.h1}>{period.periodName}</div>
        <div style={s.sub}>{period.startDate?.slice(0,10)} – {period.endDate?.slice(0,10)} · CN: {period.cnCode} · {period.importCountry}</div>

        <div>
          <button style={{ ...s.btn, ...s.btnP }} onClick={calculate} disabled={calcLoad}>
            {calcLoad ? "Hesaplanıyor..." : "SEE Hesapla"}
          </button>
          {emission && (
            <>
              <button style={{ ...s.btn, ...s.btnG }} onClick={openReport}>PDF Rapor İndir</button>
              <button style={{ ...s.btn, background: "#7C3AED", color: "#fff" }} onClick={createShareLink} disabled={shareLoad}>
                {shareLoad ? "..." : "İthalatçıyla Paylaş"}
              </button>
            </>
          )}
        </div>

        {shareToken && (
          <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: 8, padding: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#5B21B6", marginBottom: 8 }}>
              Paylaşım Linki Oluşturuldu ({shareTtl} gün geçerli)
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={`${window.location.origin}/share/${shareToken}`}
                style={{ flex: 1, padding: "7px 10px", borderRadius: 6, border: "1px solid #DDD6FE", fontSize: 13, background: "#fff" }}
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                style={{ padding: "7px 14px", borderRadius: 6, background: "#7C3AED", color: "#fff", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`)}>
                Kopyala
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10 }}>
              <label style={{ fontSize: 12, color: "#6B7280" }}>TTL (gün):</label>
              <input type="number" min={1} max={90} value={shareTtl}
                onChange={e => setShareTtl(parseInt(e.target.value) || 30)}
                style={{ width: 60, padding: "4px 8px", borderRadius: 5, border: "1px solid #DDD6FE", fontSize: 12 }} />
              <button onClick={createShareLink} style={{ fontSize: 12, background: "none", border: "1px solid #7C3AED", color: "#7C3AED", borderRadius: 5, padding: "4px 10px", cursor: "pointer" }}>
                Yeni Oluştur
              </button>
            </div>
          </div>
        )}

        {emission && (
          <>
            <div style={s.section}>SEE Sonuçları</div>
            <div style={s.grid}>
              <div style={s.kpi}>
                <div style={s.kpiL}>SEE Baseline</div>
                <div style={s.kpiV}>{emission.seeBaseline.toFixed(4)}<span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400 }}> tCO₂e/t</span></div>
              </div>
              <div style={s.kpi}>
                <div style={s.kpiL}>SEE Voltfox</div>
                <div style={{ ...s.kpiV, ...s.kpiG }}>{emission.seeVoltfox.toFixed(4)}<span style={{ fontSize: 12, color: "#059669", fontWeight: 400 }}> tCO₂e/t</span></div>
              </div>
              <div style={s.kpi}>
                <div style={s.kpiL}>Scope 2 Azaltım</div>
                <div style={{ ...s.kpiV, ...s.kpiG }}>{emission.reductionPct.toFixed(1)}%</div>
              </div>
            </div>

            <div style={s.card}>
              <div style={{ ...s.row, borderBottom: "none", paddingBottom: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Scope 2 Karşılaştırması</span>
              </div>
              <div style={s.row}><span style={s.rowL}>Baseline (grid avg)</span><span style={s.rowV}>{emission.scope2BaselineTco2.toFixed(2)} tCO₂</span></div>
              <div style={s.row}><span style={s.rowL}>Voltfox (CFE ile)</span><span style={{ ...s.rowV, color: "#059669" }}>{emission.scope2VoltfoxTco2.toFixed(2)} tCO₂</span></div>
              <div style={s.row}><span style={s.rowL}>Azaltım</span><span style={{ ...s.rowV, color: "#059669" }}>{emission.reductionTco2.toFixed(2)} tCO₂ (%{emission.reductionPct.toFixed(1)})</span></div>
              {emission.defaultSee !== null && (
                <>
                  <div style={s.row}><span style={s.rowL}>AB Default SEE</span><span style={s.rowV}>{emission.defaultSee.toFixed(4)} tCO₂e/t</span></div>
                  {emission.savingsVsDefaultEur !== null && (
                    <div style={s.row}><span style={s.rowL}>CBAM Tasarruf Potansiyeli</span><span style={{ ...s.rowV, color: "#059669" }}>€{emission.savingsVsDefaultEur.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}/yıl</span></div>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {cfe && (
          <>
            <div style={s.section}>24/7 CFE Eşleştirme</div>
            <div style={s.grid}>
              <div style={s.kpi}>
                <div style={s.kpiL}>CFE Skoru</div>
                <div style={{ ...s.kpiV, ...(cfe.cfeScore >= 70 ? s.kpiG : cfe.cfeScore >= 40 ? {} : s.kpiR) }}>
                  {cfe.cfeScore.toFixed(1)}%
                </div>
              </div>
              <div style={s.kpi}>
                <div style={s.kpiL}>Toplam Tüketim</div>
                <div style={s.kpiV}>{(cfe as any).totalConsumptionKwh?.toLocaleString() ?? "—"}<span style={{ fontSize: 12, color: "#6B7280" }}> kWh</span></div>
              </div>
              <div style={s.kpi}>
                <div style={s.kpiL}>Eşleşen</div>
                <div style={{ ...s.kpiV, ...s.kpiG }}>{(cfe as any).totalMatchedKwh?.toLocaleString() ?? "—"}<span style={{ fontSize: 12, color: "#059669" }}> kWh</span></div>
              </div>
            </div>

            <div style={s.card}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Aylık CFE Oranı</div>
              {cfe.monthlyBreakdown.map(mb => (
                <div key={mb.month} style={s.bar}>
                  <span style={s.barL}>{mb.month.slice(0, 7)}</span>
                  <div style={s.barW}>
                    <div style={{ ...s.barF, width: `${Math.min(mb.cfeRate, 100)}%` }} />
                  </div>
                  <span style={s.barV}>{mb.cfeRate.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        )}

        <div style={s.section}>Dönem Bilgileri</div>
        <div style={s.card}>
          <div style={s.row}><span style={s.rowL}>Üretim Hacmi</span><span style={s.rowV}>{period.prodVolumeTonne.toLocaleString()} tonne</span></div>
          <div style={s.row}><span style={s.rowL}>Elektrik Tüketimi</span><span style={s.rowV}>{(period.electricityKwh / 1000).toLocaleString()} MWh</span></div>
          <div style={s.row}>
            <span style={s.rowL}>Scope 1 (direkt)</span>
            <span style={s.rowV}>
              {period.scope1DirectTco2} tCO₂{" "}
              <DataQualityBadge quality={period.scope1Quality} />
            </span>
          </div>
          <div style={s.row}><span style={s.rowL}>Baseline EF</span><span style={s.rowV}>{period.baselineEf} tCO₂/MWh</span></div>
          <div style={s.row}><span style={s.rowL}>CFE Eşleşme Oranı</span><span style={s.rowV}>{period.matchingRatePct}%</span></div>
          {period.carbonPriceEur && <div style={s.row}><span style={s.rowL}>Karbon Fiyatı</span><span style={s.rowV}>€{period.carbonPriceEur}/tCO₂</span></div>}
        </div>
      </div>
    </>
  );
}
