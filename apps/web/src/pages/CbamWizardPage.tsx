import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Installation, Period, DefaultResult } from "../lib/api.js";

/* ── Sabitler (cbam-scope1-calc.ts ile senkron) ─────────────────────────────── */
const FUEL_EF: Record<string, number> = {
  naturalGas: 0.0561,
  fuelOil:    0.0773,
  coal:       0.0946,
  other:      0.0700,
};
const FUEL_LABELS: Record<string, string> = {
  naturalGas: "Doğalgaz",
  fuelOil:    "Fuel Oil",
  coal:       "Kömür (Taş)",
  other:      "Diğer",
};
const PROCESS_STOICH: Record<string, number> = {
  CaCO3:    0.4397,
  dolomite: 0.4773,
  iron_ore: 0.0000,
  other:    0.0000,
};
const MATERIAL_LABELS: Record<string, string> = {
  CaCO3:    "Kireçtaşı (CaCO₃)",
  dolomite: "Dolomit",
  iron_ore: "Demir Cevheri",
  other:    "Diğer",
};
const SECTOR_CN: Record<string, { code: string; label: string }[]> = {
  steel: [
    { code: "72071190", label: "72071190 — Düz çelik yarı mamul" },
    { code: "72081000", label: "72081000 — Sıcak haddelenmiş levha" },
    { code: "72131000", label: "72131000 — Çubuk ve profil (çelik)" },
    { code: "72183000", label: "72183000 — Paslanmaz çelik yarı mamul" },
    { code: "73061100", label: "73061100 — Dikişsiz boru (paslanmaz)" },
  ],
  aluminium: [
    { code: "7601",     label: "7601 — Ham alüminyum (döküm/işlenmiş)" },
    { code: "7606",     label: "7606 — Alüminyum levha & tabaka" },
    { code: "76041010", label: "76041010 — Alüminyum çubuk ve profil" },
  ],
  cement: [
    { code: "25231000", label: "25231000 — Gri klinker" },
    { code: "25232900", label: "25232900 — Gri Portland çimento" },
    { code: "25239000", label: "25239000 — Diğer hidrolik çimento" },
  ],
  fertiliser: [
    { code: "31021090", label: "31021090 — Üre" },
    { code: "31023090", label: "31023090 — Amonyum nitrat" },
    { code: "31025000", label: "31025000 — Kalsiyum nitrat" },
    { code: "31055100", label: "31055100 — MAP/DAP gübre" },
  ],
};
const SECTOR_LABELS: Record<string, string> = {
  steel:      "Çelik",
  aluminium:  "Alüminyum",
  cement:     "Çimento",
  fertiliser: "Gübre",
};

/* ── Stil Sistemi (GecPage ile uyumlu) ──────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:  { maxWidth: 900, margin: "0 auto", padding: "32px 28px" },
  h1:    { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:   { fontSize: 14, color: "#5c7a72", marginBottom: 32 },
  card:  { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "24px", marginBottom: 20 },
  cardH: { fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 16,
           textTransform: "uppercase" as const, letterSpacing: ".08em" },
  lbl:   { fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5, display: "block" as const },
  hint:  { fontSize: 11, color: "#5c7a72", marginTop: 3 },
  inp:   { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
           fontSize: 13, background: "#fff", color: "#0a1f1a", boxSizing: "border-box" as const, fontFamily: "inherit" },
  sel:   { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
           fontSize: 13, background: "#fff", color: "#0a1f1a", fontFamily: "inherit" },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 },
  grid3: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 },
  btn:   { padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
           fontWeight: 700, fontSize: 14, background: "#00b87a", color: "#fff", fontFamily: "inherit" },
  btnOut:{ padding: "10px 22px", borderRadius: 8, border: "1px solid #d4ece4", cursor: "pointer",
           fontWeight: 600, fontSize: 14, background: "#fff", color: "#0a1f1a", fontFamily: "inherit" },
  btnDis:{ opacity: 0.5, cursor: "not-allowed" },
  addBtn:{ padding: "6px 14px", borderRadius: 6, border: "1px dashed #00b87a", cursor: "pointer",
           fontSize: 12, fontWeight: 600, color: "#00b87a", background: "#f4fbf8", fontFamily: "inherit" },
  delBtn:{ padding: "4px 10px", borderRadius: 5, border: "1px solid #fca5a5", cursor: "pointer",
           fontSize: 11, background: "#fee2e2", color: "#991b1b", fontFamily: "inherit" },
  row:   { display: "flex", gap: 8, alignItems: "flex-end", padding: "10px", background: "#f8fdfb",
           borderRadius: 8, border: "1px solid #e6f3ed", marginBottom: 8 },
  kpi:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:  { fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 6,
           textTransform: "uppercase" as const, letterSpacing: ".06em" },
  kpiV:  { fontSize: 24, fontWeight: 800, color: "#0a1f1a", lineHeight: 1 },
  kpiU:  { fontSize: 11, color: "#5c7a72", marginTop: 4 },
  info:  { background: "#e6f9f2", border: "1px solid rgba(0,184,122,.3)", borderRadius: 8,
           padding: "10px 14px", fontSize: 12, color: "#009966" },
  warn:  { background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
           padding: "10px 14px", fontSize: 12, color: "#92400e" },
  note:  { background: "#f4fbf8", borderRadius: 8, padding: "14px 16px",
           fontSize: 12, color: "#5c7a72", lineHeight: 1.7 },
};

/* ── Tipler ──────────────────────────────────────────────────────────────────── */
type Step = 1 | 2 | 3 | 4;
type FuelType    = "naturalGas" | "fuelOil" | "coal" | "other";
type MaterialType = "CaCO3" | "dolomite" | "iron_ore" | "other";

interface FuelRow     { id: string; fuelType: FuelType; quantityGJ: number; efTco2PerGj: number }
interface ProcessRow  { id: string; material: MaterialType; quantityTonne: number; stoichFactor: number }

interface WizardState {
  sector:     string;
  cnCode:     string;
  country:    string;
  periodName: string;
  prodVolume: number;
  fuels:        FuelRow[];
  processes:    ProcessRow[];
  elecKwh:      number;
  elecEf:       number;
  gecConnected: boolean;
  gecPeriodId:  string;
}

/* ── Yardımcı ────────────────────────────────────────────────────────────────── */
function uid() { return Math.random().toString(36).slice(2, 8); }
function round(v: number, d: number) { const f = 10 ** d; return Math.round(v * f) / f; }

/* ── Stepper Başlık ──────────────────────────────────────────────────────────── */
const STEPS = [
  { n: 1, label: "Tesis & Dönem" },
  { n: 2, label: "Scope 1 Girişi" },
  { n: 3, label: "Scope 2 Bağlantısı" },
  { n: 4, label: "Sonuç" },
];

function Stepper({ current }: { current: Step }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 0, marginBottom: 32 }}>
      {STEPS.map((st, i) => {
        const done    = current > st.n;
        const active  = current === st.n;
        const circleColor = done ? "#00b87a" : active ? "#00b87a" : "#d4ece4";
        const textColor   = done || active ? "#fff" : "#5c7a72";
        const labelColor  = active ? "#0a1f1a" : "#5c7a72";
        return (
          <div key={st.n} style={{ display: "flex", alignItems: "center", flex: 1 }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", minWidth: 60 }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", background: circleColor,
                            display: "flex", alignItems: "center", justifyContent: "center",
                            fontSize: 14, fontWeight: 700, color: textColor, border: `2px solid ${circleColor}`,
                            transition: "all .2s" }}>
                {done ? "✓" : st.n}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: labelColor, marginTop: 6,
                            textAlign: "center", whiteSpace: "nowrap" }}>
                {st.label}
              </div>
            </div>
            {i < STEPS.length - 1 && (
              <div style={{ flex: 1, height: 2, background: done ? "#00b87a" : "#d4ece4",
                            margin: "0 4px", marginBottom: 20, transition: "background .2s" }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

/* ── Tooltip ─────────────────────────────────────────────────────────────────── */
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-block" }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: "help", fontSize: 11, color: "#00b87a", marginLeft: 4, fontWeight: 700 }}
      >?</span>
      {show && (
        <div style={{ position: "absolute", left: "50%", bottom: "calc(100% + 6px)",
                      transform: "translateX(-50%)", background: "#0a1f1a", color: "#e2efe9",
                      fontSize: 11, padding: "6px 10px", borderRadius: 6, whiteSpace: "pre-wrap",
                      maxWidth: 260, zIndex: 999, boxShadow: "0 4px 16px rgba(0,0,0,.2)" }}>
          {text}
        </div>
      )}
    </span>
  );
}

/* ── Ana Bileşen ─────────────────────────────────────────────────────────────── */
export default function CbamWizardPage() {
  const [step,  setStep]  = useState<Step>(1);
  const [state, setState] = useState<WizardState>({
    sector:     "steel",
    cnCode:     SECTOR_CN.steel[0].code,
    country:    "Türkiye",
    periodName: "Q1 2025",
    prodVolume: 0,
    fuels:      [{ id: uid(), fuelType: "naturalGas", quantityGJ: 0, efTco2PerGj: FUEL_EF.naturalGas }],
    processes:  [],
    elecKwh:    0,
    elecEf:     0.4943,
    gecConnected: false,
    gecPeriodId:  "",
  });

  // Adım 3 için GEC verisi
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [periods,       setPeriods]       = useState<Period[]>([]);
  const [selectedInstId, setSelectedInstId] = useState("");

  // Adım 4 sonuç
  const [defaultResult, setDefaultResult] = useState<DefaultResult | null>(null);
  const [defaultLoading, setDefaultLoading] = useState(false);
  const [carbonPrice, setCarbonPrice] = useState(56); // €/tCO₂eq — varsayılan

  const set = <K extends keyof WizardState>(k: K, v: WizardState[K]) =>
    setState(prev => ({ ...prev, [k]: v }));

  // Sektör değişince CN kodunu sıfırla
  function handleSectorChange(s: string) {
    set("sector", s);
    set("cnCode", SECTOR_CN[s]?.[0]?.code ?? "");
  }

  // Yakıt satırı
  function addFuel() {
    set("fuels", [...state.fuels, { id: uid(), fuelType: "naturalGas" as FuelType, quantityGJ: 0, efTco2PerGj: FUEL_EF.naturalGas }]);
  }
  function removeFuel(id: string) {
    set("fuels", state.fuels.filter(f => f.id !== id));
  }
  function updateFuel(id: string, patch: Partial<FuelRow>) {
    set("fuels", state.fuels.map(f => {
      if (f.id !== id) return f;
      const updated = { ...f, ...patch };
      // EF tipi değişince standart değeri yükle (kullanıcı değiştirmediyse)
      if (patch.fuelType && !patch.efTco2PerGj) {
        updated.efTco2PerGj = FUEL_EF[patch.fuelType] ?? f.efTco2PerGj;
      }
      return updated;
    }));
  }

  // Proses satırı
  function addProcess() {
    set("processes", [...state.processes, { id: uid(), material: "CaCO3" as MaterialType, quantityTonne: 0, stoichFactor: PROCESS_STOICH.CaCO3 }]);
  }
  function removeProcess(id: string) {
    set("processes", state.processes.filter(p => p.id !== id));
  }
  function updateProcess(id: string, patch: Partial<ProcessRow>) {
    set("processes", state.processes.map(p => {
      if (p.id !== id) return p;
      const updated = { ...p, ...patch };
      if (patch.material && !patch.stoichFactor) {
        updated.stoichFactor = PROCESS_STOICH[patch.material] ?? 0;
      }
      return updated;
    }));
  }

  // Adım 3: installation yükle
  useEffect(() => {
    api.installations.list().then(r => setInstallations(r)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedInstId) { setPeriods([]); return; }
    api.installations.get(selectedInstId)
      .then(r => setPeriods(r.periods ?? []))
      .catch(() => {});
  }, [selectedInstId]);

  // GEC dönem seçilince scope 2 değerlerini doldur
  function handleGecPeriod(periodId: string) {
    set("gecPeriodId", periodId);
    const period = periods.find(p => p.id === periodId);
    if (!period) return;
    set("elecKwh",     period.electricityKwh);
    set("elecEf",      period.baselineEf);
    set("gecConnected", period.gecConnected);
  }

  // Adım 4: CBAM varsayılan değeri çek
  async function goToResult() {
    setStep(4);
    setDefaultLoading(true);
    try {
      const r = await api.defaults.lookup(state.country, state.cnCode);
      setDefaultResult(r);
    } catch {
      setDefaultResult(null);
    } finally {
      setDefaultLoading(false);
    }
  }

  /* ── Hesaplama (Adım 4) ────────────────────────────────────────────────── */
  const scope1Fuel = state.fuels.reduce((s, f) => s + f.quantityGJ * f.efTco2PerGj, 0);
  const scope1Proc = state.processes.reduce((s, p) => s + p.quantityTonne * p.stoichFactor, 0);
  const scope1Tco2 = scope1Fuel + scope1Proc;
  const scope2Tco2 = (state.elecKwh / 1000) * state.elecEf;
  const totalTco2  = scope1Tco2 + scope2Tco2;
  const seeActual  = state.prodVolume > 0 ? totalTco2 / state.prodVolume : 0;

  const seeDefault       = defaultResult?.totalDefault ?? null;
  const savingsPerTonne  = seeDefault != null ? seeDefault - seeActual : null;
  const savingsTotalTco2 = savingsPerTonne != null && state.prodVolume > 0 ? savingsPerTonne * state.prodVolume : null;
  const savingsEur       = savingsTotalTco2 != null ? savingsTotalTco2 * carbonPrice : null;

  /* ── Validasyon ─────────────────────────────────────────────────────────── */
  const step1Valid = state.cnCode.length > 0 && state.country.length > 0 &&
                     state.periodName.length > 0 && state.prodVolume > 0;
  const step2Valid = state.fuels.length > 0 || state.processes.length > 0;

  /* ── Render ─────────────────────────────────────────────────────────────── */
  return (
    <div style={s.page}>
      <div style={s.h1}>CBAM Actual Emissions Hesaplayıcı</div>
      <div style={s.sub}>EU 2023/1773 Ek-IV Method A · Adım adım gömülü emisyon hesabı</div>

      <Stepper current={step} />

      {/* ── Adım 1: Tesis & Dönem ─────────────────────────────────────────── */}
      {step === 1 && (
        <div style={s.card}>
          <div style={s.cardH}>Tesis & Dönem Bilgisi</div>

          <div style={{ ...s.grid2, marginBottom: 16 }}>
            <div>
              <label style={s.lbl}>Sektör <span style={{ color: "#ef4444" }}>*</span></label>
              <select style={s.sel} value={state.sector} onChange={e => handleSectorChange(e.target.value)}>
                {Object.entries(SECTOR_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
              <div style={s.hint}>CBAM kapsamındaki sektörünüzü seçin</div>
            </div>
            <div>
              <label style={s.lbl}>
                CN Kodu <span style={{ color: "#ef4444" }}>*</span>
                <Tooltip text={"AB Gümrük Tarife Pozisyonu\n(Combined Nomenclature)\nİhraç ettiğiniz ürünün CN kodunu seçin"} />
              </label>
              <select style={s.sel} value={state.cnCode} onChange={e => set("cnCode", e.target.value)}>
                {(SECTOR_CN[state.sector] ?? []).map(cn => (
                  <option key={cn.code} value={cn.code}>{cn.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ ...s.grid2, marginBottom: 16 }}>
            <div>
              <label style={s.lbl}>
                Üretim Ülkesi <span style={{ color: "#ef4444" }}>*</span>
                <Tooltip text={"Ürünün üretildiği ülke\n(İhracatçı ülke — AB Komisyonu'nun CBAM\nvarsayılan değerini belirler)"} />
              </label>
              <input style={s.inp} value={state.country}
                onChange={e => set("country", e.target.value)}
                placeholder="Türkiye" />
            </div>
            <div>
              <label style={s.lbl}>
                Üretim Dönemi <span style={{ color: "#ef4444" }}>*</span>
                <Tooltip text={"CBAM beyanı için raporlama dönemi\nÖr: Q1 2025, 2024 (Yıllık), Ocak 2025"} />
              </label>
              <input style={s.inp} value={state.periodName}
                onChange={e => set("periodName", e.target.value)}
                placeholder="Q1 2025" />
            </div>
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={s.lbl}>
              Üretim Hacmi (tonne) <span style={{ color: "#ef4444" }}>*</span>
              <Tooltip text={"CBAM kapsamındaki ürünün üretim miktarı\nSEE = tCO₂ / üretim tonne hesabında payda"} />
            </label>
            <input style={{ ...s.inp, width: 260 }} type="number" min={0}
              value={state.prodVolume || ""}
              onChange={e => set("prodVolume", parseFloat(e.target.value) || 0)}
              placeholder="50000" />
            <div style={s.hint}>Tonne cinsinden toplam üretim hacmi</div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button style={{ ...s.btn, ...(step1Valid ? {} : s.btnDis) }}
              disabled={!step1Valid}
              onClick={() => setStep(2)}>
              Devam → Scope 1
            </button>
          </div>
        </div>
      )}

      {/* ── Adım 2: Scope 1 Girişi ────────────────────────────────────────── */}
      {step === 2 && (
        <div>
          {/* Yakıt Girişleri */}
          <div style={s.card}>
            <div style={s.cardH}>
              Yakıt Tüketimi
              <Tooltip text={"Yakıt kaynaklı Scope 1 emisyonlar\nFormül: Σ(Yakıt_i [GJ] × EF_i [tCO₂/GJ])\nKaynak: IPCC 2006 GL Vol.2 Table 1.4"} />
            </div>

            {state.fuels.map(fuel => (
              <div key={fuel.id} style={s.row}>
                <div style={{ flex: "0 0 160px" }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>Yakıt Tipi</label>
                  <select style={s.sel} value={fuel.fuelType}
                    onChange={e => updateFuel(fuel.id, { fuelType: e.target.value as FuelType })}>
                    {Object.entries(FUEL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>
                    Miktar (GJ)
                    <Tooltip text={"Enerji miktarı GJ cinsinden\n1 MWh = 3.6 GJ\nFaturanızdaki kWh değerini 0.0036 ile çarpın"} />
                  </label>
                  <input type="number" min={0} style={s.inp} value={fuel.quantityGJ || ""}
                    onChange={e => updateFuel(fuel.id, { quantityGJ: parseFloat(e.target.value) || 0 })}
                    placeholder="0" />
                </div>
                <div style={{ flex: "0 0 140px" }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>
                    EF (tCO₂/GJ)
                    <Tooltip text={"Emisyon faktörü\nStandart IPCC 2006 değeri otomatik yüklendi\nAudit onaylı farklı değer varsa değiştirin"} />
                  </label>
                  <input type="number" min={0} step={0.0001} style={s.inp}
                    value={fuel.efTco2PerGj}
                    onChange={e => updateFuel(fuel.id, { efTco2PerGj: parseFloat(e.target.value) || 0 })} />
                </div>
                <div style={{ flex: "0 0 80px", textAlign: "right" as const }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>tCO₂</label>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#00b87a", paddingTop: 8 }}>
                    {round(fuel.quantityGJ * fuel.efTco2PerGj, 2).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <button style={s.delBtn} onClick={() => removeFuel(fuel.id)}>✕</button>
              </div>
            ))}

            <button style={s.addBtn} onClick={addFuel}>+ Yakıt Satırı Ekle</button>

            {state.fuels.length > 0 && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#e6f9f2",
                            borderRadius: 6, fontSize: 13, color: "#009966", fontWeight: 700 }}>
                Yakıt Toplam: {round(scope1Fuel, 2).toLocaleString("tr-TR")} tCO₂
              </div>
            )}
          </div>

          {/* Proses Emisyonları */}
          <div style={s.card}>
            <div style={s.cardH}>
              Proses Emisyonları (Hammadde)
              <Tooltip text={"Hammadde kalsinasyonundan kaynaklanan CO₂\nÖr: kireçtaşı (CaCO₃) → CaO + CO₂\nFormül: Σ(Miktar_i [t] × Stoich_i [tCO₂/t])"} />
            </div>

            {state.processes.length === 0 && (
              <div style={{ ...s.hint, marginBottom: 12 }}>
                Çimento, gübre ve demir-çelik sektörlerinde proses emisyonu ekleyin
              </div>
            )}

            {state.processes.map(proc => (
              <div key={proc.id} style={s.row}>
                <div style={{ flex: "0 0 200px" }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>Hammadde</label>
                  <select style={s.sel} value={proc.material}
                    onChange={e => updateProcess(proc.id, { material: e.target.value as MaterialType })}>
                    {Object.entries(MATERIAL_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>
                    Miktar (tonne)
                    <Tooltip text={"Üretimde kullanılan hammadde miktarı tonne cinsinden"} />
                  </label>
                  <input type="number" min={0} style={s.inp} value={proc.quantityTonne || ""}
                    onChange={e => updateProcess(proc.id, { quantityTonne: parseFloat(e.target.value) || 0 })}
                    placeholder="0" />
                </div>
                <div style={{ flex: "0 0 150px" }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>
                    Stoich Faktör (tCO₂/t)
                    <Tooltip text={"Stoikiometrik emisyon faktörü\nCaCO₃: 0.4397, Dolomit: 0.4773\nDiğer: kendi değerinizi girin"} />
                  </label>
                  <input type="number" min={0} step={0.0001} style={s.inp}
                    value={proc.stoichFactor}
                    onChange={e => updateProcess(proc.id, { stoichFactor: parseFloat(e.target.value) || 0 })} />
                </div>
                <div style={{ flex: "0 0 80px", textAlign: "right" as const }}>
                  <label style={{ ...s.lbl, fontSize: 11 }}>tCO₂</label>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "#00b87a", paddingTop: 8 }}>
                    {round(proc.quantityTonne * proc.stoichFactor, 2).toLocaleString("tr-TR", { minimumFractionDigits: 2 })}
                  </div>
                </div>
                <button style={s.delBtn} onClick={() => removeProcess(proc.id)}>✕</button>
              </div>
            ))}

            <button style={s.addBtn} onClick={addProcess}>+ Proses Satırı Ekle</button>

            {state.processes.length > 0 && (
              <div style={{ marginTop: 12, padding: "8px 12px", background: "#e6f9f2",
                            borderRadius: 6, fontSize: 13, color: "#009966", fontWeight: 700 }}>
                Proses Toplam: {round(scope1Proc, 2).toLocaleString("tr-TR")} tCO₂
              </div>
            )}
          </div>

          {/* Metodoloji notu (GecPage ile aynı stil) */}
          <div style={s.note}>
            <strong>Metodoloji:</strong> EU 2023/1773 Ek-IV Method A — Hesaplama Bazlı Yaklaşım<br />
            Yakıt EF kaynağı: IPCC 2006 GL Vol.2 Table 1.4 (tCO₂/GJ, LHV bazlı)<br />
            Proses EF kaynağı: Stoikiometrik hesap (IPCC 2006 GL Vol.3)<br />
            <strong>Kapsam:</strong> Doğrudan Scope 1 emisyonlar — Scope 2 elektrik bir sonraki adımda
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 16 }}>
            <button style={s.btnOut} onClick={() => setStep(1)}>← Geri</button>
            <button style={{ ...s.btn, ...(step2Valid ? {} : s.btnDis) }}
              disabled={!step2Valid}
              onClick={() => setStep(3)}>
              Devam → Scope 2
            </button>
          </div>
        </div>
      )}

      {/* ── Adım 3: Scope 2 Bağlantısı ───────────────────────────────────── */}
      {step === 3 && (
        <div style={s.card}>
          <div style={s.cardH}>Scope 2 — Satın Alınan Elektrik</div>

          {/* Toggle: GEC veya Manuel */}
          <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
            <button
              style={{ ...s.btn, ...(state.gecConnected ? {} : { background: "#e6f9f2", color: "#00b87a", border: "2px solid #00b87a" }) }}
              onClick={() => { set("gecConnected", true); }}
            >
              GEC'ten Çek
            </button>
            <button
              style={{ ...s.btnOut, ...(!state.gecConnected ? { borderColor: "#0a1f1a", fontWeight: 700 } : {}) }}
              onClick={() => { set("gecConnected", false); set("gecPeriodId", ""); }}
            >
              Manuel Giriş
            </button>
          </div>

          {state.gecConnected ? (
            <>
              <div style={s.info}>
                GEC hesabınızdaki saatlik enerji verisinden otomatik elektrik tüketimi ve EF alınır.
                Dönem seçtikten sonra değerler otomatik dolar.
              </div>
              <div style={{ ...s.grid2, marginTop: 16 }}>
                <div>
                  <label style={s.lbl}>Tesis</label>
                  <select style={s.sel} value={selectedInstId}
                    onChange={e => { setSelectedInstId(e.target.value); set("gecPeriodId", ""); }}>
                    <option value="">— Tesis seçin —</option>
                    {installations.map(i => (
                      <option key={i.id} value={i.id}>{i.facilityName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={s.lbl}>GEC Dönemi</label>
                  <select style={s.sel} value={state.gecPeriodId}
                    onChange={e => handleGecPeriod(e.target.value)}
                    disabled={!selectedInstId || periods.length === 0}>
                    <option value="">— Dönem seçin —</option>
                    {periods.map(p => (
                      <option key={p.id} value={p.id}>{p.periodName}</option>
                    ))}
                  </select>
                </div>
              </div>

              {state.gecPeriodId && (
                <div style={{ ...s.info, marginTop: 12 }}>
                  ✓ GEC Bağlandı — Elektrik: {state.elecKwh.toLocaleString("tr-TR")} kWh ·
                  Grid EF: {state.elecEf} tCO₂/MWh
                </div>
              )}
            </>
          ) : (
            <div style={s.grid2}>
              <div>
                <label style={s.lbl}>
                  Satın Alınan Elektrik (kWh)
                  <Tooltip text={"Raporlama döneminde şebekeden alınan toplam elektrik\nFaturalarınızdan alabilirsiniz"} />
                </label>
                <input type="number" min={0} style={s.inp} value={state.elecKwh || ""}
                  onChange={e => set("elecKwh", parseFloat(e.target.value) || 0)}
                  placeholder="5000000" />
              </div>
              <div>
                <label style={s.lbl}>
                  Grid EF (tCO₂/MWh)
                  <Tooltip text={"Ülke elektrik şebeke emisyon faktörü\nCBAM Ek-IV Tablo 2'deki ülke değeri (Türkiye: 0.4943)\nVeya EF Veri Servisi'nden güncel değer"} />
                </label>
                <input type="number" min={0} step={0.0001} style={s.inp} value={state.elecEf}
                  onChange={e => set("elecEf", parseFloat(e.target.value) || 0)} />
                <div style={s.hint}>Türkiye CBAM Annex IV Tablo 2: 0.4943 tCO₂/MWh</div>
              </div>
            </div>
          )}

          <div style={{ ...s.grid2, marginTop: 20 }}>
            <div style={s.kpi}>
              <div style={s.kpiL}>Scope 2 Emisyon</div>
              <div style={s.kpiV}>{round(scope2Tco2, 2).toLocaleString("tr-TR")}</div>
              <div style={s.kpiU}>tCO₂</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiL}>Toplam (S1 + S2)</div>
              <div style={s.kpiV}>{round(totalTco2, 2).toLocaleString("tr-TR")}</div>
              <div style={s.kpiU}>tCO₂</div>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 20 }}>
            <button style={s.btnOut} onClick={() => setStep(2)}>← Geri</button>
            <button style={s.btn} onClick={goToResult}>
              Hesapla → Sonuç
            </button>
          </div>
        </div>
      )}

      {/* ── Adım 4: Sonuç ─────────────────────────────────────────────────── */}
      {step === 4 && (
        <div>
          {/* KPI Şeridi */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 20 }}>
            <div style={{ ...s.kpi, borderColor: "#00b87a", background: "#e6f9f2" }}>
              <div style={s.kpiL}>Actual SEE (Voltfox)</div>
              <div style={{ ...s.kpiV, color: "#009966" }}>{round(seeActual, 4).toLocaleString("tr-TR")}</div>
              <div style={s.kpiU}>tCO₂/tonne · {SECTOR_LABELS[state.sector]} · {state.cnCode}</div>
            </div>
            <div style={s.kpi}>
              <div style={s.kpiL}>CBAM Default SEE</div>
              <div style={{ ...s.kpiV, color: defaultLoading ? "#9ca3af" : "#ef4444" }}>
                {defaultLoading ? "…" : seeDefault != null ? round(seeDefault, 4).toLocaleString("tr-TR") : "—"}
              </div>
              <div style={s.kpiU}>tCO₂/tonne · {state.country} varsayılanı</div>
            </div>
            <div style={{ ...s.kpi, background: savingsEur != null && savingsEur > 0 ? "#e6f9f2" : "#fff" }}>
              <div style={s.kpiL}>Tahmini Tasarruf</div>
              <div style={{ ...s.kpiV, color: savingsEur != null && savingsEur > 0 ? "#059669" : "#9ca3af" }}>
                {savingsEur != null ? `€ ${Math.round(savingsEur).toLocaleString("tr-TR")}` : "—"}
              </div>
              <div style={s.kpiU}>@{carbonPrice} €/tCO₂eq · {state.prodVolume.toLocaleString("tr-TR")} tonne</div>
            </div>
          </div>

          {/* Karşılaştırma Tablosu */}
          <div style={s.card}>
            <div style={s.cardH}>Default vs. Actual Karşılaştırma</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
              {/* Actual */}
              <div style={{ border: "1px solid #d4ece4", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#e6f9f2", padding: "10px 14px", fontWeight: 700,
                              fontSize: 13, color: "#009966", borderBottom: "1px solid #d4ece4" }}>
                  ✓ Voltfox Actual (EU 2023/1773 Method A)
                </div>
                <div style={{ padding: "14px" }}>
                  <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                    <tbody>
                      <tr>
                        <td style={{ padding: "5px 0", color: "#5c7a72" }}>Scope 1 — Yakıt</td>
                        <td style={{ padding: "5px 0", textAlign: "right", fontWeight: 600 }}>{round(scope1Fuel, 4)} tCO₂</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "5px 0", color: "#5c7a72" }}>Scope 1 — Proses</td>
                        <td style={{ padding: "5px 0", textAlign: "right", fontWeight: 600 }}>{round(scope1Proc, 4)} tCO₂</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "5px 0", color: "#5c7a72" }}>Scope 2 — Elektrik</td>
                        <td style={{ padding: "5px 0", textAlign: "right", fontWeight: 600 }}>{round(scope2Tco2, 4)} tCO₂</td>
                      </tr>
                      <tr style={{ borderTop: "1px solid #d4ece4" }}>
                        <td style={{ padding: "8px 0 4px", fontWeight: 700 }}>Toplam</td>
                        <td style={{ padding: "8px 0 4px", textAlign: "right", fontWeight: 700 }}>{round(totalTco2, 4)} tCO₂</td>
                      </tr>
                      <tr>
                        <td style={{ padding: "4px 0", color: "#5c7a72" }}>Üretim hacmi</td>
                        <td style={{ padding: "4px 0", textAlign: "right" }}>{state.prodVolume.toLocaleString("tr-TR")} t</td>
                      </tr>
                      <tr style={{ borderTop: "1px solid #d4ece4" }}>
                        <td style={{ padding: "8px 0 0", fontWeight: 800, color: "#009966" }}>SEE Actual</td>
                        <td style={{ padding: "8px 0 0", textAlign: "right", fontWeight: 800, color: "#009966", fontSize: 15 }}>
                          {round(seeActual, 4)} tCO₂/t
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Default */}
              <div style={{ border: "1px solid #fca5a5", borderRadius: 8, overflow: "hidden" }}>
                <div style={{ background: "#fee2e2", padding: "10px 14px", fontWeight: 700,
                              fontSize: 13, color: "#991b1b", borderBottom: "1px solid #fca5a5" }}>
                  ✗ CBAM Default (Komisyon Varsayılanı)
                </div>
                <div style={{ padding: "14px" }}>
                  {defaultLoading ? (
                    <div style={{ color: "#9ca3af", fontSize: 13 }}>Yükleniyor…</div>
                  ) : seeDefault != null ? (
                    <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                      <tbody>
                        <tr>
                          <td style={{ padding: "5px 0", color: "#5c7a72" }}>Doğrudan Default</td>
                          <td style={{ padding: "5px 0", textAlign: "right" }}>{defaultResult?.directDefault ?? "—"} tCO₂/t</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "5px 0", color: "#5c7a72" }}>Dolaylı Default</td>
                          <td style={{ padding: "5px 0", textAlign: "right" }}>{defaultResult?.indirectDefault ?? "—"} tCO₂/t</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "5px 0", color: "#5c7a72" }}>Veri versiyonu</td>
                          <td style={{ padding: "5px 0", textAlign: "right" }}>{defaultResult?.dataVersion ?? "—"}</td>
                        </tr>
                        <tr style={{ borderTop: "1px solid #fca5a5" }}>
                          <td style={{ padding: "8px 0 0", fontWeight: 800, color: "#991b1b" }}>SEE Default</td>
                          <td style={{ padding: "8px 0 0", textAlign: "right", fontWeight: 800, color: "#991b1b", fontSize: 15 }}>
                            {round(seeDefault, 4)} tCO₂/t
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  ) : (
                    <div style={{ fontSize: 13, color: "#9ca3af" }}>
                      {state.country} × {state.cnCode} için varsayılan bulunamadı.
                      <br />
                      <span style={{ fontSize: 11 }}>Ülke adı ve CN kodunu kontrol edin.</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Euro Tasarruf Hesabı */}
          {savingsEur != null && savingsEur > 0 && (
            <div style={{ ...s.card, background: "#e6f9f2", borderColor: "#00b87a" }}>
              <div style={s.cardH}>Euro Tasarruf Analizi</div>
              <div style={s.grid3}>
                <div>
                  <div style={{ fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 4 }}>SEE FARKI</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#009966" }}>
                    {round(savingsPerTonne!, 4)} tCO₂/t
                  </div>
                  <div style={{ fontSize: 11, color: "#5c7a72" }}>default − actual</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 4 }}>TOPLAM CO₂ TASARRUFU</div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "#009966" }}>
                    {Math.round(savingsTotalTco2!).toLocaleString("tr-TR")} tCO₂
                  </div>
                  <div style={{ fontSize: 11, color: "#5c7a72" }}>{state.prodVolume.toLocaleString("tr-TR")} tonne × {round(savingsPerTonne!, 4)}</div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 4 }}>TAHMİNİ CBAM TASARRUFU</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#059669" }}>
                    € {Math.round(savingsEur).toLocaleString("tr-TR")}
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                    <span style={{ fontSize: 11, color: "#5c7a72" }}>Karbon fiyatı:</span>
                    <input type="number" min={0} style={{ width: 70, padding: "3px 6px", borderRadius: 5,
                      border: "1px solid #a7f3d0", fontSize: 12, background: "#fff" }}
                      value={carbonPrice}
                      onChange={e => setCarbonPrice(parseFloat(e.target.value) || 0)} />
                    <span style={{ fontSize: 11, color: "#5c7a72" }}>€/tCO₂</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Butonlar */}
          <div style={{ display: "flex", gap: 12, justifyContent: "space-between", marginTop: 4 }}>
            <button style={s.btnOut} onClick={() => setStep(3)}>← Geri</button>
            <div style={{ display: "flex", gap: 12 }}>
              <button
                style={{ ...s.btnOut, opacity: 0.65, cursor: "not-allowed" }}
                title="PDF teknik dosya export — yakında"
                disabled
              >
                PDF Teknik Dosya İndir (Yakında)
              </button>
              <Link to="/cbam" style={{ ...s.btn, textDecoration: "none", display: "inline-block", lineHeight: "1.5" }}>
                CBAM Tesislere Dön →
              </Link>
            </div>
          </div>

          {/* Metodoloji notu */}
          <div style={{ ...s.note, marginTop: 20 }}>
            <strong>Hesap Metodolojisi:</strong> EU 2023/1773 (CBAM Uygulama Tüzüğü) Ek-IV, Method A (Hesaplama Bazlı)<br />
            Yakıt EF: IPCC 2006 GL Vol.2 Table 1.4 · Proses: Stoikiometrik · Scope 2: CBAM Ek-IV Tablo 2<br />
            <strong>Dönem:</strong> {state.periodName} · <strong>Ülke:</strong> {state.country} · <strong>CN:</strong> {state.cnCode}<br />
            <strong>Uyarı:</strong> Bu hesap bilgilendirme amaçlıdır. CBAM bildirimi için akredite doğrulayıcı onayı önerilir.
          </div>
        </div>
      )}
    </div>
  );
}
