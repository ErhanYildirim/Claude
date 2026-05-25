import { useState, useEffect } from "react";
import { api } from "../lib/api.js";

/* ── Types ──────────────────────────────────────────────────────────────── */
type IntegrationStatus = "connected" | "disconnected" | "error" | "coming_soon" | "beta";
type IntegrationCategory =
  | "Tümü"
  | "Emisyon Faktörü"
  | "Yenilenebilir Enerji"
  | "CBAM"
  | "Raporlama"
  | "Sertifika"
  | "Piyasa Verisi";

interface ConfigField {
  key: string;
  label: string;
  type: "text" | "password" | "textarea" | "select";
  placeholder?: string;
  hint?: string;
  options?: string[];
  required?: boolean;
}

interface IntegrationDef {
  key: string;
  name: string;
  shortName: string;
  description: string;
  longDescription: string;
  category: Exclude<IntegrationCategory, "Tümü">;
  icon: string;
  color: string;
  defaultStatus: IntegrationStatus;
  configFields: ConfigField[];
  docsUrl?: string;
  testable?: boolean;
}

interface IntegrationState {
  status: IntegrationStatus;
  config: Record<string, string>;
  lastTestedAt?: string;
  testMessage?: string;
}

/* ── Integration definitions ─────────────────────────────────────────────── */
const INTEGRATIONS: IntegrationDef[] = [
  {
    key: "entso-e",
    name: "ENTSO-E Transparency Platform",
    shortName: "ENTSO-E",
    description: "Avrupa şebekelerinden saatlik emisyon faktörü verisi",
    longDescription:
      "ENTSO-E Transparency Platform, Avrupa'daki 63+ şebeke bölgesi için gerçek zamanlı ve tarihsel elektrik üretim karışımı ve emisyon faktörü verisi sunar. Voltfox bu veriyi saatlik granüler hesaplamalar için kullanır.",
    category: "Emisyon Faktörü",
    icon: "⚡",
    color: "#2563eb",
    defaultStatus: "beta",
    testable: true,
    configFields: [
      {
        key: "apiToken",
        label: "API Token",
        type: "password",
        placeholder: "ENTSO-E hesabınızdan alınan token",
        hint: "transparency.entsoe.eu → My Account → Security Token",
        required: true,
      },
      {
        key: "defaultZone",
        label: "Varsayılan Şebeke Bölgesi",
        type: "text",
        placeholder: "örn. TR, DE, FR",
        hint: "Birden fazla bölge için virgülle ayırın",
      },
    ],
  },
  {
    key: "epias",
    name: "EPIAŞ Şeffaflık Platformu",
    shortName: "EPIAŞ",
    description: "Türkiye'den yenilenebilir enerji üretim verisi",
    longDescription:
      "Enerji Piyasaları İşletme A.Ş. (EPIAŞ) Şeffaflık Platformu, Türkiye elektrik piyasasındaki santral bazlı üretim verilerine erişim sağlar. Green Assets modülünde üretim verilerini otomatik senkronize etmek için kullanılır.",
    category: "Yenilenebilir Enerji",
    icon: "🔋",
    color: "#059669",
    defaultStatus: "beta",
    testable: true,
    configFields: [
      {
        key: "username",
        label: "Kullanıcı Adı",
        type: "text",
        placeholder: "EPIAŞ hesap kullanıcı adı",
        required: true,
      },
      {
        key: "password",
        label: "Şifre",
        type: "password",
        placeholder: "EPIAŞ hesap şifresi",
        required: true,
      },
      {
        key: "plantCodes",
        label: "Santral Kodları",
        type: "textarea",
        placeholder: "Her satıra bir kod veya virgülle ayırın\nörn. TR-RES-001, TR-GES-002",
        hint: "Boş bırakırsanız hesabınızdaki tüm santraller senkronize edilir",
      },
      {
        key: "syncFrequency",
        label: "Senkronizasyon Sıklığı",
        type: "select",
        options: ["Saatlik", "4 Saatlik", "Günlük"],
      },
    ],
  },
  {
    key: "cbam-terminal",
    name: "CBAM Terminal",
    shortName: "CBAM Terminal",
    description: "AB CBAM kayıt sistemine otomatik beyan gönderimi",
    longDescription:
      "Avrupa Komisyonu'nun CBAM Kayıt Sistemi ile doğrudan entegrasyon. İthalatçı beyanlarını XML formatında otomatik oluşturup ileterek manuel CBAM portalı işlemlerini ortadan kaldırır.",
    category: "CBAM",
    icon: "🏛️",
    color: "#7c3aed",
    defaultStatus: "disconnected",
    testable: true,
    configFields: [
      {
        key: "eoriNumber",
        label: "EORI Numarası",
        type: "text",
        placeholder: "örn. DE123456789",
        hint: "Avrupa Birliği İthalatçı Kimlik Numarası",
        required: true,
      },
      {
        key: "clientId",
        label: "Client ID",
        type: "text",
        placeholder: "AB CBAM portalından alınan Client ID",
        required: true,
      },
      {
        key: "clientSecret",
        label: "Client Secret",
        type: "password",
        placeholder: "AB CBAM portalından alınan Client Secret",
        required: true,
      },
      {
        key: "environment",
        label: "Ortam",
        type: "select",
        options: ["Üretim (Production)", "Test (Sandbox)"],
      },
    ],
  },
  {
    key: "cdp-terminal",
    name: "CDP Disclosure Platform",
    shortName: "CDP",
    description: "CDP iklim açıklama platformuna emisyon verisi gönderimi",
    longDescription:
      "CDP (Carbon Disclosure Project) açıklama platformuyla entegrasyon. Scope 1, 2, 3 emisyon verilerini doğrudan CDP anket formatına dönüştürüp otomatik göndererek yıllık açıklama sürecini hızlandırır.",
    category: "Raporlama",
    icon: "📊",
    color: "#0284c7",
    defaultStatus: "disconnected",
    testable: true,
    configFields: [
      {
        key: "accountId",
        label: "CDP Account ID",
        type: "text",
        placeholder: "CDP portalındaki hesap kimliği",
        required: true,
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "CDP API erişim anahtarı",
        required: true,
      },
      {
        key: "organizationId",
        label: "Organization ID",
        type: "text",
        placeholder: "CDP organizasyon tanımlayıcısı",
        required: true,
      },
      {
        key: "reportingYear",
        label: "Raporlama Yılı",
        type: "text",
        placeholder: "örn. 2024",
      },
    ],
  },
  {
    key: "irec-evidence",
    name: "I-REC Evidence Platform",
    shortName: "I-REC",
    description: "I-REC sertifikası doğrulama ve kayıt senkronizasyonu",
    longDescription:
      "I-REC (International REC) Evidence Platformu entegrasyonu ile sertifika portföyünüzü otomatik senkronize edin. Green Assets modülünde I-REC sertifikalarınızın geçerlilik ve kullanım durumunu gerçek zamanlı takip edin.",
    category: "Sertifika",
    icon: "🏅",
    color: "#d97706",
    defaultStatus: "disconnected",
    testable: true,
    configFields: [
      {
        key: "participantId",
        label: "Participant ID",
        type: "text",
        placeholder: "I-REC kayıt sistemi katılımcı kimliği",
        required: true,
      },
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "I-REC Evidence API anahtarı",
        required: true,
      },
      {
        key: "environment",
        label: "Ortam",
        type: "select",
        options: ["Üretim (Production)", "Test (Sandbox)"],
      },
    ],
  },
  {
    key: "open-meteo",
    name: "Open-Meteo Hava Durumu API",
    shortName: "Open-Meteo",
    description: "Güneş ışınımı ve rüzgar hızı tahminleri — ücretsiz, API anahtarı gerekmez",
    longDescription:
      "Open-Meteo, saatlik güneş ışınımı (GHI), rüzgar hızı ve sıcaklık tahminleri sunan açık kaynaklı bir hava durumu API'sidir. Voltfox bu veriyi güneş ve rüzgar üretim tahminleri için kullanır. API anahtarı gerektirmez, Voltfox tarafından otomatik çekilir.",
    category: "Piyasa Verisi",
    icon: "🌤️",
    color: "#0ea5e9",
    defaultStatus: "beta",
    testable: true,
    configFields: [],
  },
  {
    key: "ttf-gas",
    name: "TTF Doğalgaz Fiyatları",
    shortName: "TTF Gas",
    description: "Avrupa TTF gaz fiyatları — marjinal elektrik üretim maliyeti tahmini",
    longDescription:
      "Title Transfer Facility (TTF), Avrupa'nın referans doğalgaz spot piyasasıdır. TTF fiyatları, gaz kombine santrallerin marjinal maliyetini ve dolayısıyla karbon yoğunluğu tahminlerini doğrudan etkiler. EIA API anahtarı ile etkinleştirilebilir.",
    category: "Piyasa Verisi",
    icon: "🔥",
    color: "#f97316",
    defaultStatus: "disconnected",
    testable: true,
    configFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Veri sağlayıcı API anahtarı",
        hint: "EIA, Quandl veya benzeri sağlayıcıdan alınabilir",
      },
    ],
  },
  {
    key: "ets-carbon",
    name: "AB ETS Karbon Fiyatı",
    shortName: "ETS Carbon",
    description: "Avrupa Birliği Emisyon Ticaret Sistemi karbon izni (EUA) günlük fiyatları",
    longDescription:
      "AB Emisyon Ticaret Sistemi (EU ETS) kapsamındaki Avrupa Birliği Emisyon İzni (EUA) günlük fiyatları. CBAM hesaplamalarında ve karbon maliyet modellemesinde referans değer olarak kullanılır. Ember Climate API ile entegre edilebilir.",
    category: "Piyasa Verisi",
    icon: "🌍",
    color: "#16a34a",
    defaultStatus: "disconnected",
    testable: true,
    configFields: [
      {
        key: "apiKey",
        label: "API Key",
        type: "password",
        placeholder: "Karbon fiyat veri kaynağı API anahtarı",
        hint: "Ember Climate, Sandbag veya EEX'ten alınabilir",
      },
    ],
  },
];

const CATEGORIES: IntegrationCategory[] = [
  "Tümü",
  "Emisyon Faktörü",
  "Yenilenebilir Enerji",
  "CBAM",
  "Raporlama",
  "Sertifika",
  "Piyasa Verisi",
];

/* ── Styles ─────────────────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:  { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:    { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:   { fontSize: 14, color: "#5c7a72", marginBottom: 0 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#5c7a72",
           textTransform: "uppercase" as const, letterSpacing: ".05em", marginBottom: 6 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
           fontSize: 13, color: "#0a1f1a", background: "#fff", boxSizing: "border-box" as const, outline: "none" },
  textarea: { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
              fontSize: 13, color: "#0a1f1a", background: "#fff", boxSizing: "border-box" as const,
              resize: "vertical" as const, minHeight: 80, outline: "none", fontFamily: "inherit" },
  select: { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
            fontSize: 13, color: "#0a1f1a", background: "#fff", boxSizing: "border-box" as const },
  btn:   { padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
           fontWeight: 700, fontSize: 14, background: "#00b87a", color: "#fff" },
  btnSm: { padding: "7px 16px", borderRadius: 7, border: "1px solid #d4ece4",
           cursor: "pointer", fontSize: 13, background: "#fff", color: "#1a3530" },
  hint:  { fontSize: 11, color: "#5c7a72", marginTop: 4, lineHeight: 1.5 },
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.5)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
  backdropFilter: "blur(2px)",
};

const modalBase: React.CSSProperties = {
  background: "#fff", borderRadius: 16, padding: "32px 36px",
  width: 560, maxWidth: "95vw", boxShadow: "0 24px 64px rgba(0,0,0,.18)",
  maxHeight: "90vh", overflowY: "auto",
};

/* ── Status badge ───────────────────────────────────────────────────────── */
function StatusBadge({ status }: { status: IntegrationStatus }) {
  const map: Record<IntegrationStatus, { label: string; bg: string; fg: string }> = {
    connected:    { label: "Bağlı",        bg: "#dcfce7", fg: "#15803d" },
    disconnected: { label: "Bağlı Değil",  bg: "#f1f5f9", fg: "#64748b" },
    error:        { label: "Hata",         bg: "#fee2e2", fg: "#dc2626" },
    beta:         { label: "Beta",         bg: "#dbeafe", fg: "#1d4ed8" },
    coming_soon:  { label: "Yakında",      bg: "#fef9c3", fg: "#a16207" },
  };
  const { label, bg, fg } = map[status];
  return (
    <span style={{
      background: bg, color: fg, borderRadius: 5, padding: "3px 10px",
      fontSize: 11, fontWeight: 700, letterSpacing: ".02em",
    }}>
      {label}
    </span>
  );
}

/* ── Category badge ─────────────────────────────────────────────────────── */
function CategoryBadge({ category }: { category: Exclude<IntegrationCategory, "Tümü"> }) {
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, color: "#5c7a72",
      background: "#f4fbf8", borderRadius: 4, padding: "2px 8px",
    }}>
      {category}
    </span>
  );
}

/* ── Config Modal ───────────────────────────────────────────────────────── */
function ConfigModal({
  def,
  state,
  onSave,
  onTest,
  onClose,
}: {
  def: IntegrationDef;
  state: IntegrationState;
  onSave: (config: Record<string, string>) => Promise<void>;
  onTest: () => Promise<void>;
  onClose: () => void;
}) {
  const [form,    setForm]    = useState<Record<string, string>>(state.config);
  const [saving,  setSaving]  = useState(false);
  const [testing, setTesting] = useState(false);
  const [msg,     setMsg]     = useState<{ text: string; ok: boolean } | null>(null);

  const isComingSoon = def.defaultStatus === "coming_soon";

  async function handleSave() {
    setSaving(true);
    setMsg(null);
    try {
      await onSave(form);
      setMsg({ text: "Yapılandırma kaydedildi.", ok: true });
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Kayıt hatası", ok: false });
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    setTesting(true);
    setMsg(null);
    try {
      await onTest();
      setMsg({ text: "Bağlantı başarıyla doğrulandı.", ok: true });
    } catch (e: unknown) {
      setMsg({ text: e instanceof Error ? e.message : "Bağlantı testi başarısız", ok: false });
    } finally {
      setTesting(false);
    }
  }

  const allFilled = def.configFields.filter(f => f.required).every(f => form[f.key]?.trim());

  return (
    <div style={overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={modalBase}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", gap: 16, marginBottom: 24 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 12, flexShrink: 0,
            background: def.color + "18",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 26,
          }}>
            {def.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0a1f1a", margin: 0 }}>{def.name}</h2>
              <StatusBadge status={state.status} />
            </div>
            <p style={{ fontSize: 13, color: "#5c7a72", margin: 0, lineHeight: 1.5 }}>{def.longDescription}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: 20, color: "#5c7a72", lineHeight: 1 }}>✕</button>
        </div>

        {/* Coming soon banner */}
        {isComingSoon && (
          <div style={{
            background: "#fef9c3", border: "1px solid #fde68a", borderRadius: 10,
            padding: "12px 16px", fontSize: 13, color: "#92400e", marginBottom: 20,
            display: "flex", gap: 10, alignItems: "center",
          }}>
            <span style={{ fontSize: 18 }}>🚧</span>
            <span>Bu entegrasyon geliştirme aşamasındadır. Alanları doldurup kaydedebilirsiniz — aktif olduğunda otomatik bağlanacaktır.</span>
          </div>
        )}

        {/* Config fields */}
        <div style={{ display: "grid", gap: 16 }}>
          {def.configFields.map(field => (
            <div key={field.key}>
              <label style={s.label}>
                {field.label}
                {field.required && <span style={{ color: "#dc2626", marginLeft: 3 }}>*</span>}
              </label>
              {field.type === "textarea" ? (
                <textarea
                  style={s.textarea}
                  value={form[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  disabled={false}
                />
              ) : field.type === "select" ? (
                <select
                  style={s.select}
                  value={form[field.key] ?? field.options?.[0] ?? ""}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                >
                  {field.options?.map(o => <option key={o}>{o}</option>)}
                </select>
              ) : (
                <input
                  style={s.input}
                  type={field.type}
                  value={form[field.key] ?? ""}
                  placeholder={field.placeholder}
                  onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                  autoComplete={field.type === "password" ? "new-password" : "off"}
                />
              )}
              {field.hint && <p style={s.hint}>{field.hint}</p>}
            </div>
          ))}
        </div>

        {/* Message */}
        {msg && (
          <div style={{
            marginTop: 16, padding: "10px 16px", borderRadius: 8, fontSize: 13,
            background: msg.ok ? "#dcfce7" : "#fee2e2",
            color: msg.ok ? "#15803d" : "#dc2626",
            border: `1px solid ${msg.ok ? "#86efac" : "#fca5a5"}`,
          }}>
            {msg.text}
          </div>
        )}

        {/* Last test info */}
        {state.lastTestedAt && (
          <div style={{ marginTop: 12, fontSize: 11, color: "#5c7a72" }}>
            Son test: {new Date(state.lastTestedAt).toLocaleString("tr-TR")}
            {state.testMessage && ` — ${state.testMessage}`}
          </div>
        )}

        {/* Footer buttons */}
        <div style={{ display: "flex", gap: 10, marginTop: 28, justifyContent: "space-between", alignItems: "center" }}>
          <div>
            {def.testable && (
              <button
                style={{ ...s.btnSm, opacity: testing || !allFilled ? 0.6 : 1 }}
                disabled={testing || !allFilled}
                onClick={handleTest}
              >
                {testing ? "Test ediliyor..." : "🔌 Bağlantıyı Test Et"}
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button style={s.btnSm} onClick={onClose}>İptal</button>
            <button
              style={{ ...s.btn, opacity: saving || (!isComingSoon && !allFilled) ? 0.6 : 1 }}
              disabled={saving || (!isComingSoon && !allFilled)}
              onClick={handleSave}
            >
              {saving ? "Kaydediliyor..." : isComingSoon ? "Kaydet (Beklemede)" : "Kaydet"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ── Integration Card ───────────────────────────────────────────────────── */
function IntegrationCard({
  def,
  state,
  onConfigure,
}: {
  def: IntegrationDef;
  state: IntegrationState;
  onConfigure: () => void;
}) {
  const isComingSoon = def.defaultStatus === "coming_soon";
  const isConnected  = state.status === "connected";

  return (
    <div style={{
      background: "#fff",
      border: isConnected ? "1.5px solid #86efac" : "1px solid #d4ece4",
      borderRadius: 14,
      padding: "22px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 0,
      transition: "box-shadow .15s, border-color .15s",
      boxShadow: isConnected ? "0 0 0 3px rgba(0,184,122,.06)" : "none",
      position: "relative",
    }}
      onMouseEnter={e => (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,.08)")}
      onMouseLeave={e => (e.currentTarget.style.boxShadow = isConnected ? "0 0 0 3px rgba(0,184,122,.06)" : "none")}
    >
      {/* Icon + status */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 14 }}>
        <div style={{
          width: 46, height: 46, borderRadius: 10,
          background: def.color + "18",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 22,
        }}>
          {def.icon}
        </div>
        <StatusBadge status={state.status} />
      </div>

      {/* Name + category */}
      <div style={{ fontWeight: 700, fontSize: 14, color: "#0a1f1a", marginBottom: 4 }}>{def.name}</div>
      <CategoryBadge category={def.category} />
      <p style={{ fontSize: 12, color: "#5c7a72", margin: "10px 0 16px", lineHeight: 1.5, flex: 1 }}>
        {def.description}
      </p>

      {/* Connected indicator */}
      {isConnected && (
        <div style={{ fontSize: 11, color: "#15803d", fontWeight: 600, marginBottom: 10 }}>
          ✓ Aktif bağlantı
          {state.lastTestedAt && ` · ${new Date(state.lastTestedAt).toLocaleDateString("tr-TR")}`}
        </div>
      )}
      {state.status === "error" && state.testMessage && (
        <div style={{ fontSize: 11, color: "#dc2626", marginBottom: 10 }}>{state.testMessage}</div>
      )}

      {/* Action button */}
      <button
        onClick={onConfigure}
        style={{
          width: "100%",
          padding: "9px 0",
          borderRadius: 8,
          border: isComingSoon ? "1px solid #d4ece4" : "none",
          cursor: "pointer",
          fontWeight: 600,
          fontSize: 13,
          background: isComingSoon
            ? "#fff"
            : isConnected
              ? "rgba(0,184,122,.1)"
              : "#00b87a",
          color: isComingSoon ? "#5c7a72" : isConnected ? "#009966" : "#fff",
          transition: "opacity .15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity = "0.8"; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity = "1"; }}
      >
        {isComingSoon
          ? "📋 Ön Kayıt"
          : isConnected
            ? "⚙️ Yapılandır"
            : "Bağlan"}
      </button>
    </div>
  );
}

/* ── Main Page ──────────────────────────────────────────────────────────── */
export default function IntegrationsPage() {
  const [category,  setCategory]  = useState<IntegrationCategory>("Tümü");
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [states,    setStates]    = useState<Record<string, IntegrationState>>(() =>
    Object.fromEntries(
      INTEGRATIONS.map(d => [
        d.key,
        { status: d.defaultStatus, config: {} },
      ])
    )
  );

  // Load saved configs from API on mount
  useEffect(() => {
    (async () => {
      try {
        const data = await api.integrations.list();
        setStates(prev => {
          const next = { ...prev };
          for (const item of data.integrations) {
            if (next[item.key]) {
              next[item.key] = {
                status: item.status as IntegrationStatus,
                config: (item.config ?? {}) as Record<string, string>,
                lastTestedAt: item.lastTestedAt ?? undefined,
              };
            }
          }
          return next;
        });
      } catch {
        // API endpoint henüz yok — sessizce geç
      }
    })();
  }, []);

  async function handleSave(key: string, config: Record<string, string>) {
    try {
      await api.integrations.save(key, { config, enabled: true });
    } catch {
      // API endpoint henüz mevcut değil — local state güncellemesine düş
    }
    setStates(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        config,
        status: "disconnected",
      },
    }));
  }

  async function handleTest(key: string) {
    const def = INTEGRATIONS.find(d => d.key === key)!;
    const state = states[key];

    if (key === "entso-e") {
      const result = await api.integrations.test(key);
      if (!result.ok) throw new Error(result.message);
      setStates(prev => ({
        ...prev,
        [key]: { ...prev[key], status: "connected", lastTestedAt: result.testedAt, testMessage: result.message },
      }));
      return;
    }

    if (key === "epias") {
      const result = await api.integrations.test(key);
      if (!result.ok) throw new Error(result.message);
      setStates(prev => ({
        ...prev,
        [key]: { ...prev[key], status: "connected", lastTestedAt: result.testedAt },
      }));
      return;
    }

    // Tüm diğer testable entegrasyonlar — backend test handler'ı çağır
    if (def.testable) {
      const result = await api.integrations.test(key);
      setStates(prev => ({
        ...prev,
        [key]: {
          ...prev[key],
          status:      result.ok ? "connected" : "error",
          lastTestedAt: result.testedAt,
          testMessage:  result.message,
        },
      }));
      if (!result.ok) throw new Error(result.message);
      return;
    }

    throw new Error(`${def.shortName} için test desteklenmiyor`);
  }

  const activeDef   = activeKey ? INTEGRATIONS.find(d => d.key === activeKey)! : null;
  const activeState = activeKey ? states[activeKey] : null;

  const filtered = INTEGRATIONS.filter(d => category === "Tümü" || d.category === category);

  const connectedCount = Object.values(states).filter(s => s.status === "connected").length;

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={s.h1}>Entegrasyonlar</h1>
        <p style={s.sub}>Veri kaynakları, raporlama platformları ve sertifika sistemleriyle bağlantıları yönetin</p>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, auto) 1fr", gap: 12, marginBottom: 28 }}>
        {[
          { label: "Toplam Entegrasyon", value: INTEGRATIONS.length },
          { label: "Aktif Bağlantı", value: connectedCount },
          { label: "Beta", value: INTEGRATIONS.filter(d => d.defaultStatus === "beta").length },
        ].map(k => (
          <div key={k.label} style={{
            background: "#fff", border: "1px solid #d4ece4", borderRadius: 10,
            padding: "14px 20px", display: "flex", flexDirection: "column", gap: 4,
          }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", textTransform: "uppercase", letterSpacing: ".06em" }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: "#0a1f1a", lineHeight: 1 }}>{k.value}</div>
          </div>
        ))}
        <div /> {/* spacer */}
      </div>

      {/* Category filter tabs */}
      <div style={{ display: "flex", borderBottom: "2px solid #d4ece4", marginBottom: 28, gap: 0, overflowX: "auto" }}>
        {CATEGORIES.map(cat => (
          <button key={cat}
            onClick={() => setCategory(cat)}
            style={{
              padding: "10px 18px", border: "none", cursor: "pointer", fontWeight: 600,
              fontSize: 13, background: "transparent", whiteSpace: "nowrap",
              color: category === cat ? "#00b87a" : "#5c7a72",
              borderBottom: category === cat ? "2px solid #00b87a" : "2px solid transparent",
              marginBottom: -2, transition: "color .15s",
            }}
          >
            {cat}
            <span style={{
              marginLeft: 6, fontSize: 11, fontWeight: 700,
              background: category === cat ? "#e6f9f2" : "#f4fbf8",
              color: category === cat ? "#009966" : "#5c7a72",
              borderRadius: 10, padding: "1px 7px",
            }}>
              {cat === "Tümü"
                ? INTEGRATIONS.length
                : INTEGRATIONS.filter(d => d.category === cat).length}
            </span>
          </button>
        ))}
      </div>

      {/* Integration grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
        gap: 16,
      }}>
        {filtered.map(def => (
          <IntegrationCard
            key={def.key}
            def={def}
            state={states[def.key]}
            onConfigure={() => setActiveKey(def.key)}
          />
        ))}
      </div>

      {/* Config modal */}
      {activeDef && activeState && (
        <ConfigModal
          def={activeDef}
          state={activeState}
          onSave={cfg => handleSave(activeDef.key, cfg)}
          onTest={() => handleTest(activeDef.key)}
          onClose={() => setActiveKey(null)}
        />
      )}
    </div>
  );
}
