import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Period, EmbeddedEmission, MonthlyBreakdown, CFEResult } from "../lib/api.js";
import { Button, Card, Badge } from "../components/ui/index.js";

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  h1:      { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub:     { color: "var(--text-muted)", fontSize: 14, marginBottom: 28 },
  grid:    { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 28 },
  kpiL:    { fontSize: 12, color: "var(--text-muted)", marginBottom: 4 },
  kpiV:    { fontSize: 22, fontWeight: 700, color: "var(--text-primary)" },
  kpiG:    { color: "var(--success)" },
  kpiR:    { color: "var(--danger)" },
  section: { fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginTop: 28, marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: ".05em" },
  row:     { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--bg-base)" },
  rowL:    { fontSize: 13, color: "var(--text-muted)" },
  rowV:    { fontSize: 14, fontWeight: 600, color: "var(--text-primary)" },
  bar:     { display: "flex", alignItems: "center", gap: 8, padding: "6px 0" },
  barL:    { width: 60, fontSize: 12, color: "var(--text-muted)", flexShrink: 0 },
  barW:    { flex: 1, height: 8, background: "var(--bg-base)", borderRadius: "var(--radius-sm)", overflow: "hidden" },
  barF:    { height: "100%", borderRadius: "var(--radius-sm)", background: "var(--accent)", transition: "width .3s" },
  barV:    { width: 50, fontSize: 12, fontWeight: 600, color: "var(--text-primary)", textAlign: "right" as const },
};

function DataQualityBadge({ quality }: { quality: string }) {
  const variantMap: Record<string, "success" | "warning" | "danger" | "neutral"> = {
    measured:   "success",
    calculated: "warning",
    estimated:  "danger",
  };
  const variant = variantMap[quality] ?? "neutral";
  const labelMap: Record<string, string> = {
    measured:   "Ölçülen",
    calculated: "Hesaplanan",
    estimated:  "Tahmini",
  };
  const label = labelMap[quality] ?? quality;
  return <Badge variant={variant}>{label}</Badge>;
}

export default function PeriodDetailPage() {
  const { installationId, periodId } = useParams<{ installationId: string; periodId: string }>();
  const [period,   setPeriod]   = useState<Period | null>(null);
  const [facilityName, setFacilityName] = useState<string | null>(null);
  const [emission, setEmission] = useState<EmbeddedEmission | null>(null);
  const [cfe,      setCfe]      = useState<CFEResult | null>(null);
  const [calcLoad, setCalcLoad]   = useState(false);
  const [shareToken, setShareToken]     = useState<string | null>(null);
  const [shareTtl,   setShareTtl]       = useState(30);
  const [shareLoad,  setShareLoad]      = useState(false);
  const [sharePassword, setSharePassword] = useState("");
  const [shareProtected, setShareProtected] = useState(false);

  useEffect(() => {
    if (!installationId || !periodId) return;
    api.installations.get(installationId).then(inst => {
      setFacilityName(inst.facilityName);
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
      const res = await api.shareLinks.create(installationId, periodId, shareTtl, sharePassword || undefined);
      setShareToken(res.token);
      setShareProtected(res.passwordProtected);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Paylaşım linki oluşturulamadı"); }
    setShareLoad(false);
  }

  if (!period) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>Yükleniyor...</div>;

  return (
    <>
      <div style={s.page}>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 8 }}>
          <Link to={`/installations/${installationId}`} style={{ color: "var(--accent)", textDecoration: "none" }}>← {facilityName ?? installationId}</Link>
        </div>
        <div style={s.h1}>{period.periodName}</div>
        <div style={s.sub}>{period.startDate?.slice(0,10)} – {period.endDate?.slice(0,10)} · CN: {period.cnCode} · {period.importCountry}</div>

        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 8 }}>
          <Button variant="primary" onClick={calculate} disabled={calcLoad}>
            {calcLoad ? "Hesaplanıyor..." : "SEE Hesapla"}
          </Button>
          {emission && (
            <>
              <Button variant="primary" onClick={openReport}>PDF İndir</Button>
              <Button
                variant="secondary"
                onClick={() => window.open(api.periods.exportUrl(installationId!, periodId!, "json"), "_blank")}
              >
                JSON İndir
              </Button>
              <Button
                variant="secondary"
                onClick={() => window.open(api.periods.exportUrl(installationId!, periodId!, "xml"), "_blank")}
              >
                XML İndir
              </Button>
              <Button variant="secondary" onClick={createShareLink} disabled={shareLoad}>
                {shareLoad ? "..." : "İthalatçıyla Paylaş"}
              </Button>
            </>
          )}
        </div>

        {!shareToken && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
            <label style={{ fontSize: 12, color: "var(--text-muted)" }}>TTL:</label>
            <input type="number" min={1} max={365} value={shareTtl}
              onChange={e => setShareTtl(parseInt(e.target.value) || 30)}
              style={{ width: 60, padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12 }} />
            <label style={{ fontSize: 12, color: "var(--text-muted)", marginLeft: 8 }}>Şifre (isteğe bağlı):</label>
            <input type="password" value={sharePassword} placeholder="Şifresiz bırak"
              onChange={e => setSharePassword(e.target.value)}
              style={{ width: 140, padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12 }} />
          </div>
        )}

        {shareToken && (
          <div style={{ background: "#F5F3FF", border: "1px solid #DDD6FE", borderRadius: "var(--radius-md)", padding: 16, marginTop: 16 }}>
            <div style={{ fontWeight: 600, fontSize: 13, color: "#5B21B6", marginBottom: 8 }}>
              Paylaşım Linki Oluşturuldu ({shareTtl} gün geçerli){shareProtected ? " · Şifre Korumalı" : ""}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                readOnly
                value={`${window.location.origin}/share/${shareToken}`}
                style={{ flex: 1, padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid #DDD6FE", fontSize: 13, background: "var(--bg-surface)" }}
                onClick={e => (e.target as HTMLInputElement).select()}
              />
              <button
                style={{ padding: "7px 14px", borderRadius: "var(--radius-md)", background: "#7C3AED", color: "var(--bg-surface)", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600 }}
                onClick={() => navigator.clipboard.writeText(`${window.location.origin}/share/${shareToken}`)}>
                Kopyala
              </button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>TTL (gün):</label>
              <input type="number" min={1} max={365} value={shareTtl}
                onChange={e => setShareTtl(parseInt(e.target.value) || 30)}
                style={{ width: 60, padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12 }} />
              <label style={{ fontSize: 12, color: "var(--text-muted)" }}>Şifre:</label>
              <input type="password" value={sharePassword} placeholder="Şifresiz"
                onChange={e => setSharePassword(e.target.value)}
                style={{ width: 120, padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12 }} />
              <button onClick={createShareLink} disabled={shareLoad} style={{ fontSize: 12, background: "none", border: "1px solid #7C3AED", color: "#7C3AED", borderRadius: "var(--radius-md)", padding: "4px 10px", cursor: "pointer" }}>
                Yeni Oluştur
              </button>
            </div>
          </div>
        )}

        {emission && (
          <>
            <div style={s.section}>SEE Sonuçları</div>
            <div style={s.grid}>
              <Card>
                <div style={s.kpiL}>SEE Baseline</div>
                <div style={s.kpiV}>{emission.seeBaseline.toFixed(4)}<span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 400 }}> tCO₂e/t</span></div>
              </Card>
              <Card>
                <div style={s.kpiL}>SEE Voltfox</div>
                <div style={{ ...s.kpiV, ...s.kpiG }}>{emission.seeVoltfox.toFixed(4)}<span style={{ fontSize: 12, color: "var(--success)", fontWeight: 400 }}> tCO₂e/t</span></div>
              </Card>
              <Card>
                <div style={s.kpiL}>Scope 2 Azaltım</div>
                <div style={{ ...s.kpiV, ...s.kpiG }}>{emission.reductionPct.toFixed(1)}%</div>
              </Card>
            </div>

            <Card style={{ marginBottom: 16 }}>
              <div style={{ ...s.row, borderBottom: "none", paddingBottom: 12, marginBottom: 8 }}>
                <span style={{ fontWeight: 600, fontSize: 14 }}>Scope 2 Karşılaştırması</span>
              </div>
              <div style={s.row}><span style={s.rowL}>Baseline (grid avg)</span><span style={s.rowV}>{emission.scope2BaselineTco2.toFixed(2)} tCO₂</span></div>
              <div style={s.row}><span style={s.rowL}>Voltfox (CFE ile)</span><span style={{ ...s.rowV, color: "var(--success)" }}>{emission.scope2VoltfoxTco2.toFixed(2)} tCO₂</span></div>
              <div style={s.row}><span style={s.rowL}>Azaltım</span><span style={{ ...s.rowV, color: "var(--success)" }}>{emission.reductionTco2.toFixed(2)} tCO₂ (%{emission.reductionPct.toFixed(1)})</span></div>
            </Card>

            {emission.defaultSee !== null && (
              <>
                <div style={s.section}>CBAM Default Karşılaştırması</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
                  <Card style={{ border: "1px solid #FECACA", background: "#FFF5F5" }}>
                    <div style={s.kpiL}>AB Default SEE</div>
                    <div style={{ ...s.kpiV, ...s.kpiR }}>{emission.defaultSee.toFixed(4)}<span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 400 }}> tCO₂e/t</span></div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Yüksek — CBAM Ek-IV referans değeri</div>
                  </Card>
                  <Card style={{ border: "1px solid #A7F3D0", background: "#F0FDF4" }}>
                    <div style={s.kpiL}>Actual SEE (Voltfox)</div>
                    <div style={{ ...s.kpiV, ...s.kpiG }}>{emission.seeVoltfox.toFixed(4)}<span style={{ fontSize: 12, color: "var(--success)", fontWeight: 400 }}> tCO₂e/t</span></div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 4 }}>Düşük — Gerçek ölçüm verisi</div>
                  </Card>
                </div>

                <Card style={{ marginBottom: 16 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Fark Analizi</div>
                  <div style={s.row}>
                    <span style={s.rowL}>Mutlak fark</span>
                    <span style={{ ...s.rowV, color: "var(--success)" }}>
                      {(emission.defaultSee - emission.seeVoltfox).toFixed(4)} tCO₂e/t daha düşük
                    </span>
                  </div>
                  <div style={s.row}>
                    <span style={s.rowL}>Yüzde fark</span>
                    <span style={{ ...s.rowV, color: "var(--success)" }}>
                      %{((emission.defaultSee - emission.seeVoltfox) / emission.defaultSee * 100).toFixed(1)} azalma
                    </span>
                  </div>
                  {emission.savingsVsDefaultEur !== null && (
                    <>
                      <div style={s.row}>
                        <span style={s.rowL}>CBAM Maliyet Tasarrufu</span>
                        <span style={{ ...s.rowV, color: "var(--success)", fontSize: 16 }}>
                          €{emission.savingsVsDefaultEur.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}/yıl
                        </span>
                      </div>
                      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, padding: "10px 12px", background: "var(--bg-base)", borderRadius: "var(--radius-md)" }}>
                        CN kodu {period.cnCode} için AB default değeri {emission.defaultSee.toFixed(4)} tCO₂e/t'dir.
                        Actual emissions {emission.seeVoltfox.toFixed(4)} tCO₂e/t ile daha düşük — CBAM maliyetinizi düşürür.
                      </div>
                    </>
                  )}
                  <div style={{ marginTop: 12, padding: "12px 14px", background: "var(--accent-bg)", borderLeft: "3px solid var(--accent)", borderRadius: "0 var(--radius-md) var(--radius-md) 0", fontSize: 12, color: "var(--accent)" }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>Audit Kanıtı</div>
                    <div>Motor: {emission.calcEngineVersion} · EF Veri: {emission.efDataVersion}</div>
                    <div style={{ marginTop: 2 }}>Hesaplanma: {new Date(emission.calculatedAt).toLocaleString("tr-TR")}</div>
                  </div>
                </Card>
              </>
            )}
          </>
        )}

        {cfe && (
          <>
            <div style={s.section}>24/7 CFE Eşleştirme</div>
            <div style={s.grid}>
              <Card>
                <div style={s.kpiL}>CFE Skoru</div>
                <div style={{ ...s.kpiV, ...(cfe.cfeScore >= 70 ? s.kpiG : cfe.cfeScore >= 40 ? {} : s.kpiR) }}>
                  {cfe.cfeScore.toFixed(1)}%
                </div>
              </Card>
              <Card>
                <div style={s.kpiL}>Toplam Tüketim</div>
                <div style={s.kpiV}>{cfe.totalConsumptionKwh.toLocaleString()}<span style={{ fontSize: 12, color: "var(--text-muted)" }}> kWh</span></div>
              </Card>
              <Card>
                <div style={s.kpiL}>Eşleşen</div>
                <div style={{ ...s.kpiV, ...s.kpiG }}>{cfe.totalMatchedKwh.toLocaleString()}<span style={{ fontSize: 12, color: "var(--success)" }}> kWh</span></div>
              </Card>
            </div>

            <Card style={{ marginBottom: 16 }}>
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
            </Card>
          </>
        )}

        <div style={s.section}>Dönem Bilgileri</div>
        <Card style={{ marginBottom: 16 }}>
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
        </Card>

        {emission && (
          <div style={{ background: "var(--bg-base)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 14, fontSize: 12, color: "var(--text-muted)" }}>
            <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: 8, textTransform: "uppercase" as const, letterSpacing: ".05em", fontSize: 11 }}>Hesaplama Kaydı</div>
            <div>Motor Versiyonu: <span style={{ fontFamily: "monospace" }}>{emission.calcEngineVersion}</span></div>
            <div style={{ marginTop: 4 }}>EF Veri Versiyonu: <span style={{ fontFamily: "monospace" }}>{emission.efDataVersion}</span></div>
            <div style={{ marginTop: 4 }}>Hesaplanma Tarihi: {new Date(emission.calculatedAt).toLocaleString("tr-TR")}</div>
          </div>
        )}
      </div>
    </>
  );
}
