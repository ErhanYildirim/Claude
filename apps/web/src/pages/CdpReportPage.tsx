import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";
import type { Installation, InstallationDetail, Period, EmbeddedEmission, CFEResult } from "../lib/api.js";
import { fmt } from "../lib/chart-utils.js";

// ── Styles ─────────────────────────────────────────────────────────────────
const S: Record<string, React.CSSProperties> = {
  wrap:    { display: "flex", minHeight: "100vh", background: "#f4fbf8" },
  sidebar: { width: 220, background: "#fff", borderRight: "1px solid #d4ece4",
             padding: "24px 0", position: "sticky" as const, top: 0, height: "100vh",
             overflowY: "auto" as const, flexShrink: 0 },
  sideH:   { fontSize: 11, fontWeight: 700, color: "#5c7a72", textTransform: "uppercase" as const,
             letterSpacing: ".08em", padding: "0 16px 6px" },
  sideItem:{ display: "block", padding: "8px 16px", fontSize: 13, cursor: "pointer",
             color: "#5c7a72", textDecoration: "none", borderLeft: "3px solid transparent",
             transition: "all .12s", background: "none", border: "none", textAlign: "left" as const,
             width: "100%", fontFamily: "inherit" },
  main:    { flex: 1, padding: "32px 36px", maxWidth: 820 },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  selRow:  { display: "flex", gap: 12, flexWrap: "wrap" as const, marginBottom: 24, alignItems: "flex-end" },
  selLbl:  { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  select:  { padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB",
             fontSize: 14, background: "#fff", minWidth: 200 },
  section: { background: "#fff", border: "1px solid #d4ece4", borderRadius: 10,
             marginBottom: 20, overflow: "hidden" },
  secHead: { background: "#f0faf5", padding: "14px 20px", borderBottom: "1px solid #d4ece4",
             display: "flex", justifyContent: "space-between", alignItems: "center" },
  secCode: { fontSize: 12, fontWeight: 700, color: "#059669", fontFamily: "monospace",
             background: "#d1fae5", padding: "2px 8px", borderRadius: 4 },
  secTitle:{ fontSize: 15, fontWeight: 700, color: "#0a1f1a" },
  secBody: { padding: "16px 20px" },
  q:       { marginBottom: 18 },
  qNum:    { fontSize: 12, fontWeight: 700, color: "#059669", marginBottom: 3, fontFamily: "monospace" },
  qText:   { fontSize: 13, color: "#374151", marginBottom: 6, fontWeight: 500 },
  qSub:    { fontSize: 12, color: "#5c7a72", marginBottom: 8, fontStyle: "italic" },
  inp:     { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB",
             fontSize: 13, fontFamily: "inherit", resize: "vertical" as const,
             boxSizing: "border-box" as const },
  autoInp: { width: "100%", padding: "8px 10px", borderRadius: 6,
             border: "1px solid #6ee7b7", fontSize: 13, background: "#f0fdf4",
             boxSizing: "border-box" as const, color: "#065f46", fontWeight: 600 },
  autoNote:{ fontSize: 11, color: "#059669", marginTop: 3 },
  numRow:  { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  numLbl:  { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  divider: { height: 1, background: "#eef7f3", margin: "14px 0" },
  btn:     { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer",
             fontWeight: 600, fontSize: 14, background: "#059669", color: "#fff",
             transition: "background .12s" },
  btnSec:  { padding: "9px 18px", borderRadius: 8, border: "1px solid #059669",
             cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#fff",
             color: "#059669" },
  toolbar: { display: "flex", gap: 10, marginBottom: 24, flexWrap: "wrap" as const },
  badge:   { display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11,
             fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "#d1fae5",
             color: "#065f46" },
  warn:    { background: "#FFFBEB", border: "1px solid #FDE68A", borderRadius: 8,
             padding: "12px 14px", fontSize: 13, color: "#92400E", marginBottom: 16 },
  progress:{ height: 6, borderRadius: 3, background: "#d4ece4", marginTop: 8 },
  progBar: { height: "100%", borderRadius: 3, background: "#059669", transition: "width .3s" },
};

// ── CDP Section definitions ─────────────────────────────────────────────────
interface Question {
  id: string;
  num: string;
  text: string;
  sub?: string;
  type: "text" | "textarea" | "number" | "select" | "auto";
  options?: string[];
  autoKey?: string;
  autoFmt?: (v: number) => string;
  rows?: number;
  unit?: string;
}
interface CdpSection {
  code: string;
  title: string;
  questions: Question[];
}

function buildSections(em: EmbeddedEmission | null, period: Period | null, inst: InstallationDetail | null, cfe: CFEResult | null): CdpSection[] {
  const year = period?.reportYear ?? new Date().getFullYear();
  const mwh  = (period?.electricityKwh ?? 0) / 1000;

  return [
    {
      code: "C0", title: "Giriş",
      questions: [
        { id: "c0_org",      num: "C0.1", text: "Kuruluş adı",           type: "auto",   autoKey: "org",     autoFmt: () => inst?.facilityName ?? "" },
        { id: "c0_country",  num: "C0.2", text: "Faaliyet ülkesi",        type: "auto",   autoKey: "country", autoFmt: () => inst?.facilityCountry ?? "" },
        { id: "c0_sector",   num: "C0.3", text: "Sektör",                  type: "auto",   autoKey: "sector",  autoFmt: () => inst?.sector ?? "" },
        { id: "c0_year",     num: "C0.4", text: "Raporlama yılı",          type: "auto",   autoKey: "year",    autoFmt: () => String(year) },
        { id: "c0_contact",  num: "C0.5", text: "CDP irtibat kişisi adı ve ünvanı", type: "text",   sub: "Sürdürülebilirlik sorumlusu" },
        { id: "c0_email",    num: "C0.6", text: "İrtibat e-posta adresi",  type: "text" },
      ],
    },
    {
      code: "C1", title: "Yönetim",
      questions: [
        { id: "c1_board",    num: "C1.1", text: "Yönetim kurulunun iklim değişikliği konusundaki rolü nedir?",
          type: "textarea", rows: 3,
          sub: "Yönetim kurulunun iklim değişikliği risklerini nasıl denetlediğini açıklayın." },
        { id: "c1_mgmt",     num: "C1.2", text: "İklim değişikliği konusunda üst yönetim düzeyindeki sorumluluk ve hesap verebilirlik",
          type: "textarea", rows: 3 },
        { id: "c1_incentive",num: "C1.3", text: "İklim ile ilgili hedeflere bağlı yönetici teşvik mekanizması var mı?",
          type: "select", options: ["Evet", "Hayır", "Geliştirilme aşamasında"] },
      ],
    },
    {
      code: "C2", title: "Risk ve Fırsatlar",
      questions: [
        { id: "c2_process",  num: "C2.1", text: "İklim değişikliği risk ve fırsatlarının yönetim süreçleri açıklaması",
          type: "textarea", rows: 3,
          sub: "Temel risk kategorileri: geçiş riskleri (politika, pazar, teknoloji) ve fiziksel riskler (akut, kronik)." },
        { id: "c2_trans",    num: "C2.2", text: "Tanımlanan ana geçiş riskleri (karbon fiyatı, düzenleme, talep kayması vb.)",
          type: "textarea", rows: 3 },
        { id: "c2_phys",     num: "C2.3", text: "Tanımlanan ana fiziksel riskler (aşırı hava, su stresi vb.)",
          type: "textarea", rows: 3 },
        { id: "c2_opp",      num: "C2.4", text: "Tanımlanan iklim fırsatları (enerji verimliliği, yenilenebilir enerji vb.)",
          type: "textarea", rows: 3 },
      ],
    },
    {
      code: "C3", title: "İş Stratejisi",
      questions: [
        { id: "c3_strategy", num: "C3.1", text: "İklim değişikliği iş stratejisine entegre edildi mi?",
          type: "select", options: ["Evet", "Hayır", "Kısmen"] },
        { id: "c3_desc",     num: "C3.2", text: "İklim stratejisi açıklaması",
          type: "textarea", rows: 4,
          sub: "Hangi senaryolar değerlendirildi? 1.5°C veya 2°C senaryosu kullanılıyor mu?" },
        { id: "c3_capex",    num: "C3.3", text: "Düşük karbonlu yatırımlar ve iklim fırsatlarına ayrılan CAPEX (TL/EUR)",
          type: "number", unit: "EUR" },
      ],
    },
    {
      code: "C4", title: "Hedefler ve Performans",
      questions: [
        { id: "c4_target",   num: "C4.1", text: "Scope 1 veya Scope 2 emisyon azaltım hedefi var mı?",
          type: "select", options: ["Evet, mutlak hedef", "Evet, yoğunluk hedefi", "Hayır"] },
        { id: "c4_base",     num: "C4.2", text: "Baz yıl ve baz yıl emisyonu",
          type: "text", sub: "Örn: 2019, 15 000 tCO₂" },
        { id: "c4_target_y", num: "C4.3", text: "Hedef yıl ve hedeflenen azaltım yüzdesi",
          type: "text", sub: "Örn: 2030, -%50" },
        { id: "c4_sbti",     num: "C4.4", text: "SBTi (Science Based Targets initiative) taahhüdü",
          type: "select", options: ["Taahhüt verildi, hedef onaylandı", "Taahhüt verildi, onay sürecinde", "Taahhüt yoktur"] },
      ],
    },
    {
      code: "C5", title: "Emisyon Metodolojisi",
      questions: [
        { id: "c5_method",   num: "C5.1", text: "Scope 1 ve Scope 2 emisyon hesaplama metodolojisi",
          type: "auto", autoKey: "method", autoFmt: () => "GHG Protokolü Kurumsal Muhasebe ve Raporlama Standardı" },
        { id: "c5_cons",     num: "C5.2", text: "Kapsam ve konsolidasyon yaklaşımı",
          type: "select", options: ["Operasyonel kontrol", "Finansal kontrol", "Öz sermaye payı"] },
        { id: "c5_scope2m",  num: "C5.3", text: "Kullanılan Scope 2 metodolojisi",
          type: "auto", autoKey: "s2method", autoFmt: () => "Hem konum bazlı hem pazar bazlı hesaplama — 24/7 saatlik CFE eşleştirmesi" },
        { id: "c5_efver",    num: "C5.4", text: "Kullanılan emisyon faktörü veri seti ve versiyonu",
          type: "auto", autoKey: "efver",   autoFmt: () => em?.efDataVersion ?? "EU 2023/1773" },
      ],
    },
    {
      code: "C6", title: "Emisyon Verisi",
      questions: [
        { id: "c6_s1",       num: "C6.1", text: "Scope 1 toplam emisyon (tCO₂e)", type: "number", unit: "tCO₂e",
          sub: "Yakıt yakma, proses emisyonları vb. — bu rapor Scope 2 odaklıdır" },
        { id: "c6_s2_loc",   num: "C6.3", text: "Scope 2 konum bazlı (tCO₂e)",
          type: "auto", unit: "tCO₂e",
          autoKey: "s2loc", autoFmt: v => fmt(v, 2),
          sub: "Ulusal ağ ortalama emisyon faktörü kullanılarak hesaplanmıştır." },
        { id: "c6_s2_mkt",   num: "C6.5", text: "Scope 2 pazar bazlı (tCO₂e)",
          type: "auto", unit: "tCO₂e",
          autoKey: "s2mkt", autoFmt: v => fmt(v, 2),
          sub: "24/7 saatlik CFE eşleştirmesi ile hesaplanmıştır." },
        { id: "c6_reduction",num: "C6.6", text: "Pazar bazlı Scope 2 azaltımı (tCO₂e)",
          type: "auto", unit: "tCO₂e",
          autoKey: "reduct", autoFmt: v => fmt(v, 2) },
        { id: "c6_s3",       num: "C6.10", text: "Scope 3 toplam emisyon (tCO₂e) — varsa",
          type: "number", unit: "tCO₂e",
          sub: "Kategori 3: Enerji ile ilgili faaliyetler dahil edilebilir" },
      ],
    },
    {
      code: "C8", title: "Enerji",
      questions: [
        { id: "c8_cons",     num: "C8.1", text: "Toplam elektrik tüketimi (MWh)",
          type: "auto", unit: "MWh",
          autoKey: "elecmwh", autoFmt: v => fmt(v, 1) },
        { id: "c8_renew",    num: "C8.2", text: "Yenilenebilir elektrik oranı (%)",
          type: "auto", unit: "%",
          autoKey: "cfe",    autoFmt: v => fmt(v, 1) },
        { id: "c8_eac",      num: "C8.3", text: "Satın alınan EAC/I-REC/PPA miktarı (MWh)",
          type: "number", unit: "MWh" },
        { id: "c8_source",   num: "C8.4", text: "Yenilenebilir enerji temin yöntemi",
          type: "select",
          options: ["PPA (Güç Alım Anlaşması)", "Piyasa bazlı sözleşme", "EAC/I-REC satın alma", "Yerinde üretim (güneş/rüzgar)", "Yeşil tarife"] },
      ],
    },
    {
      code: "C10", title: "Doğrulama",
      questions: [
        { id: "c10_ver",     num: "C10.1", text: "Scope 2 verisi bağımsız doğrulamaya tabi tutuldu mu?",
          type: "select", options: ["Evet, makul güvence", "Evet, sınırlı güvence", "Hayır", "Planlanıyor"] },
        { id: "c10_body",    num: "C10.2", text: "Doğrulama kuruluşu (varsa)",
          type: "text", sub: "Örn: Bureau Veritas, SGS, DNV vb." },
        { id: "c10_std",     num: "C10.3", text: "Doğrulama standardı",
          type: "text", sub: "Örn: ISO 14064-3, ISAE 3410" },
      ],
    },
    {
      code: "C11", title: "Karbon Fiyatlandırma",
      questions: [
        { id: "c11_ets",     num: "C11.1", text: "AB ETS kapsamına giriyor musunuz?",
          type: "select", options: ["Evet, doğrudan", "Hayır", "CBAM kapsamında dolaylı etki"] },
        { id: "c11_cbam",    num: "C11.2", text: "CBAM yükümlülüğü var mı?",
          type: "select", options: ["Evet, ihracatçı olarak", "Evet, ithalatçı olarak", "Hayır"] },
        { id: "c11_intcarb", num: "C11.3", text: "Dahili karbon fiyatlandırması uygulanıyor mu?",
          type: "select", options: ["Evet", "Hayır", "Değerlendirme aşamasında"] },
        { id: "c11_price",   num: "C11.4", text: "Kullanılan dahili karbon fiyatı (EUR/tCO₂e)",
          type: "number", unit: "EUR/tCO₂e" },
      ],
    },
    {
      code: "C12", title: "Katılım",
      questions: [
        { id: "c12_tedarik", num: "C12.1", text: "Tedarik zinciriyle emisyon azaltımı konusunda çalışıyor musunuz?",
          type: "select", options: ["Evet", "Hayır", "Planlıyoruz"] },
        { id: "c12_policy",  num: "C12.2", text: "İklim politikası katılımı (lobicilik, sektör dernekleri vb.)",
          type: "textarea", rows: 3 },
        { id: "c12_comm",    num: "C12.3", text: "Paydaş ve kamuoyu iletişim faaliyetleri",
          type: "textarea", rows: 3 },
      ],
    },
  ];
}

// ── Auto-populated values ───────────────────────────────────────────────────
function buildAutoValues(em: EmbeddedEmission | null, period: Period | null, inst: InstallationDetail | null, cfe: CFEResult | null) {
  const mwh = (period?.electricityKwh ?? 0) / 1000;
  return {
    org:      inst?.facilityName ?? "",
    country:  inst?.facilityCountry ?? "",
    sector:   inst?.sector ?? "",
    year:     String(period?.reportYear ?? ""),
    method:   "GHG Protokolü Kurumsal Muhasebe ve Raporlama Standardı",
    s2method: "Hem konum bazlı hem pazar bazlı — 24/7 saatlik CFE eşleştirmesi (Voltfox GEC Engine)",
    efver:    em?.efDataVersion ?? "EU 2023/1773",
    s2loc:    em?.scope2BaselineTco2 ?? 0,
    s2mkt:    em?.scope2VoltfoxTco2  ?? 0,
    reduct:   em?.reductionTco2      ?? 0,
    elecmwh:  mwh,
    cfe:      cfe?.cfeScore ?? 0,
  };
}

function countAnswered(questions: Question[], answers: Record<string, string>, autoValues: Record<string, unknown>): number {
  return questions.filter(q => {
    if (q.type === "auto") return !!autoValues[q.autoKey ?? ""];
    return !!answers[q.id]?.trim();
  }).length;
}

export default function CdpReportPage() {
  const [installations, setInstallations]   = useState<Installation[]>([]);
  const [instDetail, setInstDetail]         = useState<InstallationDetail | null>(null);
  const [selectedInstId, setSelectedInstId] = useState("");
  const [selectedPeriodId, setSelectedPeriodId] = useState("");
  const [emission, setEmission]             = useState<EmbeddedEmission | null>(null);
  const [cfe, setCfe]                       = useState<CFEResult | null>(null);
  const [loading, setLoading]               = useState(false);
  const [answers, setAnswers]               = useState<Record<string, string>>({});
  const [activeSection, setActiveSection]   = useState("C0");

  useEffect(() => { api.installations.list().then(setInstallations).catch(() => {}); }, []);

  useEffect(() => {
    if (!selectedInstId) return;
    api.installations.get(selectedInstId).then(d => {
      setInstDetail(d); setSelectedPeriodId(""); setEmission(null); setCfe(null);
    }).catch(() => {});
  }, [selectedInstId]);

  useEffect(() => {
    if (!selectedInstId || !selectedPeriodId) return;
    setLoading(true);
    Promise.all([
      api.periods.getResult(selectedInstId, selectedPeriodId).catch(() => null),
      api.cfe.get(selectedInstId, selectedPeriodId).catch(() => null),
    ]).then(([e, c]) => { setEmission(e); setCfe(c); setLoading(false); });
  }, [selectedInstId, selectedPeriodId]);

  const period    = instDetail?.periods.find(p => p.id === selectedPeriodId) ?? null;
  const sections  = buildSections(emission, period, instDetail, cfe);
  const autoVals  = buildAutoValues(emission, period, instDetail, cfe);

  const setAnswer = useCallback((id: string, val: string) => {
    setAnswers(prev => ({ ...prev, [id]: val }));
  }, []);

  const totalQ    = sections.reduce((s, sec) => s + sec.questions.length, 0);
  const totalAns  = sections.reduce((s, sec) => s + countAnswered(sec.questions, answers, autoVals), 0);
  const pct       = totalQ ? Math.round((totalAns / totalQ) * 100) : 0;

  function getAutoDisplay(q: Question): string {
    if (!q.autoKey || !q.autoFmt) return "";
    const v = autoVals[q.autoKey as keyof typeof autoVals];
    return typeof v === "number" ? q.autoFmt(v) : String(v ?? "");
  }

  function exportJson() {
    const out: Record<string, unknown> = { meta: { generated: new Date().toISOString(), version: `CDP-${new Date().getFullYear()}` } };
    sections.forEach(sec => {
      out[sec.code] = {};
      sec.questions.forEach(q => {
        (out[sec.code] as Record<string, string>)[q.num] =
          q.type === "auto" ? getAutoDisplay(q) : (answers[q.id] ?? "");
      });
    });
    const blob = new Blob([JSON.stringify(out, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `CDP_${autoVals.org || "organization"}_${autoVals.year}.json`;
    a.click();
  }

  function exportText() {
    const lines: string[] = [`CDP İKLİM DEĞİŞİKLİĞİ RAPORU\n${"=".repeat(40)}`];
    sections.forEach(sec => {
      lines.push(`\n${sec.code} — ${sec.title}\n${"-".repeat(30)}`);
      sec.questions.forEach(q => {
        const val = q.type === "auto" ? getAutoDisplay(q) : (answers[q.id] ?? "(boş)");
        lines.push(`${q.num}. ${q.text}\n   ${val} ${q.unit ?? ""}`);
      });
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `CDP_${autoVals.org || "organization"}_${autoVals.year}.txt`;
    a.click();
  }

  return (
    <div style={S.wrap}>
      {/* Left nav */}
      <aside style={S.sidebar}>
        <div style={{ padding: "0 16px 14px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1f1a", marginBottom: 6 }}>
            CDP İklim Raporu
          </div>
          <div style={{ fontSize: 11, color: "#5c7a72", marginBottom: 10 }}>
            {totalAns}/{totalQ} soru dolduruldu
          </div>
          <div style={S.progress}>
            <div style={{ ...S.progBar, width: `${pct}%` }} />
          </div>
        </div>
        <div style={{ ...S.sideH, marginTop: 12 }}>Bölümler</div>
        {sections.map(sec => {
          const filled  = countAnswered(sec.questions, answers, autoVals);
          const isActive = sec.code === activeSection;
          return (
            <button
              key={sec.code}
              style={{
                ...S.sideItem,
                ...(isActive ? {
                  color: "#059669", fontWeight: 700,
                  borderLeft: "3px solid #059669",
                  background: "#f0fdf4",
                } : {}),
              }}
              onClick={() => {
                setActiveSection(sec.code);
                document.getElementById(`sec-${sec.code}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              <span style={{ fontFamily: "monospace", marginRight: 6, fontSize: 11 }}>{sec.code}</span>
              {sec.title}
              <span style={{ marginLeft: 4, fontSize: 10, color: "#5c7a72" }}>
                {filled}/{sec.questions.length}
              </span>
            </button>
          );
        })}
      </aside>

      {/* Main content */}
      <main style={S.main}>
        <div style={S.h1}>CDP İklim Değişikliği Raporu</div>
        <div style={S.sub}>CDP Scope 2 Rehberi uyumlu — soru bazlı veri doldurma ve dışa aktarma</div>

        {/* Selector row */}
        <div style={S.selRow}>
          <div>
            <div style={S.selLbl}>Tesis</div>
            <select style={S.select} value={selectedInstId} onChange={e => setSelectedInstId(e.target.value)}>
              <option value="">— Tesis Seçin —</option>
              {installations.map(i => <option key={i.id} value={i.id}>{i.facilityName}</option>)}
            </select>
          </div>
          <div>
            <div style={S.selLbl}>Raporlama Dönemi</div>
            <select style={S.select} value={selectedPeriodId}
              onChange={e => setSelectedPeriodId(e.target.value)} disabled={!instDetail}>
              <option value="">— Dönem Seçin —</option>
              {instDetail?.periods.map(p => <option key={p.id} value={p.id}>{p.periodName}</option>)}
            </select>
          </div>
        </div>

        {loading && <div style={{ color: "#5c7a72", fontSize: 14, marginBottom: 16 }}>Hesaplama verisi yükleniyor...</div>}

        {selectedInstId && !selectedPeriodId && !loading && (
          <div style={S.warn}>Raporlanacak dönemi seçin. Seçim yapıldıktan sonra Scope 2 verileri otomatik doldurulur.</div>
        )}

        {period && !emission && !loading && (
          <div style={S.warn}>Bu dönem için henüz hesaplama yok. Dönem detayında "SEE Hesapla" butonuna basın.</div>
        )}

        {/* Toolbar */}
        <div style={S.toolbar}>
          <button style={S.btn} onClick={exportJson}>JSON İndir</button>
          <button style={S.btnSec} onClick={exportText}>TXT İndir</button>
          <button style={S.btnSec} onClick={() => window.print()}>Yazdır / PDF</button>
          {emission && (
            <span style={S.badge}>Scope 2 verisi otomatik dolduruldu</span>
          )}
        </div>

        {/* Sections */}
        {sections.map(sec => (
          <div key={sec.code} id={`sec-${sec.code}`} style={S.section}>
            <div style={S.secHead}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={S.secCode}>{sec.code}</span>
                <span style={S.secTitle}>{sec.title}</span>
              </div>
              <span style={{ fontSize: 12, color: "#5c7a72" }}>
                {countAnswered(sec.questions, answers, autoVals)}/{sec.questions.length} soru
              </span>
            </div>
            <div style={S.secBody}>
              {sec.questions.map((q, qi) => (
                <div key={q.id} style={S.q}>
                  <div style={S.qNum}>{q.num}</div>
                  <div style={S.qText}>{q.text}{q.unit ? <span style={{ fontSize: 11, color: "#5c7a72", marginLeft: 4 }}>({q.unit})</span> : null}</div>
                  {q.sub && <div style={S.qSub}>{q.sub}</div>}

                  {q.type === "auto" ? (
                    <>
                      <input
                        readOnly
                        style={S.autoInp}
                        value={getAutoDisplay(q)}
                      />
                      <div style={S.autoNote}>Otomatik dolduruldu — Voltfox hesaplama motorundan</div>
                    </>
                  ) : q.type === "textarea" ? (
                    <textarea
                      style={{ ...S.inp, minHeight: 72 * (q.rows ?? 3) / 3 }}
                      rows={q.rows ?? 3}
                      placeholder="Yanıtınızı buraya yazın..."
                      value={answers[q.id] ?? ""}
                      onChange={e => setAnswer(q.id, e.target.value)}
                    />
                  ) : q.type === "select" ? (
                    <select
                      style={{ ...S.inp, appearance: "auto" as unknown as undefined }}
                      value={answers[q.id] ?? ""}
                      onChange={e => setAnswer(q.id, e.target.value)}
                    >
                      <option value="">— Seçin —</option>
                      {(q.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                    </select>
                  ) : (
                    <input
                      type={q.type === "number" ? "number" : "text"}
                      style={S.inp}
                      placeholder={q.type === "number" ? "0" : "Yanıtınızı buraya yazın..."}
                      value={answers[q.id] ?? ""}
                      onChange={e => setAnswer(q.id, e.target.value)}
                    />
                  )}

                  {qi < sec.questions.length - 1 && <div style={S.divider} />}
                </div>
              ))}
            </div>
          </div>
        ))}

        <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 24, paddingBottom: 32 }}>
          Bu CDP raporu şablonu bilgi amaçlıdır. Resmi CDP sunumu için akredite doğrulayıcı incelemesi gereklidir.
          Voltfox Scope 2 verileri EU 2023/1773 metodolojisi ile hesaplanmıştır.
        </div>
      </main>
    </div>
  );
}
