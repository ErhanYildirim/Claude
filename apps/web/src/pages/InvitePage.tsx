import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";

const BASE = "/api/v1";

interface InviteInfo {
  email:      string;
  role:       string;
  tenantName: string;
  tenantId:   string;
}

const ROLE_LABELS: Record<string, string> = {
  owner:   "Sahip",
  admin:   "Yönetici",
  analyst: "Analist",
  viewer:  "Görüntüleyici",
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  owner:   { bg: "#FEF3C7", color: "#92400E" },
  admin:   { bg: "#DBEAFE", color: "#1d4ed8" },
  analyst: { bg: "#D1FAE5", color: "#065F46" },
  viewer:  { bg: "#f3f4f6", color: "#374151" },
};

function passwordStrength(pw: string): { level: 0 | 1 | 2 | 3; label: string; color: string } {
  if (pw.length < 8)  return { level: 0, label: "", color: "#e5e7eb" };
  const hasNum     = /\d/.test(pw);
  const hasSpecial = /[^a-zA-Z0-9]/.test(pw);
  const hasUpper   = /[A-Z]/.test(pw);
  const score = [hasNum, hasSpecial, hasUpper, pw.length >= 12].filter(Boolean).length;
  if (score <= 1) return { level: 1, label: "Zayıf", color: "#ef4444" };
  if (score <= 2) return { level: 2, label: "Orta", color: "#f59e0b" };
  return { level: 3, label: "Güçlü", color: "#10b981" };
}

export default function InvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate  = useNavigate();

  const [invite,   setInvite]   = useState<InviteInfo | null>(null);
  const [loadErr,  setLoadErr]  = useState("");
  const [loading,  setLoading]  = useState(true);

  const [mode,     setMode]     = useState<"new" | "existing">("new");
  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [showPw,   setShowPw]   = useState(false);
  const [showPw2,  setShowPw2]  = useState(false);
  const [err,      setErr]      = useState("");
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);

  const strength = passwordStrength(password);
  const pwMatch  = confirm.length > 0 && password === confirm;
  const pwMismatch = confirm.length > 0 && password !== confirm;

  const loadInvite = useCallback(() => {
    if (!token) return;
    setLoading(true);
    fetch(`${BASE}/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) {
          setLoadErr(
            d.error === "INVITE_EXPIRED"       ? "Bu davet bağlantısının süresi dolmuş." :
            d.error === "INVITE_ALREADY_USED"  ? "Bu davet bağlantısı zaten kullanılmış." :
            d.error === "INVITE_NOT_FOUND"     ? "Davet bağlantısı bulunamadı." :
            "Geçersiz davet bağlantısı."
          );
        } else {
          setInvite(d as InviteInfo);
        }
      })
      .catch(() => setLoadErr("Davet bilgisi yüklenemedi. İnternet bağlantınızı kontrol edin."))
      .finally(() => setLoading(false));
  }, [token]);

  useEffect(() => { loadInvite(); }, [loadInvite]);

  async function acceptInvite(pw: string) {
    const res = await fetch(`${BASE}/invite/${token}/accept`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ name: name.trim() || undefined, password: pw }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message ?? "Bir hata oluştu.");
    return data;
  }

  async function handleNewAccount(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8)     { setErr("Şifre en az 8 karakter olmalı."); return; }
    if (password !== confirm)    { setErr("Şifreler eşleşmiyor."); return; }
    setSaving(true);
    try {
      await acceptInvite(password);
      setDone(true);
      if (invite?.email) {
        const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
        if (!error) { navigate("/dashboard"); return; }
      }
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Sunucu hatası. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  async function handleExistingAccount(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (!invite) return;
    setSaving(true);
    try {
      // Sign in first so we know credentials are valid
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: invite.email,
        password,
      });
      if (signInErr) { setErr("E-posta veya şifre hatalı."); setSaving(false); return; }

      // Then accept the invite (backend re-uses existing user, password param required but ignored for existing user)
      await acceptInvite(password);
      setDone(true);
      navigate("/dashboard");
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Sunucu hatası. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  const roleStyle = ROLE_COLORS[invite?.role ?? "viewer"] ?? ROLE_COLORS.viewer;

  return (
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "linear-gradient(135deg,#f0fdf8 0%,#e6f9f2 100%)",
      padding: "24px 16px",
    }}>
      <div style={{
        background: "#fff",
        borderRadius: 16,
        border: "1px solid #d4ece4",
        padding: "44px 40px",
        maxWidth: 440,
        width: "100%",
        boxShadow: "0 8px 40px rgba(0,30,20,.1)",
      }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{
            display: "inline-flex", alignItems: "center", justifyContent: "center",
            width: 48, height: 48, borderRadius: 14,
            background: "linear-gradient(135deg,#00b87a,#009966)",
            boxShadow: "0 4px 16px rgba(0,184,122,.35)",
            marginBottom: 10,
          }}>
            <span style={{ fontSize: 22, color: "#fff", fontWeight: 900 }}>V</span>
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: "#0a1f1a", letterSpacing: "-.02em" }}>Voltfox</div>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{ textAlign: "center", color: "#5c7a72", fontSize: 14, padding: "20px 0" }}>
            <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
            Davet bilgisi yükleniyor…
          </div>
        )}

        {/* Error state */}
        {!loading && loadErr && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {loadErr.includes("süresi") ? "⏰" : loadErr.includes("kullanılmış") ? "✅" : "❌"}
            </div>
            <div style={{ fontSize: 17, fontWeight: 700, color: "#0a1f1a", marginBottom: 8 }}>
              {loadErr.includes("süresi") ? "Davet Süresi Doldu" :
               loadErr.includes("kullanılmış") ? "Davet Kullanıldı" : "Geçersiz Davet"}
            </div>
            <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 24, lineHeight: 1.6 }}>
              {loadErr}
            </div>
            <button
              onClick={() => navigate("/")}
              style={{
                background: "#00b87a", color: "#fff", border: "none",
                borderRadius: 9, padding: "10px 28px", fontSize: 14,
                fontWeight: 700, cursor: "pointer",
              }}
            >
              Ana Sayfaya Dön
            </button>
          </div>
        )}

        {/* Success state */}
        {!loading && !loadErr && done && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 700, color: "#0a1f1a", marginBottom: 8 }}>
              Hoş geldiniz!
            </div>
            <div style={{ fontSize: 13, color: "#5c7a72", lineHeight: 1.7, marginBottom: 24 }}>
              <strong style={{ color: "#0a1f1a" }}>{invite?.tenantName}</strong> ekibine
              başarıyla katıldınız.<br />
              Sizi panele yönlendiriyoruz…
            </div>
            <button
              onClick={() => navigate("/dashboard")}
              style={{
                background: "#00b87a", color: "#fff", border: "none",
                borderRadius: 9, padding: "11px 28px", fontSize: 14,
                fontWeight: 700, cursor: "pointer", width: "100%",
              }}
            >
              Panele Git →
            </button>
          </div>
        )}

        {/* Invite form */}
        {!loading && !loadErr && !done && invite && (
          <>
            {/* Tenant info banner */}
            <div style={{
              background: "#f4fbf8", borderRadius: 10, border: "1px solid #d4ece4",
              padding: "14px 16px", marginBottom: 22, display: "flex", alignItems: "center", gap: 12,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: 10,
                background: "linear-gradient(135deg,#00b87a,#007755)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 15, fontWeight: 900, color: "#fff", flexShrink: 0,
              }}>
                {invite.tenantName.slice(0, 1).toUpperCase()}
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1f1a" }}>{invite.tenantName}</div>
                <div style={{ fontSize: 12, color: "#5c7a72", marginTop: 2 }}>
                  {invite.email} ·{" "}
                  <span style={{
                    ...roleStyle,
                    display: "inline", padding: "1px 7px", borderRadius: 99,
                    fontSize: 11, fontWeight: 700,
                  }}>
                    {ROLE_LABELS[invite.role] ?? invite.role}
                  </span>
                </div>
              </div>
            </div>

            {/* Mode toggle */}
            <div style={{
              display: "flex", background: "#f4fbf8", borderRadius: 9,
              padding: 3, marginBottom: 22,
            }}>
              {([["new", "Yeni Hesap Oluştur"], ["existing", "Hesabım Var"]] as const).map(([m, label]) => (
                <button
                  key={m}
                  onClick={() => { setMode(m); setErr(""); setPassword(""); setConfirm(""); }}
                  style={{
                    flex: 1, padding: "8px 10px", borderRadius: 7, border: "none",
                    cursor: "pointer", fontSize: 13, fontWeight: 600, transition: "all .15s",
                    background: mode === m ? "#fff" : "transparent",
                    color: mode === m ? "#009966" : "#5c7a72",
                    boxShadow: mode === m ? "0 1px 4px rgba(0,0,0,.1)" : "none",
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            {mode === "new" ? (
              <form onSubmit={handleNewAccount}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 }}>
                  Adınız (isteğe bağlı)
                </div>
                <input
                  style={inp}
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="Ad Soyad"
                  autoComplete="name"
                />

                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 }}>
                  Şifre *
                </div>
                <div style={{ position: "relative", marginBottom: 4 }}>
                  <input
                    style={{ ...inp, marginBottom: 0, paddingRight: 40 }}
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="En az 8 karakter"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#5c7a72" }}
                  >
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>
                {/* Password strength bar */}
                {password.length > 0 && (
                  <div style={{ marginBottom: 10, marginTop: 6 }}>
                    <div style={{ display: "flex", gap: 3, marginBottom: 4 }}>
                      {[1, 2, 3].map(l => (
                        <div key={l} style={{
                          flex: 1, height: 3, borderRadius: 99,
                          background: strength.level >= l ? strength.color : "#e5e7eb",
                          transition: "background .2s",
                        }} />
                      ))}
                    </div>
                    {strength.level > 0 && (
                      <div style={{ fontSize: 11, color: strength.color, fontWeight: 600 }}>
                        {strength.label}
                        {strength.level === 1 && " — büyük harf, rakam veya özel karakter ekleyin"}
                      </div>
                    )}
                  </div>
                )}

                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 }}>
                  Şifre Tekrar *
                </div>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <input
                    style={{
                      ...inp, marginBottom: 0, paddingRight: 40,
                      borderColor: pwMismatch ? "#ef4444" : pwMatch ? "#10b981" : "#d4ece4",
                    }}
                    type={showPw2 ? "text" : "password"}
                    value={confirm}
                    onChange={e => setConfirm(e.target.value)}
                    placeholder="Şifreyi tekrar girin"
                    autoComplete="new-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw2(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#5c7a72" }}
                  >
                    {showPw2 ? "🙈" : "👁"}
                  </button>
                  {pwMatch    && <span style={{ position: "absolute", right: 36, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#10b981" }}>✓</span>}
                  {pwMismatch && <span style={{ position: "absolute", right: 36, top: "50%", transform: "translateY(-50%)", fontSize: 14, color: "#ef4444" }}>✗</span>}
                </div>

                {err && <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 12, fontWeight: 500 }}>{err}</div>}

                <button type="submit" disabled={saving} style={submitBtn}>
                  {saving ? "İşleniyor…" : "Hesap Oluştur ve Katıl →"}
                </button>
              </form>
            ) : (
              <form onSubmit={handleExistingAccount}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 }}>
                  E-posta
                </div>
                <input
                  style={{ ...inp, background: "#f9fafb", color: "#6b7280" }}
                  value={invite.email}
                  readOnly
                />

                <div style={{ fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 }}>
                  Mevcut Şifreniz *
                </div>
                <div style={{ position: "relative", marginBottom: 14 }}>
                  <input
                    style={{ ...inp, marginBottom: 0, paddingRight: 40 }}
                    type={showPw ? "text" : "password"}
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Voltfox şifrenizi girin"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw(v => !v)}
                    style={{ position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)", background: "none", border: "none", cursor: "pointer", fontSize: 14, color: "#5c7a72" }}
                  >
                    {showPw ? "🙈" : "👁"}
                  </button>
                </div>

                {err && <div style={{ fontSize: 13, color: "#DC2626", marginBottom: 12, fontWeight: 500 }}>{err}</div>}

                <button type="submit" disabled={saving} style={submitBtn}>
                  {saving ? "Giriş yapılıyor…" : "Giriş Yap ve Daveti Kabul Et →"}
                </button>
              </form>
            )}

            <div style={{ fontSize: 12, color: "#9ca3af", textAlign: "center" as const, marginTop: 16, lineHeight: 1.6 }}>
              Davet bağlantısı{" "}
              <strong style={{ color: "#6b7280" }}>{invite.email}</strong>
              {" "}adresine gönderilmiştir.
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const inp: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #d4ece4",
  fontSize: 14,
  outline: "none",
  marginBottom: 14,
  boxSizing: "border-box",
  background: "#fff",
  color: "#0a1f1a",
};

const submitBtn: React.CSSProperties = {
  width: "100%",
  padding: "12px",
  borderRadius: 9,
  border: "none",
  cursor: "pointer",
  fontWeight: 700,
  fontSize: 15,
  background: "linear-gradient(135deg,#00b87a,#009966)",
  color: "#fff",
  boxShadow: "0 4px 12px rgba(0,184,122,.25)",
  transition: "opacity .15s",
};
