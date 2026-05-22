import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { CbamProduct, CbamProductPeriod, RenewableSource, CbamCountryEf } from "../lib/api.js";

const S: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 980, margin: "0 auto", padding: "32px 28px" },
  back:   { fontSize: 13, color: "#059669", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 16 },
  h1:     { fontSize: 21, fontWeight: 700, color: "#0a1f1a", marginBottom: 2 },
  sub:    { fontSize: 13, color: "#5c7a72", marginBottom: 24 },
  card:   { background: "#fff", border: "1px solid #d4ece4", borderRadius: 10, marginBottom: 18 },
  cardH:  { padding: "13px 20px", borderBottom: "1px solid #d4ece4", display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardHT: { fontSize: 14, fontWeight: 700, color: "#0a1f1a" },
  cardB:  { padding: "18px 20px" },
  grid2:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid3:  { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  lbl:    { fontSize: 12, color: "#5c7a72", marginBottom: 4, display: "block" as const },
  inp:    { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB",
            fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" as const },
  sel:    { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB",
            fontSize: 13, background: "#fff", boxSizing: "border-box" as const },
  btn:    { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 14, background: "#059669", color: "#fff" },
  btnSm:  { padding: "6px 12px", borderRadius: 6, border: "1px solid #059669",
            cursor: "pointer", fontWeight: 600, fontSize: 13, background: "#fff", color: "#059669" },
  btnDng: { padding: "6px 12px", borderRadius: 6, border: "1px solid #dc2626",
            cursor: "pointer", fontWeight: 600, fontSize: 13, background: "#fff", color: "#dc2626" },
  row:    { display: "flex", justifyContent: "space-between", padding: "8px 0",
            borderBottom: "1px solid #f0faf5" },
  rowL:   { fontSize: 13, color: "#5c7a72" },
  rowV:   { fontSize: 13, fontWeight: 600, color: "#0a1f1a" },
  divider:{ height: 1, background: "#eef7f3", margin: "14px 0" },
  resultCard: {
    background: "linear-gradient(135deg,#f0fdf4,#dcfce7)", border: "1px solid #86efac",
    borderRadius: 10, padding: "16px 20px", marginBottom: 18,
  },
  resultGrid: { display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 12 },
  kpi:    { background: "#fff", borderRadius: 8, padding: "12px 14px", textAlign: "center" as const, border: "1px solid #d4ece4" },
  kpiL:   { fontSize: 11, color: "#5c7a72", marginBottom: 4 },
  kpiV:   { fontSize: 18, fontWeight: 700, color: "#0a1f1a" },
  kpiSm:  { fontSize: 12, color: "#5c7a72" },
};

function badgeStyle(color: string): React.CSSProperties {
  return {
    display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
    background: color === "green" ? "#d1fae5" : color === "blue" ? "#dbeafe" : "#f3f4f6",
    color:      color === "green" ? "#065f46" : color === "blue" ? "#1e40af" : "#374151",
  };
}

function n(v: string | null | undefined, dec = 4): string {
  if (v == null) return "—";
  const num = parseFloat(v);
  return isNaN(num) ? "—" : num.toFixed(dec);
}

const EMPTY_PERIOD = {
  reportYear: new Date().getFullYear(), periodName: "",
  startDate: "", endDate: "",
  productionVolumeTonne: "", scope1DirectTco2: "0", scope1AuditNote: "",
  bandElectricityKwh: "", bandRenewableKwh: "",
  facilityTotalKwh: "", facilityRenewableKwh: "", productShareKwh: "",
  renewableSource: "solar", cbamDefaultEf: "", countryGridEf: "",
};

export default function CbamProductPage() {
  const { installationId, productId } = useParams<{ installationId: string; productId: string }>();
  const [product,       setProduct]       = useState<CbamProduct | null>(null);
  const [periods,       setPeriods]       = useState<CbamProductPeriod[]>([]);
  const [renewSources,  setRenewSources]  = useState<RenewableSource[]>([]);
  const [countryEfs,    setCountryEfs]    = useState<CbamCountryEf[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [showForm,      setShowForm]      = useState(false);
  const [form,          setForm]          = useState({ ...EMPTY_PERIOD });
  const [saving,        setSaving]        = useState(false);
  const [calcId,        setCalcId]        = useState<string | null>(null);
  const [calcLoading,   setCalcLoading]   = useState(false);
  const [error,         setError]         = useState("");
  const [selectedPeriod,setSelectedPeriod]= useState<CbamProductPeriod | null>(null);

  const load = useCallback(() => {
    if (!installationId || !productId) return;
    Promise.all([
      api.cbamProducts.periods.list(installationId, productId),
      api.cbamProducts.reference(),
    ]).then(([r, ref]) => {
      setProduct(r.product);
      setPeriods(r.periods);
      setRenewSources(ref.renewableSources);
      setCountryEfs(ref.cbamCountryEf);
    }).finally(() => setLoading(false));
  }, [installationId, productId]);

  useEffect(() => { load(); }, [load]);

  // Auto-fill countryGridEf when product is loaded
  useEffect(() => {
    if (!product || !countryEfs.length) return;
    // We need the installation country — stored indirectly; use cbamDefaultEf reference
    // It will be auto-filled by the API from CBAM_COUNTRY_EF on create
  }, [product, countryEfs]);

  function setF(k: string, v: string) { setForm(p => ({ ...p, [k]: v })); }

  async function savePeriod() {
    if (!installationId || !productId) return;
    setSaving(true); setError("");
    try {
      const body: Record<string, unknown> = {
        reportYear:           Number(form.reportYear),
        periodName:           form.periodName,
        startDate:            form.startDate,
        endDate:              form.endDate,
        productionVolumeTonne: Number(form.productionVolumeTonne),
        scope1DirectTco2:     Number(form.scope1DirectTco2) || 0,
        scope1AuditNote:      form.scope1AuditNote || null,
        renewableSource:      form.renewableSource || null,
      };
      if (product?.energyAllocationMode === "band") {
        body.bandElectricityKwh = Number(form.bandElectricityKwh) || null;
        body.bandRenewableKwh   = Number(form.bandRenewableKwh)   || null;
      } else {
        body.facilityTotalKwh     = Number(form.facilityTotalKwh)     || null;
        body.facilityRenewableKwh = Number(form.facilityRenewableKwh) || null;
        body.productShareKwh      = Number(form.productShareKwh)      || null;
      }
      if (form.cbamDefaultEf) body.cbamDefaultEf = Number(form.cbamDefaultEf);
      if (form.countryGridEf) body.countryGridEf  = Number(form.countryGridEf);

      await api.cbamProducts.periods.create(installationId, productId, body);
      setShowForm(false);
      setForm({ ...EMPTY_PERIOD });
      load();
    } catch (e: unknown) {
      setError((e as Error)?.message ?? "Hata oluştu");
    } finally {
      setSaving(false);
    }
  }

  async function calculate(periodId: string) {
    if (!installationId || !productId) return;
    setCalcId(periodId); setCalcLoading(true);
    try {
      const r = await api.cbamProducts.periods.calculate(installationId, productId, periodId);
      setPeriods(prev => prev.map(p => p.id === periodId ? r.period : p));
      setSelectedPeriod(r.period);
    } catch (e: unknown) {
      alert((e as Error)?.message ?? "Hesaplama hatası");
    } finally {
      setCalcId(null); setCalcLoading(false);
    }
  }

  const isBand = product?.energyAllocationMode === "band";

  if (loading) return <div style={{ padding: 48, color: "#5c7a72" }}>Yükleniyor...</div>;
  if (!product) return <div style={{ padding: 48, color: "#dc2626" }}>Ürün bulunamadı.</div>;

  return (
    <div style={S.page}>
      <Link to={`/installations/${installationId}`} style={S.back}>← Tesise Dön</Link>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={S.h1}>{product.productName}</div>
          <div style={S.sub}>
            {product.cnCode && <span style={{ marginRight: 10 }}>CN: {product.cnCode}</span>}
            <span style={badgeStyle(product.isCbamScope ? "green" : "blue")}>
              {product.isCbamScope ? "CBAM Kapsam İçi" : "CBAM Dışı"}
            </span>
            <span style={{ marginLeft: 8, ...badgeStyle("blue") }}>
              {isBand ? "Band Modu" : "Tesis Modu"}
            </span>
          </div>
        </div>
        <button style={S.btn} onClick={() => setShowForm(v => !v)}>
          {showForm ? "İptal" : "+ Dönem Ekle"}
        </button>
      </div>

      {/* Enerji Dağıtım Modu Açıklaması */}
      <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
                    padding: "10px 16px", fontSize: 12, color: "#92400e", marginBottom: 18 }}>
        {isBand
          ? "Band modu: Her üretim bandının kendi enerji sayacı var. Yenilenebilir enerji doğrudan bu ürün bandına atanır."
          : "Tesis modu: Yenilenebilir enerji tüm tesise ait. Tesis toplam tüketimi ve bu ürünün elektrik payı girilir; yenilenebilir orantılı dağıtılır."}
      </div>

      {/* Dönem Ekleme Formu */}
      {showForm && (
        <div style={S.card}>
          <div style={S.cardH}>
            <span style={S.cardHT}>Yeni Dönem Ekle</span>
          </div>
          <div style={S.cardB}>
            <div style={{ ...S.grid3, marginBottom: 12 }}>
              <div>
                <label style={S.lbl}>Dönem Adı *</label>
                <input style={S.inp} placeholder="2024 Q1" value={form.periodName}
                  onChange={e => setF("periodName", e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Raporlama Yılı *</label>
                <input type="number" style={S.inp} value={form.reportYear}
                  onChange={e => setF("reportYear", e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Üretim Hacmi ({product.unit}) *</label>
                <input type="number" style={S.inp} placeholder="10000" value={form.productionVolumeTonne}
                  onChange={e => setF("productionVolumeTonne", e.target.value)} />
              </div>
            </div>

            <div style={{ ...S.grid2, marginBottom: 12 }}>
              <div>
                <label style={S.lbl}>Başlangıç Tarihi *</label>
                <input type="date" style={S.inp} value={form.startDate}
                  onChange={e => setF("startDate", e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Bitiş Tarihi *</label>
                <input type="date" style={S.inp} value={form.endDate}
                  onChange={e => setF("endDate", e.target.value)} />
              </div>
            </div>

            <div style={S.divider} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 10 }}>Scope 1 (Doğrudan Emisyon)</div>
            <div style={{ ...S.grid2, marginBottom: 12 }}>
              <div>
                <label style={S.lbl}>Scope 1 Emisyon (tCO₂e)</label>
                <input type="number" style={S.inp} placeholder="0" value={form.scope1DirectTco2}
                  onChange={e => setF("scope1DirectTco2", e.target.value)} />
              </div>
              <div>
                <label style={S.lbl}>Audit Notu</label>
                <input style={S.inp} placeholder="Metodoloji, kaynak..." value={form.scope1AuditNote}
                  onChange={e => setF("scope1AuditNote", e.target.value)} />
              </div>
            </div>

            <div style={S.divider} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 10 }}>
              Scope 2 — {isBand ? "Band Enerji Verisi" : "Tesis Enerji Verisi"}
            </div>

            {isBand ? (
              <div style={{ ...S.grid2, marginBottom: 12 }}>
                <div>
                  <label style={S.lbl}>Band Elektrik Tüketimi (kWh) *</label>
                  <input type="number" style={S.inp} placeholder="1500000" value={form.bandElectricityKwh}
                    onChange={e => setF("bandElectricityKwh", e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Banda Doğrudan Atanan Yenilenebilir (kWh)</label>
                  <input type="number" style={S.inp} placeholder="400000" value={form.bandRenewableKwh}
                    onChange={e => setF("bandRenewableKwh", e.target.value)} />
                </div>
              </div>
            ) : (
              <div style={{ ...S.grid3, marginBottom: 12 }}>
                <div>
                  <label style={S.lbl}>Tesis Toplam Elektrik (kWh) *</label>
                  <input type="number" style={S.inp} placeholder="5000000" value={form.facilityTotalKwh}
                    onChange={e => setF("facilityTotalKwh", e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Tesis Toplam Yenilenebilir (kWh)</label>
                  <input type="number" style={S.inp} placeholder="1200000" value={form.facilityRenewableKwh}
                    onChange={e => setF("facilityRenewableKwh", e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Bu Ürünün Elektrik Payı (kWh) *</label>
                  <input type="number" style={S.inp} placeholder="800000" value={form.productShareKwh}
                    onChange={e => setF("productShareKwh", e.target.value)} />
                  <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 3 }}>
                    Yenilenebilir payı otomatik hesaplanır: (payı / toplam) × yenilenebilir
                  </div>
                </div>
              </div>
            )}

            <div style={{ ...S.grid2, marginBottom: 12 }}>
              <div>
                <label style={S.lbl}>Yenilenebilir Kaynak</label>
                <select style={S.sel} value={form.renewableSource}
                  onChange={e => setF("renewableSource", e.target.value)}>
                  {renewSources.map(s => (
                    <option key={s.key} value={s.key}>
                      {s.label} ({s.efTco2Mwh} tCO₂/MWh)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div style={S.divider} />
            <div style={{ fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 10 }}>
              Referans Emisyon Faktörleri — Eşleşmeyen Kısım
            </div>
            <div style={{ ...S.grid2, marginBottom: 16 }}>
              <div>
                <label style={S.lbl}>CBAM Annex IV Elektrik EF (tCO₂/MWh)</label>
                <input type="number" step="0.0001" style={S.inp} placeholder="Ülkeye göre otomatik"
                  value={form.cbamDefaultEf} onChange={e => setF("cbamDefaultEf", e.target.value)} />
                <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 3 }}>Boş bırakılırsa tesis ülke EF'i kullanılır</div>
              </div>
              <div>
                <label style={S.lbl}>Ülke Yıllık Izgara EF (tCO₂/MWh)</label>
                <input type="number" step="0.0001" style={S.inp} placeholder="Örn: 0.4943"
                  value={form.countryGridEf} onChange={e => setF("countryGridEf", e.target.value)} />
                <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 3 }}>Eşleşmeyen kısım: min(CBAM, ülke EF)</div>
              </div>
            </div>

            {error && <div style={{ color: "#dc2626", fontSize: 13, marginBottom: 10 }}>{error}</div>}

            <div style={{ display: "flex", gap: 10 }}>
              <button style={S.btn} onClick={savePeriod} disabled={saving}>
                {saving ? "Kaydediliyor…" : "Dönem Kaydet"}
              </button>
              <button style={S.btnSm} onClick={() => { setShowForm(false); setError(""); }}>
                İptal
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dönem Listesi */}
      {periods.length === 0 && !showForm && (
        <div style={{ textAlign: "center", padding: "48px 0", color: "#5c7a72" }}>
          Henüz dönem eklenmedi. "+ Dönem Ekle" ile başlayın.
        </div>
      )}

      {periods.map(p => (
        <div key={p.id} style={S.card}>
          <div style={S.cardH}>
            <div>
              <span style={S.cardHT}>{p.periodName}</span>
              <span style={{ marginLeft: 10, fontSize: 12, color: "#5c7a72" }}>{p.reportYear}</span>
            </div>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {p.calculatedAt && (
                <span style={badgeStyle("green")}>Hesaplandı</span>
              )}
              <button
                style={{ ...S.btn, ...(calcLoading && calcId === p.id ? { opacity: 0.6 } : {}) }}
                disabled={calcLoading && calcId === p.id}
                onClick={() => { calculate(p.id); setSelectedPeriod(p); }}
              >
                {calcLoading && calcId === p.id ? "Hesaplanıyor…" : "Hesapla"}
              </button>
            </div>
          </div>

          <div style={S.cardB}>
            {/* Hesaplama Sonucu */}
            {p.calculatedAt && (
              <div style={S.resultCard}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#065f46", marginBottom: 4 }}>
                  Hesaplama Sonucu — {new Date(p.calculatedAt).toLocaleString("tr-TR")}
                </div>
                <div style={S.resultGrid}>
                  <div style={S.kpi}>
                    <div style={S.kpiL}>SEE (Specific Embedded Emission)</div>
                    <div style={S.kpiV}>{n(p.see, 4)}</div>
                    <div style={S.kpiSm}>tCO₂/{product.unit}</div>
                  </div>
                  <div style={S.kpi}>
                    <div style={S.kpiL}>Toplam Gömülü Emisyon</div>
                    <div style={S.kpiV}>{n(p.totalEmbeddedTco2, 2)}</div>
                    <div style={S.kpiSm}>tCO₂e</div>
                  </div>
                  <div style={S.kpi}>
                    <div style={S.kpiL}>Efektif EF</div>
                    <div style={S.kpiV}>{n(p.effectiveEf, 4)}</div>
                    <div style={S.kpiSm}>tCO₂/MWh ağırl.ort.</div>
                  </div>
                  <div style={S.kpi}>
                    <div style={S.kpiL}>Eşleşen / Eşleşmeyen</div>
                    <div style={S.kpiV}>{n(p.matchedKwh, 0)} / {n(p.unmatchedKwh, 0)}</div>
                    <div style={S.kpiSm}>kWh</div>
                  </div>
                </div>

                <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 6 }}>
                      Eşleşen Kısım (Yenilenebilir)
                    </div>
                    <div style={S.row}>
                      <span style={S.rowL}>Eşleşen kWh</span>
                      <span style={S.rowV}>{n(p.matchedKwh, 0)} kWh</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.rowL}>Kaynak EF</span>
                      <span style={S.rowV}>{n(p.renewableSourceEf, 4)} tCO₂/MWh</span>
                    </div>
                    <div style={{ ...S.row, borderBottom: "none" }}>
                      <span style={S.rowL}>Eşleşen Emisyon</span>
                      <span style={{ ...S.rowV, color: "#059669" }}>{n(p.matchedIndirectTco2, 4)} tCO₂</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 6 }}>
                      Eşleşmeyen Kısım (Izgara)
                    </div>
                    <div style={S.row}>
                      <span style={S.rowL}>Eşleşmeyen kWh</span>
                      <span style={S.rowV}>{n(p.unmatchedKwh, 0)} kWh</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.rowL}>Kullanılan EF ({p.unmatchedEfSource === "cbam_default" ? "CBAM Annex IV" : "Ülke Izgara"})</span>
                      <span style={S.rowV}>{n(p.unmatchedEfUsed, 4)} tCO₂/MWh</span>
                    </div>
                    <div style={{ ...S.row, borderBottom: "none" }}>
                      <span style={S.rowL}>Eşleşmeyen Emisyon</span>
                      <span style={S.rowV}>{n(p.unmatchedIndirectTco2, 4)} tCO₂</span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Girdi Özeti */}
            <div style={{ ...S.grid2 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 6 }}>Üretim</div>
                <div style={S.row}>
                  <span style={S.rowL}>Hacim</span>
                  <span style={S.rowV}>{n(p.productionVolumeTonne, 1)} {product.unit}</span>
                </div>
                <div style={{ ...S.row, borderBottom: "none" }}>
                  <span style={S.rowL}>Scope 1</span>
                  <span style={S.rowV}>{n(p.scope1DirectTco2, 2)} tCO₂e</span>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 6 }}>Enerji Girdileri</div>
                {isBand ? (
                  <>
                    <div style={S.row}>
                      <span style={S.rowL}>Band tüketim</span>
                      <span style={S.rowV}>{n(p.bandElectricityKwh, 0)} kWh</span>
                    </div>
                    <div style={{ ...S.row, borderBottom: "none" }}>
                      <span style={S.rowL}>Yenilenebilir (band)</span>
                      <span style={S.rowV}>{n(p.bandRenewableKwh, 0)} kWh</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={S.row}>
                      <span style={S.rowL}>Tesis toplam</span>
                      <span style={S.rowV}>{n(p.facilityTotalKwh, 0)} kWh</span>
                    </div>
                    <div style={S.row}>
                      <span style={S.rowL}>Tesis yenilenebilir</span>
                      <span style={S.rowV}>{n(p.facilityRenewableKwh, 0)} kWh</span>
                    </div>
                    <div style={{ ...S.row, borderBottom: "none" }}>
                      <span style={S.rowL}>Ürün payı</span>
                      <span style={S.rowV}>{n(p.productShareKwh, 0)} kWh</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
