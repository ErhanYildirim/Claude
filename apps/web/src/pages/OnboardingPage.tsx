import { useState } from "react";
import { api } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { Button, Card, Input } from "../components/ui/index.js";

// ── Constants ─────────────────────────────────────────────────────────────────
const TIMEZONES = [
  "Europe/Istanbul", "Europe/Berlin", "Europe/London", "Europe/Paris",
  "Europe/Madrid", "Europe/Warsaw", "Europe/Bucharest", "Europe/Athens",
  "Europe/Amsterdam", "Europe/Brussels", "Europe/Vienna", "Europe/Zurich",
  "UTC", "America/New_York", "America/Chicago", "America/Los_Angeles",
  "Asia/Dubai", "Asia/Riyadh", "Asia/Tokyo", "Asia/Singapore",
];

const COUNTRIES: { code: string; name: string }[] = [
  { code: "TR", name: "Türkiye" },
  { code: "DE", name: "Almanya" },
  { code: "FR", name: "Fransa" },
  { code: "NL", name: "Hollanda" },
  { code: "BE", name: "Belçika" },
  { code: "PL", name: "Polonya" },
  { code: "IT", name: "İtalya" },
  { code: "ES", name: "İspanya" },
  { code: "AT", name: "Avusturya" },
  { code: "CZ", name: "Çekya" },
  { code: "SK", name: "Slovakya" },
  { code: "RO", name: "Romanya" },
  { code: "HU", name: "Macaristan" },
  { code: "HR", name: "Hırvatistan" },
  { code: "SE", name: "İsveç" },
  { code: "FI", name: "Finlandiya" },
  { code: "DK", name: "Danimarka" },
  { code: "PT", name: "Portekiz" },
  { code: "GR", name: "Yunanistan" },
  { code: "BG", name: "Bulgaristan" },
  { code: "GB", name: "Birleşik Krallık" },
  { code: "UA", name: "Ukrayna" },
  { code: "RS", name: "Sırbistan" },
  { code: "US", name: "ABD" },
  { code: "CN", name: "Çin" },
  { code: "IN", name: "Hindistan" },
];

const SECTORS = [
  { value: "steel",       label: "Çelik (Steel)" },
  { value: "aluminium",   label: "Alüminyum" },
  { value: "cement",      label: "Çimento (Cement)" },
  { value: "fertilizer",  label: "Gübre (Fertilizer)" },
  { value: "electricity", label: "Elektrik (Electricity)" },
  { value: "hydrogen",    label: "Hidrojen (Hydrogen)" },
  { value: "chemicals",   label: "Kimyasal (Chemicals)" },
];

const ROLE_OPTIONS = [
  { value: "admin",   label: "Admin — tam yönetim" },
  { value: "analyst", label: "Analyst — hesapla ve görüntüle" },
  { value: "viewer",  label: "Viewer — sadece görüntüle" },
];

// ── Styles ────────────────────────────────────────────────────────────────────
const s: Record<string, React.CSSProperties> = {
  page:    { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,var(--accent-bg) 0%,#f0f4ff 100%)" },
  logo:    { fontWeight: 900, fontSize: 20, color: "var(--accent)", marginBottom: 2, letterSpacing: "-.01em" },
  stepper: { display: "flex", gap: 0, marginBottom: 32, marginTop: 4 },
  stepDot: { flex: 1, height: 4, borderRadius: 2, transition: "background .25s" },
  stepNum: { display: "flex", alignItems: "center", gap: 10, marginBottom: 20 },
  stepTag: { display: "inline-block", padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "var(--accent-bg)", color: "var(--accent)" },
  h2:      { fontSize: 20, fontWeight: 800, color: "var(--text-primary)", marginBottom: 4 },
  sub:     { color: "var(--text-muted)", fontSize: 13, marginBottom: 24 },
  select:  { width: "100%", padding: "10px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 14, background: "var(--bg-surface)", marginBottom: 14, boxSizing: "border-box" as const, fontFamily: "inherit", cursor: "pointer" },
  row2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  btnRow:  { display: "flex", gap: 10, marginTop: 24 },
  err:     { color: "var(--danger)", fontSize: 13, marginBottom: 12, padding: "8px 12px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)" },
  skip:    { textAlign: "center" as const, marginTop: 12, fontSize: 13, color: "var(--text-muted)", cursor: "pointer", textDecoration: "underline" },
  successIcon: { fontSize: 52, textAlign: "center" as const, marginBottom: 16 },
  successH:    { fontSize: 24, fontWeight: 800, color: "var(--text-primary)", textAlign: "center" as const, marginBottom: 8 },
  successSub:  { color: "var(--text-muted)", fontSize: 14, textAlign: "center" as const, marginBottom: 24 },
  summaryCard: { background: "var(--bg-elevated)", borderRadius: "var(--radius-lg)", padding: "14px 16px", marginBottom: 12 },
  summaryRow:  { display: "flex", justifyContent: "space-between", padding: "4px 0", fontSize: 13 },
  summaryL:    { color: "var(--text-muted)" },
  summaryV:    { fontWeight: 600, color: "var(--text-primary)" },
};

const STEPS = ["Şirket", "Tesis", "Ekip", "Tamam"];

// ── Step components ───────────────────────────────────────────────────────────

interface Step1State { companyName: string; timezone: string; }
interface Step2State { facilityName: string; operator: string; facilityCountry: string; sector: string; skip: boolean; }
interface Step3State { email: string; role: string; skip: boolean; }

function Stepper({ current }: { current: number }) {
  return (
    <div style={s.stepper}>
      {STEPS.map((_, i) => (
        <div key={i} style={{
          ...s.stepDot,
          background: i <= current ? "var(--accent)" : "var(--border)",
          marginRight: i < STEPS.length - 1 ? 4 : 0,
        }} />
      ))}
    </div>
  );
}

function Step1({ onNext }: { onNext: (data: Step1State) => void }) {
  const [companyName, setCompanyName] = useState("");
  const [timezone,    setTimezone]    = useState("Europe/Istanbul");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) { setErr("Şirket adı zorunludur."); return; }
    setBusy(true); setErr("");
    try {
      const result = await api.onboarding.createTenant(companyName.trim(), timezone);
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        await supabase.functions.invoke("set-tenant-metadata", { body: { tenantId: result.tenantId } });
        await supabase.auth.refreshSession();
      }
      onNext({ companyName: companyName.trim(), timezone });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hata oluştu.");
    }
    setBusy(false);
  }

  return (
    <form onSubmit={next}>
      <div style={s.stepNum}><span style={s.stepTag}>Adım 1 / 4</span></div>
      <div style={s.h2}>Şirketinizi kurun</div>
      <div style={s.sub}>Voltfox hesabınız bu şirket altında oluşturulacak.</div>
      {err && <div style={s.err}>{err}</div>}
      <div style={{ marginBottom: 14 }}>
        <Input
          label="Şirket Adı"
          value={companyName}
          onChange={e => setCompanyName(e.target.value)}
          placeholder="Örn: Çelik A.Ş."
          required
          minLength={2}
          maxLength={100}
          autoFocus
        />
      </div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Zaman Dilimi</label>
      <select style={s.select} value={timezone} onChange={e => setTimezone(e.target.value)}>
        {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
      </select>
      <div style={s.btnRow}>
        <Button variant="primary" size="lg" type="submit" disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Oluşturuluyor..." : "Devam Et"}
        </Button>
      </div>
    </form>
  );
}

function Step2({ onNext, onBack }: { onNext: (data: Step2State) => void; onBack: () => void }) {
  const [facilityName,    setFacilityName]    = useState("");
  const [operator,        setOperator]        = useState("");
  const [facilityCountry, setFacilityCountry] = useState("TR");
  const [sector,          setSector]          = useState("steel");
  const [err, setErr]   = useState("");
  const [busy, setBusy] = useState(false);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!facilityName.trim() || !operator.trim()) { setErr("Tesis adı ve operatör zorunludur."); return; }
    setBusy(true); setErr("");
    try {
      await api.installations.create({ facilityName: facilityName.trim(), operator: operator.trim(), facilityCountry, sector });
      onNext({ facilityName: facilityName.trim(), operator: operator.trim(), facilityCountry, sector, skip: false });
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Tesis oluşturulamadı.");
    }
    setBusy(false);
  }

  function skip() {
    onNext({ facilityName: "", operator: "", facilityCountry: "TR", sector: "steel", skip: true });
  }

  return (
    <form onSubmit={next}>
      <div style={s.stepNum}><span style={s.stepTag}>Adım 2 / 4</span></div>
      <div style={s.h2}>İlk tesisi ekleyin</div>
      <div style={s.sub}>İzleme yapacağınız üretim tesisini tanımlayın. Sonradan da ekleyebilirsiniz.</div>
      {err && <div style={s.err}>{err}</div>}
      <div style={{ marginBottom: 14 }}>
        <Input
          label="Tesis Adı"
          value={facilityName}
          onChange={e => setFacilityName(e.target.value)}
          placeholder="Örn: İzmir Çelik Fabrikası"
          autoFocus
        />
      </div>
      <div style={{ marginBottom: 14 }}>
        <Input
          label="Operatör / İşletmeci"
          value={operator}
          onChange={e => setOperator(e.target.value)}
          placeholder="Örn: Demir Çelik A.Ş."
        />
      </div>
      <div style={s.row2}>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Ülke</label>
          <select style={s.select} value={facilityCountry} onChange={e => setFacilityCountry(e.target.value)}>
            {COUNTRIES.map(c => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Sektör</label>
          <select style={s.select} value={sector} onChange={e => setSector(e.target.value)}>
            {SECTORS.map(sec => <option key={sec.value} value={sec.value}>{sec.label}</option>)}
          </select>
        </div>
      </div>
      <div style={s.btnRow}>
        <Button variant="ghost" type="button" onClick={onBack}>Geri</Button>
        <Button variant="primary" size="lg" type="submit" disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Ekleniyor..." : "Tesisi Ekle"}
        </Button>
      </div>
      <div style={s.skip} onClick={skip}>Şimdilik atla, sonra eklerim</div>
    </form>
  );
}

function Step3({ onNext, onBack }: { onNext: (data: Step3State) => void; onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [role,  setRole]  = useState("analyst");
  const [err, setErr]     = useState("");
  const [busy, setBusy]   = useState(false);

  async function next(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) { setErr("E-posta adresi zorunludur."); return; }
    setBusy(true); setErr("");
    try {
      await api.members.invite({ email: email.trim(), role });
      onNext({ email: email.trim(), role, skip: false });
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : "Davet gönderilemedi.");
    }
    setBusy(false);
  }

  function skip() {
    onNext({ email: "", role: "viewer", skip: true });
  }

  return (
    <form onSubmit={next}>
      <div style={s.stepNum}><span style={s.stepTag}>Adım 3 / 4</span></div>
      <div style={s.h2}>Ekibinizi davet edin</div>
      <div style={s.sub}>İlk takım arkadaşınıza davet bağlantısı gönderin. Daha fazlasını Ayarlar'dan ekleyebilirsiniz.</div>
      {err && <div style={s.err}>{err}</div>}
      <div style={{ marginBottom: 14 }}>
        <Input
          label="E-posta Adresi"
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="ornek@sirket.com"
          autoFocus
        />
      </div>
      <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", marginBottom: 5, textTransform: "uppercase", letterSpacing: ".05em" }}>Rol</label>
      <select style={s.select} value={role} onChange={e => setRole(e.target.value)}>
        {ROLE_OPTIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
      </select>
      <div style={s.btnRow}>
        <Button variant="ghost" type="button" onClick={onBack}>Geri</Button>
        <Button variant="primary" size="lg" type="submit" disabled={busy} style={{ flex: 1, opacity: busy ? 0.7 : 1 }}>
          {busy ? "Gönderiliyor..." : "Davet Gönder"}
        </Button>
      </div>
      <div style={s.skip} onClick={skip}>Atla, ekibi sonra davet ederim</div>
    </form>
  );
}

function Step4({ step1, step2, step3 }: { step1: Step1State; step2: Step2State; step3: Step3State }) {
  return (
    <div>
      <div style={s.stepNum}><span style={s.stepTag}>Tamamlandı!</span></div>
      <div style={s.successIcon}>🎉</div>
      <div style={s.successH}>Hazırsınız!</div>
      <div style={s.successSub}>Voltfox hesabınız başarıyla kuruldu. Emisyon izlemeye hemen başlayabilirsiniz.</div>

      <div style={s.summaryCard}>
        <div style={s.summaryRow}>
          <span style={s.summaryL}>Şirket</span>
          <span style={s.summaryV}>{step1.companyName}</span>
        </div>
        <div style={s.summaryRow}>
          <span style={s.summaryL}>Zaman dilimi</span>
          <span style={s.summaryV}>{step1.timezone}</span>
        </div>
        {!step2.skip && (
          <div style={s.summaryRow}>
            <span style={s.summaryL}>İlk tesis</span>
            <span style={s.summaryV}>{step2.facilityName}</span>
          </div>
        )}
        {!step3.skip && (
          <div style={s.summaryRow}>
            <span style={s.summaryL}>Davet gönderildi</span>
            <span style={s.summaryV}>{step3.email}</span>
          </div>
        )}
      </div>

      <Button variant="primary" size="lg" onClick={() => { window.location.href = "/"; }} style={{ width: "100%" }}>
        Platforma Git
      </Button>
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────
export default function OnboardingPage() {
  const [step,  setStep]  = useState(0);
  const [s1,    setS1]    = useState<Step1State>({ companyName: "", timezone: "Europe/Istanbul" });
  const [s2,    setS2]    = useState<Step2State>({ facilityName: "", operator: "", facilityCountry: "TR", sector: "steel", skip: false });
  const [s3,    setS3]    = useState<Step3State>({ email: "", role: "analyst", skip: false });

  return (
    <div style={s.page}>
      <Card style={{ padding: "40px 40px 32px", width: 480, boxShadow: "var(--shadow-md)", position: "relative" }}>
        <div style={s.logo}>Voltfox</div>
        <Stepper current={step} />

        {step === 0 && <Step1 onNext={data => { setS1(data); setStep(1); }} />}
        {step === 1 && <Step2 onNext={data => { setS2(data); setStep(2); }} onBack={() => setStep(0)} />}
        {step === 2 && <Step3 onNext={data => { setS3(data); setStep(3); }} onBack={() => setStep(1)} />}
        {step === 3 && <Step4 step1={s1} step2={s2} step3={s3} />}
      </Card>
    </div>
  );
}
