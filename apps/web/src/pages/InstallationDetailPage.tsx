import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { InstallationDetail, Period, CreatePeriodBody, EFEntry, CbamProduct } from "../lib/api.js";
import { Scope1Calculator } from "../components/Scope1Calculator.js";

const s: Record<string, React.CSSProperties> = {
  nav:     { background: "#00b87a", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 },
  back:    { color: "rgba(255,255,255,.8)", textDecoration: "none", fontSize: 13 },
  brand:   { fontWeight: 700, fontSize: 18, color: "#fff" },
  page:    { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  h1:      { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub:     { color: "#5c7a72", fontSize: 14, marginBottom: 28 },
  addBtn:  { display: "inline-flex", alignItems: "center", gap: 6, background: "#00b87a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 20 },
  table:   { width: "100%", borderCollapse: "collapse" as const, background: "#fff", borderRadius: 10, overflow: "hidden", border: "1px solid #d4ece4" },
  th:      { background: "#f4fbf8", padding: "10px 14px", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "#5c7a72", borderBottom: "1px solid #d4ece4" },
  td:      { padding: "12px 14px", borderBottom: "1px solid #eef7f3", fontSize: 14 },
  btnSm:   { padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  green:   { background: "#D1FAE5", color: "#065F46" },
  blue:    { background: "#DBEAFE", color: "#009966" },
  gray:    { background: "#eef7f3", color: "#5c7a72" },
  modal:   { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, overflowY: "auto" as const },
  mCard:   { background: "#fff", borderRadius: 12, padding: "32px", width: 580, margin: "20px auto", boxShadow: "0 8px 32px rgba(0,0,0,.15)" },
  mTitle:  { fontSize: 17, fontWeight: 700, marginBottom: 20 },
  label:   { display: "block", fontSize: 13, fontWeight: 600, color: "#1a3530", marginBottom: 5 },
  input:   { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box" as const },
  select:  { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, marginBottom: 14, background: "#fff", boxSizing: "border-box" as const },
  row2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  btnRow:  { display: "flex", gap: 10, marginTop: 8 },
  btn:     { flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnP:    { background: "#00b87a", color: "#fff" },
  btnS:    { background: "#eef7f3", color: "#1a3530" },
  err:     { color: "#DC2626", fontSize: 13, marginBottom: 12 },
  section: { fontSize: 13, fontWeight: 600, color: "#5c7a72", marginBottom: 8, marginTop: 18, textTransform: "uppercase" as const, letterSpacing: ".05em" },
  badge:   { display: "inline-block", fontSize: 11, padding: "2px 7px", borderRadius: 4, marginLeft: 6, fontWeight: 600 },
  badgeAuto: { background: "#D1FAE5", color: "#065F46" },
  badgeManual: { background: "#FEF3C7", color: "#92400E" },
  efNote:  { fontSize: 12, color: "#5c7a72", marginTop: -10, marginBottom: 14 },
  dropzone: { border: "2px dashed #D1D5DB", borderRadius: 8, padding: "24px", textAlign: "center" as const, cursor: "pointer", marginBottom: 14, transition: "border-color .2s" },
  dropzoneActive: { borderColor: "#00b87a", background: "#e6f9f2" },
};

const EMPTY_FORM: CreatePeriodBody = {
  periodName: "", startDate: "", endDate: "", reportYear: new Date().getFullYear(),
  importCountry: "DE", cnCode: "", prodVolumeTonne: 0,
  scope1DirectTco2: 0, scope1Quality: "measured",
  electricityKwh: 0, electricitySource: "smart_meter",
  renewableEf: 0.02, matchingRatePct: 0,
  gecConnected: false, carbonPriceEur: undefined, scope2Exempt: false,
};

// IPCC 2006 kaynaklı yakıt EF (scope1.ts ile senkron)
type FuelType = "natural_gas" | "hard_coal" | "lignite" | "diesel" | "heavy_fuel_oil" | "lpg" | "coke" | "wood_biomass" | "other";
const FUEL_EF: Record<FuelType, number> = {
  natural_gas: 0.202, hard_coal: 0.341, lignite: 0.361, diesel: 0.266,
  heavy_fuel_oil: 0.282, lpg: 0.227, coke: 0.386, wood_biomass: 0.0, other: 0.250,
};
const FUEL_LABELS: Record<FuelType, string> = {
  natural_gas: "Doğalgaz", hard_coal: "Taş kömürü", lignite: "Linyit", diesel: "Motorin",
  heavy_fuel_oil: "Fuel oil", lpg: "LPG", coke: "Kok", wood_biomass: "Biyokütle (ahşap)", other: "Diğer",
};
interface FuelRow { fuelType: FuelType; consumedMwh: number; efOverride?: number; }
const EMPTY_FUEL_ROW: FuelRow = { fuelType: "natural_gas", consumedMwh: 0 };

export default function InstallationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [installation, setInstallation] = useState<InstallationDetail | null>(null);
  const [showModal, setShowModal]           = useState(false);
  const [editingPeriod, setEditingPeriod]   = useState<Period | null>(null);
  const [showScope1Calc, setShowScope1Calc] = useState(false);
  const [form, setForm]                   = useState<CreatePeriodBody>(EMPTY_FORM);
  const [saving, setSaving]               = useState(false);
  const [calculating, setCalculating]     = useState<string | null>(null);
  const [error, setError]                 = useState("");

  // EF otomatik doldurma
  const [efCountries, setEfCountries]     = useState<Array<{ iso2: string; name: string; ef: number }>>([]);
  const [efEntry, setEfEntry]             = useState<EFEntry | null>(null);
  const [efManual, setEfManual]           = useState(false);

  // Yakıt breakdown
  const [showFuel, setShowFuel]   = useState(false);
  const [fuelRows, setFuelRows]   = useState<FuelRow[]>([{ ...EMPTY_FUEL_ROW }]);

  // CSV upload
  const [showCsvModal, setShowCsvModal]   = useState(false);
  const [csvPeriodId, setCsvPeriodId]     = useState<string | null>(null);
  const [csvDragging, setCsvDragging]     = useState(false);
  const [csvFile, setCsvFile]             = useState<File | null>(null);
  const [csvUploading, setCsvUploading]   = useState(false);
  const [csvResult, setCsvResult]         = useState<{ rowCount: number; errorCount: number; errors: string[]; cfeScore: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;
    api.installations.get(id).then(setInstallation).catch(() => {});
    api.defaults.efList().then(r => setEfCountries(r.countries)).catch(() => {});
  }, [id]);

  // Ülke değişince EF otomatik çek
  useEffect(() => {
    if (!form.importCountry || efManual) return;
    api.defaults.efLookup(form.importCountry)
      .then(entry => {
        setEfEntry(entry);
        setForm(f => ({ ...f, baselineEf: entry.ef }));
      })
      .catch(() => {
        setEfEntry(null);
        setForm(f => ({ ...f, baselineEf: undefined }));
      });
  }, [form.importCountry, efManual]);

  function set(field: keyof CreatePeriodBody, value: unknown) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function handleBaselineEfChange(val: string) {
    setEfManual(true);
    setEfEntry(null);
    set("baselineEf", val ? parseFloat(val) : undefined);
  }

  function fuelTotal(): number {
    return fuelRows.reduce((sum, r) => {
      const ef = r.efOverride ?? FUEL_EF[r.fuelType];
      return sum + (r.consumedMwh || 0) * ef;
    }, 0);
  }

  function openEditPeriod(period: Period) {
    setEditingPeriod(period);
    setForm({
      periodName:        period.periodName,
      startDate:         period.startDate?.slice(0, 10) ?? "",
      endDate:           period.endDate?.slice(0, 10) ?? "",
      reportYear:        period.reportYear,
      importCountry:     period.importCountry,
      cnCode:            period.cnCode,
      prodVolumeTonne:   period.prodVolumeTonne,
      scope1DirectTco2:  period.scope1DirectTco2,
      scope1Quality:     period.scope1Quality,
      electricityKwh:    period.electricityKwh,
      electricitySource: period.electricitySource,
      baselineEf:        period.baselineEf,
      renewableEf:       period.renewableEf,
      matchingRatePct:   period.matchingRatePct,
      gecConnected:      period.gecConnected,
      carbonPriceEur:    period.carbonPriceEur ?? undefined,
      scope2Exempt:      period.scope2Exempt ?? false,
      scope1AuditNote:   period.scope1AuditNote ?? undefined,
    });
    setEfManual(true);
    setError("");
    setShowModal(true);
  }

  async function createPeriod(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setError(""); setSaving(true);
    try {
      if (editingPeriod) {
        const updated = await api.periods.update(id, editingPeriod.id, {
          periodName:        form.periodName,
          importCountry:     form.importCountry,
          cnCode:            form.cnCode,
          prodVolumeTonne:   form.prodVolumeTonne,
          scope1DirectTco2:  form.scope1DirectTco2,
          scope1Quality:     form.scope1Quality,
          scope1AuditNote:   form.scope1AuditNote,
          electricityKwh:    form.electricityKwh,
          electricitySource: form.electricitySource,
          matchingRatePct:   form.matchingRatePct,
          gecConnected:      form.gecConnected,
          carbonPriceEur:    form.carbonPriceEur,
          scope2Exempt:      form.scope2Exempt,
        });
        setInstallation(prev => prev ? {
          ...prev,
          periods: prev.periods.map(p => p.id === updated.id ? { ...p, ...updated, result: undefined } : p),
        } : prev);
      } else {
        const body: CreatePeriodBody = { ...form };
        if (showFuel && fuelRows.some(r => r.consumedMwh > 0)) {
          (body as CreatePeriodBody & { fuelBreakdown?: unknown[] }).fuelBreakdown = fuelRows
            .filter(r => r.consumedMwh > 0)
            .map(r => ({ fuelType: r.fuelType, consumedMwh: r.consumedMwh, emissionFactorOverride: r.efOverride }));
          body.scope1DirectTco2 = fuelTotal();
        }
        const period = await api.periods.create(id, body);
        setInstallation(prev => prev ? { ...prev, periods: [period, ...prev.periods] } : prev);
      }
      setShowModal(false);
      setForm(EMPTY_FORM);
      setEditingPeriod(null);
      setEfManual(false);
      setEfEntry(null);
      setShowFuel(false);
      setFuelRows([{ ...EMPTY_FUEL_ROW }]);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Hata");
    }
    setSaving(false);
  }

  async function deletePeriod(period: Period) {
    if (!id) return;
    if (!confirm(`"${period.periodName}" dönemini silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz.`)) return;
    try {
      await api.periods.delete(id, period.id);
      setInstallation(prev => prev ? { ...prev, periods: prev.periods.filter(p => p.id !== period.id) } : prev);
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Silme hatası");
    }
  }

  async function calculate(period: Period) {
    if (!id) return;
    setCalculating(period.id);
    try {
      const res = await api.periods.calculate(id, period.id);
      setInstallation(prev => {
        if (!prev) return prev;
        return { ...prev, periods: prev.periods.map(p => p.id === period.id ? { ...p, result: res.stored } : p) };
      });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Hesaplama hatası");
    }
    setCalculating(null);
  }

  function openCsvModal(periodId: string) {
    setCsvPeriodId(periodId);
    setCsvFile(null);
    setCsvResult(null);
    setShowCsvModal(true);
  }

  async function uploadCsv() {
    if (!id || !csvPeriodId || !csvFile) return;
    setCsvUploading(true);
    try {
      const res = await api.cfe.importCsv(id, csvPeriodId, csvFile);
      setCsvResult({ rowCount: res.rowCount, errorCount: res.errorCount, errors: res.errors, cfeScore: res.result.cfeScore });
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "CSV yükleme hatası");
    }
    setCsvUploading(false);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setCsvDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) setCsvFile(file);
  }

  if (!installation) return <div style={{ padding: 40, textAlign: "center", color: "#5c7a72" }}>Yükleniyor...</div>;

  return (
    <>
      <div style={s.page}>
        <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 8 }}>
          <Link to="/cbam" style={{ color: "#00b87a", textDecoration: "none" }}>← Tesisler</Link>
        </div>
        <div style={s.h1}>{installation.facilityName}</div>
        <div style={s.sub}>{installation.operator} · {installation.facilityCountry}</div>

        <button style={s.addBtn} onClick={() => setShowModal(true)}>+ Yeni Dönem Ekle</button>

        {installation.periods.length === 0 ? (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#5c7a72" }}>
            Henüz raporlama dönemi yok. İlk dönemi ekleyin.
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Dönem</th>
                <th style={s.th}>CN Kodu</th>
                <th style={s.th}>Üretim (t)</th>
                <th style={s.th}>SEE Baseline</th>
                <th style={s.th}>SEE Voltfox</th>
                <th style={s.th}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {installation.periods.map(p => (
                <tr key={p.id}>
                  <td style={s.td}>
                    <Link to={`/installations/${id}/periods/${p.id}`} style={{ color: "#00b87a", fontWeight: 600 }}>
                      {p.periodName}
                    </Link>
                    <div style={{ fontSize: 12, color: "#5c7a72" }}>{p.startDate?.slice(0,10)} – {p.endDate?.slice(0,10)}</div>
                  </td>
                  <td style={s.td}>{p.cnCode}</td>
                  <td style={s.td}>{p.prodVolumeTonne.toLocaleString()}</td>
                  <td style={s.td}>
                    {p.result ? `${p.result.seeBaseline.toFixed(4)} tCO₂e/t` : <span style={{ color: "#5c7a72" }}>—</span>}
                  </td>
                  <td style={s.td}>
                    {p.result
                      ? <span style={{ color: "#059669", fontWeight: 600 }}>{p.result.seeVoltfox.toFixed(4)} tCO₂e/t</span>
                      : <span style={{ color: "#5c7a72" }}>—</span>}
                  </td>
                  <td style={s.td}>
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap" as const }}>
                      <button style={{ ...s.btnSm, ...(p.result ? s.blue : s.green) }}
                        disabled={calculating === p.id}
                        onClick={() => calculate(p)}>
                        {calculating === p.id ? "..." : p.result ? "Yeniden Hesapla" : "Hesapla"}
                      </button>
                      <button style={{ ...s.btnSm, ...s.gray }} onClick={() => openCsvModal(p.id)}>
                        CSV Yükle
                      </button>
                      <button style={{ ...s.btnSm, background: "#e6f9f2", color: "#009966" }}
                        onClick={() => openEditPeriod(p)}>
                        Düzenle
                      </button>
                      <button style={{ ...s.btnSm, background: "#FEE2E2", color: "#DC2626" }}
                        onClick={() => deletePeriod(p)}>
                        Sil
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <CbamProductsSection installationId={installation.id} />
      </div>

      {/* ── Dönem oluşturma / düzenleme modal ── */}
      {showModal && (
        <div style={s.modal} onClick={e => { if (e.target === e.currentTarget) { setShowModal(false); setEditingPeriod(null); } }}>
          <div style={s.mCard}>
            <div style={s.mTitle}>{editingPeriod ? "Dönem Düzenle" : "Yeni Raporlama Dönemi"}</div>
            {error && <div style={s.err}>{error}</div>}
            <form onSubmit={createPeriod}>
              <div style={s.section}>Dönem Bilgileri</div>
              <label style={s.label}>Dönem Adı *</label>
              <input style={s.input} value={form.periodName}
                onChange={e => set("periodName", e.target.value)} placeholder="Q1 2025" required />
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Başlangıç *</label>
                  <input style={s.input} type="date" value={form.startDate}
                    onChange={e => set("startDate", e.target.value)} required />
                </div>
                <div>
                  <label style={s.label}>Bitiş *</label>
                  <input style={s.input} type="date" value={form.endDate}
                    onChange={e => set("endDate", e.target.value)} required />
                </div>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>İthalat Ülkesi *</label>
                  <input style={s.input} value={form.importCountry}
                    onChange={e => set("importCountry", e.target.value.toUpperCase())} maxLength={2} required />
                </div>
                <div>
                  <label style={s.label}>CN Kodu *</label>
                  <input style={s.input} value={form.cnCode}
                    onChange={e => set("cnCode", e.target.value)} placeholder="7208" required />
                </div>
              </div>

              <label style={s.label}>Rapor Yılı *</label>
              <input style={s.input} type="number" min={2024} max={2030}
                value={form.reportYear || ""}
                onChange={e => set("reportYear", parseInt(e.target.value))} required />
              <label style={s.label}>Üretim Hacmi (tonne) *</label>
              <input style={s.input} type="number" min="0" step="0.001" value={form.prodVolumeTonne || ""}
                onChange={e => set("prodVolumeTonne", parseFloat(e.target.value))} required />

              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", ...s.section as object }}>
                Scope 1
                <button type="button" onClick={() => setShowScope1Calc(true)}
                  style={{ fontSize: 11, color: "#009966", background: "#e6f9f2", border: "1px solid rgba(0,153,102,.3)",
                           borderRadius: 6, padding: "3px 10px", cursor: "pointer", fontWeight: 600 }}>
                  Hesaplama Yardımcısı
                </button>
              </div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Direkt Emisyon (tCO₂) *</label>
                  <input style={s.input} type="number" min="0" step="0.001" value={form.scope1DirectTco2 || ""}
                    onChange={e => set("scope1DirectTco2", parseFloat(e.target.value))} required />
                </div>
                <div>
                  <label style={s.label}>Veri Kalitesi *</label>
                  <select style={s.select} value={form.scope1Quality}
                    onChange={e => set("scope1Quality", e.target.value)}>
                    <option value="measured">Ölçülen</option>
                    <option value="calculated">Hesaplanan</option>
                    <option value="estimated">Tahmini</option>
                  </select>
                </div>
              </div>

              <label style={s.label}>Scope 1 Kaynak Notu</label>
              <input style={s.input} value={form.scope1AuditNote || ""}
                onChange={e => set("scope1AuditNote", e.target.value || undefined)}
                placeholder="Örn: Doğalgaz faturası, ölçüm raporu no..." />

              {/* Yakıt breakdown — opsiyonel */}
              <div style={{ marginBottom: 14 }}>
                <button type="button"
                  style={{ background: "none", border: "none", color: "#00b87a", fontSize: 13, cursor: "pointer", padding: 0, fontWeight: 600 }}
                  onClick={() => setShowFuel(v => !v)}>
                  {showFuel ? "▼" : "▶"} Yakıt Detayı ile Hesapla (opsiyonel)
                </button>
                {showFuel && (
                  <div style={{ marginTop: 12, background: "#f4fbf8", border: "1px solid #d4ece4", borderRadius: 8, padding: 14 }}>
                    <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 10 }}>
                      Yakıt tipi ve tüketim girin — Scope 1 toplamı otomatik hesaplanır (IPCC 2006).
                    </div>
                    {fuelRows.map((row, i) => {
                      const ef = row.efOverride ?? FUEL_EF[row.fuelType];
                      const tco2 = (row.consumedMwh || 0) * ef;
                      return (
                        <div key={i} style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr auto", gap: 8, marginBottom: 8, alignItems: "end" }}>
                          <div>
                            {i === 0 && <div style={{ fontSize: 11, color: "#5c7a72", marginBottom: 3 }}>Yakıt Tipi</div>}
                            <select style={{ ...s.select, marginBottom: 0 }}
                              value={row.fuelType}
                              onChange={e => setFuelRows(rows => rows.map((r, j) => j === i ? { ...r, fuelType: e.target.value as FuelType } : r))}>
                              {(Object.keys(FUEL_LABELS) as FuelType[]).map(ft => (
                                <option key={ft} value={ft}>{FUEL_LABELS[ft]} ({FUEL_EF[ft]} tCO₂/MWh)</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            {i === 0 && <div style={{ fontSize: 11, color: "#5c7a72", marginBottom: 3 }}>Tüketim (MWh)</div>}
                            <input style={{ ...s.input, marginBottom: 0 }} type="number" min="0" step="0.1"
                              value={row.consumedMwh || ""}
                              onChange={e => setFuelRows(rows => rows.map((r, j) => j === i ? { ...r, consumedMwh: parseFloat(e.target.value) || 0 } : r))} />
                          </div>
                          <div>
                            {i === 0 && <div style={{ fontSize: 11, color: "#5c7a72", marginBottom: 3 }}>Sonuç (tCO₂)</div>}
                            <div style={{ padding: "9px 12px", background: "#E0F2FE", borderRadius: 7, fontSize: 13, fontWeight: 600, color: "#0369A1" }}>
                              {tco2.toFixed(2)}
                            </div>
                          </div>
                          <div style={{ paddingTop: i === 0 ? 18 : 0 }}>
                            {fuelRows.length > 1 && (
                              <button type="button" style={{ background: "#FEE2E2", border: "none", borderRadius: 6, color: "#DC2626", cursor: "pointer", padding: "6px 10px", fontSize: 13 }}
                                onClick={() => setFuelRows(rows => rows.filter((_, j) => j !== i))}>×</button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
                      <button type="button"
                        style={{ background: "none", border: "1px dashed #D1D5DB", borderRadius: 6, color: "#5c7a72", cursor: "pointer", padding: "5px 12px", fontSize: 12 }}
                        onClick={() => setFuelRows(rows => [...rows, { ...EMPTY_FUEL_ROW }])}>
                        + Yakıt Ekle
                      </button>
                      <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1f1a" }}>
                        Toplam: {fuelTotal().toFixed(2)} tCO₂
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div style={s.section}>Scope 2 — Elektrik</div>
              <div style={s.row2}>
                <div>
                  <label style={s.label}>Tüketim (kWh) *</label>
                  <input style={s.input} type="number" min="0" value={form.electricityKwh || ""}
                    onChange={e => set("electricityKwh", parseFloat(e.target.value))} required />
                </div>
                <div>
                  <label style={s.label}>Veri Kaynağı *</label>
                  <select style={s.select} value={form.electricitySource}
                    onChange={e => set("electricitySource", e.target.value)}>
                    <option value="smart_meter">Akıllı Sayaç</option>
                    <option value="erp">ERP</option>
                    <option value="invoice">Fatura</option>
                    <option value="manual">Manuel</option>
                  </select>
                </div>
              </div>

              {/* EF — tesisin ülkesine göre otomatik doldurma */}
              <div style={s.row2}>
                <div>
                  <label style={s.label}>
                    Tesis Ülkesi
                    {efCountries.length > 0 && (
                      <span style={{ fontWeight: 400, color: "#5c7a72", fontSize: 12, marginLeft: 4 }}>
                        (EF için ülke seç)
                      </span>
                    )}
                  </label>
                  {efCountries.length > 0 ? (
                    <select style={s.select}
                      value={efCountries.find(c => c.iso2 === installation.facilityCountry) ? installation.facilityCountry : ""}
                      onChange={e => {
                        const iso2 = e.target.value;
                        setEfManual(false);
                        api.defaults.efLookup(iso2).then(entry => {
                          setEfEntry(entry);
                          setForm(f => ({ ...f, baselineEf: entry.ef }));
                        }).catch(() => { setEfEntry(null); });
                      }}>
                      <option value="">— Seçin —</option>
                      {efCountries.map(c => (
                        <option key={c.iso2} value={c.iso2}>{c.name} ({c.iso2}) — {c.ef} tCO₂/MWh</option>
                      ))}
                    </select>
                  ) : (
                    <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 14 }}>Yükleniyor...</div>
                  )}
                </div>
                <div>
                  <label style={s.label}>
                    Baseline EF (tCO₂/MWh)
                    {efEntry && !efManual && (
                      <span style={{ ...s.badge, ...s.badgeAuto }}>Otomatik</span>
                    )}
                    {efManual && (
                      <span style={{ ...s.badge, ...s.badgeManual }}>Manuel</span>
                    )}
                  </label>
                  <input style={s.input} type="number" min="0" step="0.0001"
                    value={form.baselineEf ?? ""}
                    placeholder={efEntry ? `${efEntry.ef}` : "örn. 0.474"}
                    onChange={e => handleBaselineEfChange(e.target.value)} />
                  {efEntry && !efManual && (
                    <div style={s.efNote}>
                      Kaynak: {efEntry.source} · {efEntry.year} yılı verisi
                      {efManual && " · "}
                      <button type="button" style={{ background: "none", border: "none", color: "#5c7a72", cursor: "pointer", fontSize: 11, textDecoration: "underline", padding: 0 }}
                        onClick={() => { setEfManual(false); if (efEntry) set("baselineEf", efEntry.ef); }}>
                        sıfırla
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div style={s.row2}>
                <div>
                  <label style={s.label}>Yenilenebilir EF (tCO₂/MWh)</label>
                  <input style={s.input} type="number" min="0" step="0.0001" value={form.renewableEf || ""}
                    onChange={e => set("renewableEf", parseFloat(e.target.value))} />
                </div>
                <div>
                  <label style={s.label}>24/7 CFE Eşleşme Oranı (0–100%)</label>
                  <input style={s.input} type="number" min="0" max="100" step="0.1" value={form.matchingRatePct || ""}
                    onChange={e => set("matchingRatePct", parseFloat(e.target.value))} />
                </div>
              </div>

              <label style={s.label}>Karbon Fiyatı (€/tCO₂) — CBAM karşılaştırması için</label>
              <input style={s.input} type="number" min="0" step="0.01"
                value={(form.carbonPriceEur as number | undefined) || ""}
                onChange={e => set("carbonPriceEur", e.target.value ? parseFloat(e.target.value) : undefined)}
                placeholder="Opsiyonel" />

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 14, padding: "10px 12px", background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 7 }}>
                <input type="checkbox" checked={form.gecConnected ?? false}
                  onChange={e => set("gecConnected", e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#065F46" }}>Voltfox GEC Bağlantısı Aktif</div>
                  <div style={{ fontSize: 12, color: "#047857", marginTop: 2 }}>
                    GEC üzerinden saatlik üretim verisi otomatik çekilir. CFE eşleştirme skoru güncellenir.
                  </div>
                </div>
              </label>

              <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", marginBottom: 14, padding: "10px 12px", background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 7 }}>
                <input type="checkbox" checked={form.scope2Exempt ?? false}
                  onChange={e => set("scope2Exempt", e.target.checked)}
                  style={{ marginTop: 2, flexShrink: 0 }} />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#92400E" }}>Scope 2 CBAM Muafiyeti</div>
                  <div style={{ fontSize: 12, color: "#B45309", marginTop: 2 }}>
                    Ek-IV Md.4(2) — Bu CN kodu 2026–2028 geçiş döneminde dolaylı emisyondan muaftır.
                    İşaretlenirse Scope 2 = 0 olarak raporlanır.
                  </div>
                </div>
              </label>

              <div style={s.btnRow}>
                <button type="button" style={{ ...s.btn, ...s.btnS }}
                  onClick={() => { setShowModal(false); setForm(EMPTY_FORM); setEfManual(false); setEfEntry(null); }}>
                  İptal
                </button>
                <button type="submit" style={{ ...s.btn, ...s.btnP }} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── CSV yükleme modal ── */}
      {showCsvModal && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowCsvModal(false)}>
          <div style={{ ...s.mCard, width: 480 }}>
            <div style={s.mTitle}>CFE Saatlik Veri Yükleme</div>
            <p style={{ fontSize: 13, color: "#5c7a72", marginBottom: 16 }}>
              Beklenen CSV formatı: <code style={{ background: "#eef7f3", padding: "1px 5px", borderRadius: 3 }}>timestamp,consumption_kwh,production_kwh</code>
              <br />Maksimum 10 MB · Yıllık ~8760 satır
            </p>

            {!csvResult ? (
              <>
                <div
                  style={{ ...s.dropzone, ...(csvDragging ? s.dropzoneActive : {}) }}
                  onDragOver={e => { e.preventDefault(); setCsvDragging(true); }}
                  onDragLeave={() => setCsvDragging(false)}
                  onDrop={handleDrop}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {csvFile ? (
                    <div>
                      <div style={{ fontWeight: 600 }}>{csvFile.name}</div>
                      <div style={{ fontSize: 12, color: "#5c7a72" }}>{(csvFile.size / 1024).toFixed(0)} KB</div>
                    </div>
                  ) : (
                    <div style={{ color: "#5c7a72" }}>
                      CSV dosyasını sürükleyin veya tıklayın
                    </div>
                  )}
                  <input ref={fileInputRef} type="file" accept=".csv,text/csv" style={{ display: "none" }}
                    onChange={e => setCsvFile(e.target.files?.[0] ?? null)} />
                </div>

                <div style={s.btnRow}>
                  <button style={{ ...s.btn, ...s.btnS }} onClick={() => setShowCsvModal(false)}>İptal</button>
                  <button style={{ ...s.btn, ...s.btnP }} disabled={!csvFile || csvUploading} onClick={uploadCsv}>
                    {csvUploading ? "Yükleniyor..." : "Yükle & Hesapla"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 8, padding: 16, marginBottom: 16 }}>
                  <div style={{ fontWeight: 700, color: "#065F46", fontSize: 15, marginBottom: 4 }}>
                    CFE Skoru: {csvResult.cfeScore.toFixed(1)}%
                  </div>
                  <div style={{ fontSize: 13, color: "#1a3530" }}>
                    {csvResult.rowCount} satır işlendi
                    {csvResult.errorCount > 0 && ` · ${csvResult.errorCount} satır atlandı`}
                  </div>
                </div>
                {csvResult.errors.length > 0 && (
                  <div style={{ background: "#FEF3C7", border: "1px solid #FCD34D", borderRadius: 8, padding: 12, marginBottom: 16 }}>
                    <div style={{ fontWeight: 600, fontSize: 12, marginBottom: 6 }}>Atlandı:</div>
                    {csvResult.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: 12, color: "#92400E" }}>{e}</div>
                    ))}
                  </div>
                )}
                <button style={{ ...s.btn, ...s.btnP, width: "100%" }} onClick={() => setShowCsvModal(false)}>
                  Kapat
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {showScope1Calc && (
        <Scope1Calculator
          onApply={tco2 => set("scope1DirectTco2", tco2)}
          onClose={() => setShowScope1Calc(false)}
        />
      )}
    </>
  );
}

// ── CBAM Ürünleri bölümü (InstallationDetailPage içinde) ─────────────────────
function csBadge(color: string): React.CSSProperties {
  return {
    display: "inline-block", fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 10,
    background: color === "green" ? "#d1fae5" : "#dbeafe",
    color:      color === "green" ? "#065f46" : "#1e40af",
  };
}

function CbamProductsSection({ installationId }: { installationId: string }) {
  const [products,  setProducts]  = useState<CbamProduct[]>([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState(false);
  const [form, setForm] = useState({
    productName: "", cnCode: "", description: "",
    unit: "tonne", isCbamScope: true, energyAllocationMode: "facility" as "facility" | "band",
  });

  useEffect(() => {
    api.cbamProducts.list(installationId)
      .then(r => setProducts(r.products))
      .finally(() => setLoading(false));
  }, [installationId]);

  async function save() {
    setSaving(true);
    try {
      await api.cbamProducts.create(installationId, form);
      const r = await api.cbamProducts.list(installationId);
      setProducts(r.products);
      setShowForm(false);
      setForm({ productName: "", cnCode: "", description: "", unit: "tonne", isCbamScope: true, energyAllocationMode: "facility" });
    } catch { /* ignore */ }
    finally { setSaving(false); }
  }

  async function del(productId: string) {
    if (!confirm("Bu ürünü ve tüm dönemlerini silmek istiyor musunuz?")) return;
    await api.cbamProducts.delete(installationId, productId).catch(() => {});
    setProducts(p => p.filter(x => x.id !== productId));
  }

  const cs: Record<string, React.CSSProperties> = {
    sec:   { marginTop: 32, marginBottom: 4 },
    secH:  { fontSize: 13, fontWeight: 700, color: "#5c7a72", textTransform: "uppercase", letterSpacing: ".05em", marginBottom: 12 },
    card:  { background: "#fff", border: "1px solid #d4ece4", borderRadius: 10, padding: "16px 18px",
              display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    name:  { fontWeight: 600, fontSize: 14, color: "#0a1f1a" },
    meta:  { fontSize: 12, color: "#5c7a72", marginTop: 2 },
    addBtn:{ background: "#00b87a", color: "#fff", border: "none", borderRadius: 7,
              padding: "8px 16px", fontSize: 13, fontWeight: 600, cursor: "pointer" },
    inp:   { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB",
              fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" as const, marginBottom: 10 },
    sel:   { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB",
              fontSize: 13, background: "#fff", marginBottom: 10, boxSizing: "border-box" as const },
    lbl:   { fontSize: 12, color: "#5c7a72", marginBottom: 4, display: "block" as const },
    formCard: { background: "#f0faf5", border: "1px solid #d4ece4", borderRadius: 10, padding: "18px", marginBottom: 12 },
  };

  return (
    <div style={cs.sec}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={cs.secH}>CBAM Ürünleri</div>
        <button style={cs.addBtn} onClick={() => setShowForm(v => !v)}>
          {showForm ? "İptal" : "+ Ürün Ekle"}
        </button>
      </div>

      {showForm && (
        <div style={cs.formCard}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 4 }}>
            <div>
              <label style={cs.lbl}>Ürün Adı *</label>
              <input style={cs.inp} placeholder="Örn: Çelik Profil, Alüminyum Levha"
                value={form.productName} onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
            </div>
            <div>
              <label style={cs.lbl}>CN Kodu</label>
              <input style={cs.inp} placeholder="Örn: 7206, 7601, 2523"
                value={form.cnCode} onChange={e => setForm(f => ({ ...f, cnCode: e.target.value }))} />
            </div>
            <div>
              <label style={cs.lbl}>Birim</label>
              <select style={cs.sel} value={form.unit} onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                <option value="tonne">Ton</option>
                <option value="MWh">MWh</option>
                <option value="kg">kg</option>
              </select>
            </div>
            <div>
              <label style={cs.lbl}>Enerji Dağıtım Modu *</label>
              <select style={cs.sel} value={form.energyAllocationMode}
                onChange={e => setForm(f => ({ ...f, energyAllocationMode: e.target.value as "facility" | "band" }))}>
                <option value="facility">Tesis (orantılı dağıtım)</option>
                <option value="band">Band (doğrudan atama)</option>
              </select>
            </div>
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={{ ...cs.lbl, display: "flex", alignItems: "center", gap: 8 }}>
              <input type="checkbox" checked={form.isCbamScope}
                onChange={e => setForm(f => ({ ...f, isCbamScope: e.target.checked }))} />
              CBAM Kapsamında
            </label>
          </div>
          <button style={{ ...cs.addBtn, opacity: saving ? 0.6 : 1 }}
            onClick={save} disabled={saving || !form.productName.trim()}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      )}

      {loading && <div style={{ color: "#5c7a72", fontSize: 13 }}>Yükleniyor...</div>}

      {!loading && products.length === 0 && !showForm && (
        <div style={{ color: "#5c7a72", fontSize: 13, padding: "12px 0" }}>
          Bu tesis için henüz CBAM ürünü tanımlanmamış.
        </div>
      )}

      {products.map(p => (
        <div key={p.id} style={cs.card}>
          <div>
            <div style={cs.name}>{p.productName}</div>
            <div style={cs.meta}>
              {p.cnCode && <span style={{ marginRight: 8 }}>CN: {p.cnCode}</span>}
              <span style={csBadge(p.isCbamScope ? "green" : "blue")}>
                {p.isCbamScope ? "CBAM Kapsam İçi" : "Kapsam Dışı"}
              </span>
              <span style={{ marginLeft: 6, ...csBadge("blue") }}>
                {p.energyAllocationMode === "band" ? "Band Modu" : "Tesis Modu"}
              </span>
              {p.productPeriods.length > 0 && (
                <span style={{ marginLeft: 6, color: "#5c7a72" }}>
                  {p.productPeriods.length} dönem
                  {p.productPeriods[0].see ? ` · SEE: ${parseFloat(p.productPeriods[0].see).toFixed(4)} tCO₂/${p.unit}` : ""}
                </span>
              )}
            </div>
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Link
              to={`/installations/${installationId}/products/${p.id}`}
              style={{ padding: "6px 14px", borderRadius: 6, background: "#d1fae5",
                       color: "#065f46", fontSize: 13, fontWeight: 600, textDecoration: "none" }}
            >
              Dönemler →
            </Link>
            <button
              onClick={() => del(p.id)}
              style={{ padding: "6px 10px", borderRadius: 6, border: "none",
                       background: "#fee2e2", color: "#dc2626", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
            >
              Sil
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
