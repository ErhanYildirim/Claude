import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import type { AdminSmtpConfig } from "../../lib/api.js";

// ── Ortak stiller ──────────────────────────────────────────────────────────────
const card: React.CSSProperties = {
  background: "var(--bg-card)", border: "1px solid var(--border)",
  borderRadius: 10, padding: "22px 26px", marginBottom: 20,
};
const label: React.CSSProperties = {
  display: "block", fontSize: 12, fontWeight: 600,
  color: "var(--text-muted)", marginBottom: 6,
};
function inp(err?: boolean): React.CSSProperties {
  return {
    width: "100%", padding: "9px 12px", borderRadius: 7, fontSize: 13,
    border: `1px solid ${err ? "#ef4444" : "var(--border)"}`,
    background: "var(--bg-card)", color: "var(--text)",
    outline: "none", boxSizing: "border-box",
  };
}
const row: React.CSSProperties = { display: "grid", gap: 16, marginBottom: 16 };
const btn = (variant: "primary" | "danger" | "ghost", disabled?: boolean): React.CSSProperties => ({
  padding: "9px 20px", fontSize: 13, fontWeight: 600, borderRadius: 7, cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1, transition: "opacity 0.15s",
  background: variant === "primary" ? "var(--accent)" : variant === "danger" ? "#ef4444" : "transparent",
  border: variant === "ghost" ? "1px solid var(--border)" : "none",
  color: variant === "ghost" ? "var(--text)" : "#fff",
});

// ── Bağlantı durum rozeti ───────────────────────────────────────────────────────
function StatusBadge({ status }: { status: "unknown" | "ok" | "error" | "testing" }) {
  const map = {
    unknown: { color: "#94a3b8", label: "Test Edilmedi" },
    ok:      { color: "#22c55e", label: "Bağlantı OK" },
    error:   { color: "#ef4444", label: "Bağlantı Hatası" },
    testing: { color: "#f59e0b", label: "Test Ediliyor…" },
  };
  const { color, label: lbl } = map[status];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      fontSize: 12, fontWeight: 600, color,
    }}>
      <span style={{ width: 8, height: 8, borderRadius: "50%", background: color, display: "inline-block" }} />
      {lbl}
    </span>
  );
}

// ── Preset SMTP sağlayıcıları ───────────────────────────────────────────────────
const PRESETS = [
  { label: "Gmail",       host: "smtp.gmail.com",     port: 587, secure: false },
  { label: "Outlook/365", host: "smtp.office365.com", port: 587, secure: false },
  { label: "AWS SES",     host: "email-smtp.eu-west-1.amazonaws.com", port: 587, secure: false },
  { label: "SendGrid",    host: "smtp.sendgrid.net",  port: 587, secure: false },
  { label: "Özel SMTP",   host: "",                   port: 587, secure: false },
];

interface FormState {
  host: string; port: string; secure: boolean;
  username: string; password: string;
  fromEmail: string; fromName: string; enabled: boolean;
}

const DEFAULT_FORM: FormState = {
  host: "", port: "587", secure: false,
  username: "", password: "",
  fromEmail: "", fromName: "Voltfox", enabled: true,
};

export default function AdminSmtpPage() {
  const [config, setConfig]   = useState<AdminSmtpConfig | null>(null);
  const [form, setForm]       = useState<FormState>(DEFAULT_FORM);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [connStatus, setConnStatus] = useState<"unknown" | "ok" | "error" | "testing">("unknown");
  const [saveMsg, setSaveMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [errors, setErrors]   = useState<Partial<Record<keyof FormState, string>>>({});

  useEffect(() => {
    api.admin.smtp.get().then(r => {
      if (r.config) {
        setConfig(r.config);
        setForm({
          host:      r.config.host,
          port:      String(r.config.port),
          secure:    r.config.secure,
          username:  r.config.username,
          password:  "", // şifreyi asla önceden doldurmuyoruz
          fromEmail: r.config.fromEmail,
          fromName:  r.config.fromName,
          enabled:   r.config.enabled,
        });
      }
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  function upd<K extends keyof FormState>(k: K, v: FormState[K]) {
    setForm(f => ({ ...f, [k]: v }));
    setErrors(e => ({ ...e, [k]: undefined }));
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setForm(f => ({
      ...f,
      host:   preset.host,
      port:   String(preset.port),
      secure: preset.secure,
    }));
  }

  function validate(): boolean {
    const e: typeof errors = {};
    if (!form.host.trim())      e.host      = "Sunucu adresi zorunlu";
    if (!form.fromEmail.trim()) e.fromEmail = "Gönderen e-posta zorunlu";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.fromEmail)) e.fromEmail = "Geçerli bir e-posta girin";
    const p = parseInt(form.port);
    if (isNaN(p) || p < 1 || p > 65535) e.port = "1–65535 arası port";
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function save() {
    if (!validate()) return;
    setSaving(true); setSaveMsg(null);
    try {
      const r = await api.admin.smtp.save({
        host:      form.host.trim(),
        port:      parseInt(form.port),
        secure:    form.secure,
        username:  form.username || undefined,
        password:  form.password || undefined,
        fromEmail: form.fromEmail.trim(),
        fromName:  form.fromName.trim() || "Voltfox",
        enabled:   form.enabled,
      });
      setConfig(r.config);
      setForm(f => ({ ...f, password: "" }));
      setConnStatus("unknown");
      setSaveMsg({ ok: true, text: r.message });
    } catch (e: unknown) {
      setSaveMsg({ ok: false, text: (e as Error).message });
    } finally { setSaving(false); }
  }

  async function testConnection() {
    if (!testEmail.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
      setTestResult({ ok: false, msg: "Geçerli bir e-posta adresi girin." });
      return;
    }
    setTesting(true); setConnStatus("testing"); setTestResult(null);
    try {
      const r = await api.admin.smtp.test(testEmail);
      setConnStatus(r.success ? "ok" : "error");
      setTestResult({ ok: r.success, msg: r.success ? (r.message ?? "Başarılı") : (r.error ?? "Bilinmeyen hata") });
    } catch (e: unknown) {
      setConnStatus("error");
      setTestResult({ ok: false, msg: (e as Error).message });
    } finally { setTesting(false); }
  }

  async function deleteConfig() {
    if (!confirm("SMTP yapılandırmasını silmek istediğinizden emin misiniz?")) return;
    setDeleting(true);
    try {
      await api.admin.smtp.delete();
      setConfig(null);
      setForm(DEFAULT_FORM);
      setConnStatus("unknown");
      setSaveMsg({ ok: true, text: "SMTP yapılandırması silindi." });
    } catch (e: unknown) {
      setSaveMsg({ ok: false, text: (e as Error).message });
    } finally { setDeleting(false); }
  }

  if (loading) return <div style={{ padding: 40, color: "var(--text-muted)" }}>Yükleniyor…</div>;

  return (
    <div style={{ padding: "24px 28px", maxWidth: 760 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "var(--text)", margin: 0 }}>Email / SMTP Ayarları</h1>
        <p style={{ fontSize: 13, color: "var(--text-muted)", margin: "4px 0 0" }}>
          Sistem e-postalarının gönderileceği SMTP sunucusunu yapılandırın.
          Davet, hesaplama bildirimi ve uyarı e-postaları bu ayarları kullanır.
        </p>
      </div>

      {/* Durum */}
      <div style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 13, color: "var(--text)" }}>
            {config ? (
              <>Yapılandırıldı — <span style={{ fontFamily: "monospace" }}>{config.host}:{config.port}</span></>
            ) : (
              "SMTP henüz yapılandırılmamış"
            )}
          </div>
          {config && (
            <span style={{
              fontSize: 11, padding: "2px 7px", borderRadius: 4, fontWeight: 600,
              background: config.enabled ? "#14532d" : "#1e293b",
              color: config.enabled ? "#86efac" : "#94a3b8",
            }}>
              {config.enabled ? "Aktif" : "Devre Dışı"}
            </span>
          )}
        </div>
        <StatusBadge status={connStatus} />
      </div>

      {/* Preset seçici */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 12 }}>
          Hızlı Yapılandırma
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {PRESETS.map(p => (
            <button
              key={p.label}
              onClick={() => applyPreset(p)}
              style={{
                padding: "6px 14px", fontSize: 12, fontWeight: 500, borderRadius: 6, cursor: "pointer",
                border: form.host === p.host && p.host ? "1px solid var(--accent)" : "1px solid var(--border)",
                background: form.host === p.host && p.host ? "var(--accent-bg)" : "transparent",
                color: form.host === p.host && p.host ? "var(--accent)" : "var(--text)",
              }}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Ana form */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 18 }}>
          Sunucu Ayarları
        </div>

        {/* Host + Port */}
        <div style={{ ...row, gridTemplateColumns: "1fr 140px" }}>
          <div>
            <label style={label}>SMTP Sunucu Adresi *</label>
            <input value={form.host} onChange={e => upd("host", e.target.value)}
              placeholder="smtp.example.com" style={inp(!!errors.host)} />
            {errors.host && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>{errors.host}</div>}
          </div>
          <div>
            <label style={label}>Port *</label>
            <input type="number" value={form.port} onChange={e => upd("port", e.target.value)}
              min={1} max={65535} style={inp(!!errors.port)} />
            {errors.port && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>{errors.port}</div>}
          </div>
        </div>

        {/* Secure / Enabled */}
        <div style={{ ...row, gridTemplateColumns: "1fr 1fr", marginBottom: 20 }}>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.secure} onChange={e => upd("secure", e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
            <div>
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>SSL/TLS (port 465)</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>İşaretli değilse STARTTLS kullanılır</div>
            </div>
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
            <input type="checkbox" checked={form.enabled} onChange={e => upd("enabled", e.target.checked)}
              style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
            <div>
              <div style={{ fontSize: 13, color: "var(--text)", fontWeight: 500 }}>SMTP Etkin</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Devre dışı bırakılırsa Resend'e döner</div>
            </div>
          </label>
        </div>

        {/* Kimlik doğrulama */}
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 18, marginBottom: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Kimlik Doğrulama
          </div>
          <div style={{ ...row, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={label}>Kullanıcı Adı</label>
              <input value={form.username} onChange={e => upd("username", e.target.value)}
                placeholder="user@example.com" autoComplete="username" style={inp()} />
            </div>
            <div>
              <label style={label}>
                Şifre {config?.hasPassword && !form.password && (
                  <span style={{ color: "var(--accent)", fontWeight: 400 }}>(mevcut şifre korunuyor)</span>
                )}
              </label>
              <input type="password" value={form.password} onChange={e => upd("password", e.target.value)}
                placeholder={config?.hasPassword ? "Değiştirmek için girin" : "Şifre girin"}
                autoComplete="new-password" style={inp()} />
            </div>
          </div>
        </div>

        {/* Gönderen bilgileri */}
        <div style={{ borderTop: "1px solid var(--border-light)", paddingTop: 18 }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 14, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Gönderen Bilgileri
          </div>
          <div style={{ ...row, gridTemplateColumns: "1fr 1fr" }}>
            <div>
              <label style={label}>Gönderen E-posta *</label>
              <input value={form.fromEmail} onChange={e => upd("fromEmail", e.target.value)}
                placeholder="no-reply@example.com" style={inp(!!errors.fromEmail)} />
              {errors.fromEmail && <div style={{ color: "#ef4444", fontSize: 11, marginTop: 4 }}>{errors.fromEmail}</div>}
            </div>
            <div>
              <label style={label}>Gönderen Adı</label>
              <input value={form.fromName} onChange={e => upd("fromName", e.target.value)}
                placeholder="Voltfox" style={inp()} />
            </div>
          </div>
        </div>

        {/* Kaydet butonu + mesaj */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 20 }}>
          <button onClick={save} disabled={saving} style={btn("primary", saving)}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
          {config && (
            <button onClick={deleteConfig} disabled={deleting} style={btn("danger", deleting)}>
              {deleting ? "Siliniyor…" : "Yapılandırmayı Sil"}
            </button>
          )}
          {saveMsg && (
            <span style={{ fontSize: 13, color: saveMsg.ok ? "#22c55e" : "#ef4444" }}>
              {saveMsg.ok ? "✓ " : "✗ "}{saveMsg.text}
            </span>
          )}
        </div>
      </div>

      {/* Test email */}
      <div style={card}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>
          Bağlantı Testi
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Test e-postası göndererek SMTP bağlantısını doğrulayın. Önce ayarları kaydedin.
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <input
              value={testEmail}
              onChange={e => setTestEmail(e.target.value)}
              placeholder="test@example.com"
              disabled={!config || testing}
              style={{ ...inp(), opacity: !config ? 0.5 : 1 }}
            />
          </div>
          <button
            onClick={testConnection}
            disabled={!config || testing}
            style={btn("ghost", !config || testing)}
          >
            {testing ? "Test ediliyor…" : "Test E-postası Gönder"}
          </button>
        </div>

        {testResult && (
          <div style={{
            marginTop: 12, padding: "10px 14px", borderRadius: 7, fontSize: 13,
            background: testResult.ok ? "#14532d22" : "#ef444422",
            border: `1px solid ${testResult.ok ? "#22c55e" : "#ef4444"}`,
            color: testResult.ok ? "#22c55e" : "#ef4444",
          }}>
            {testResult.ok ? "✓ " : "✗ "}{testResult.msg}
          </div>
        )}

        {!config && (
          <div style={{ marginTop: 10, fontSize: 12, color: "var(--text-muted)" }}>
            Test edebilmek için önce SMTP ayarlarını kaydedin.
          </div>
        )}
      </div>

      {/* Yardım / Notlar */}
      <div style={{ ...card, background: "transparent", borderStyle: "dashed" }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
          Önemli Notlar
        </div>
        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.8 }}>
          <li>Şifre <strong>AES-256-GCM</strong> ile şifrelenerek saklanır. <code>SMTP_ENCRYPTION_KEY</code> env var ayarlanmazsa plain text saklanır (sadece geliştirme).</li>
          <li>Gmail kullanıyorsanız, Google hesabı üzerinden <strong>Uygulama Şifresi</strong> (App Password) oluşturmanız gerekir.</li>
          <li>SMTP devre dışı bırakılırsa veya bağlantı başarısız olursa sistem <strong>Resend API</strong>'ye (varsa) döner.</li>
          <li><code>SMTP_ENCRYPTION_KEY</code>: 64 karakter hex (32 byte) — örn. <code>openssl rand -hex 32</code></li>
        </ul>
      </div>
    </div>
  );
}
