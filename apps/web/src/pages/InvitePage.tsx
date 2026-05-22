import { useState, useEffect } from "react";
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

const s: Record<string, React.CSSProperties> = {
  wrap:  { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center",
           background: "#f4fbf8", padding: "24px 16px" },
  box:   { background: "#fff", borderRadius: 14, border: "1px solid #d4ece4", padding: "40px 36px",
           maxWidth: 420, width: "100%", boxShadow: "0 4px 24px rgba(0,0,0,.07)" },
  logo:  { fontSize: 20, fontWeight: 900, color: "#00b87a", marginBottom: 24, textAlign: "center" as const },
  h1:    { fontSize: 20, fontWeight: 700, color: "#0a1f1a", marginBottom: 6, textAlign: "center" as const },
  sub:   { fontSize: 13, color: "#5c7a72", marginBottom: 28, textAlign: "center" as const, lineHeight: 1.5 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 },
  input: { width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d4ece4",
           fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box" as const },
  btn:   { width: "100%", padding: "12px", borderRadius: 9, border: "none", cursor: "pointer",
           fontWeight: 700, fontSize: 15, background: "#00b87a", color: "#fff", marginTop: 4 },
  err:   { fontSize: 13, color: "#DC2626", marginBottom: 12, textAlign: "center" as const, fontWeight: 500 },
  ok:    { fontSize: 13, color: "#059669", marginBottom: 12, textAlign: "center" as const, fontWeight: 500 },
  badge: { display: "inline-block", background: "#e6f9f2", color: "#009966", borderRadius: 99,
           padding: "3px 10px", fontSize: 11, fontWeight: 700, marginBottom: 20 },
  info:  { background: "#f4fbf8", borderRadius: 8, padding: "12px 14px", marginBottom: 20, fontSize: 13, color: "#1a3530" },
};

export default function InvitePage() {
  const { token }  = useParams<{ token: string }>();
  const navigate   = useNavigate();

  const [invite,   setInvite]   = useState<InviteInfo | null>(null);
  const [loadErr,  setLoadErr]  = useState("");
  const [name,     setName]     = useState("");
  const [password, setPassword] = useState("");
  const [confirm,  setConfirm]  = useState("");
  const [err,      setErr]      = useState("");
  const [saving,   setSaving]   = useState(false);
  const [done,     setDone]     = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`${BASE}/invite/${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setLoadErr(d.error === "INVITE_EXPIRED" ? "Bu davet bağlantısının süresi dolmuş." :
          d.error === "INVITE_ALREADY_USED" ? "Bu davet bağlantısı zaten kullanılmış." :
          "Geçersiz davet bağlantısı.");
        else setInvite(d as InviteInfo);
      })
      .catch(() => setLoadErr("Davet bilgisi yüklenemedi."));
  }, [token]);

  async function accept(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    if (password.length < 8) { setErr("Şifre en az 8 karakter olmalı."); return; }
    if (password !== confirm) { setErr("Şifreler eşleşmiyor."); return; }

    setSaving(true);
    try {
      const res = await fetch(`${BASE}/invite/${token}/accept`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ name: name.trim() || undefined, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setErr(data.message ?? "Bir hata oluştu.");
        return;
      }
      setDone(true);
      // Otomatik giriş dene
      if (invite?.email) {
        const { error } = await supabase.auth.signInWithPassword({ email: invite.email, password });
        if (!error) { navigate("/gec"); return; }
      }
    } catch {
      setErr("Sunucu hatası. Lütfen tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={s.wrap}>
      <div style={s.box}>
        <div style={s.logo}>Voltfox</div>

        {loadErr ? (
          <>
            <div style={s.h1}>Davet Geçersiz</div>
            <div style={s.err}>{loadErr}</div>
          </>
        ) : !invite ? (
          <div style={{ textAlign: "center", color: "#5c7a72", fontSize: 13 }}>Yükleniyor…</div>
        ) : done ? (
          <>
            <div style={{ fontSize: 32, textAlign: "center", marginBottom: 12 }}>✅</div>
            <div style={s.h1}>Üyelik Aktif!</div>
            <div style={s.sub}>
              <strong>{invite.tenantName}</strong> şirketine başarıyla katıldınız.
              Giriş yapabilirsiniz.
            </div>
            <button style={s.btn} onClick={() => navigate("/")}>Giriş Yap →</button>
          </>
        ) : (
          <>
            <div style={s.h1}>Daveti Kabul Et</div>
            <div style={s.sub}>
              <strong>{invite.tenantName}</strong> şirketine katılmaya davet edildiniz.
            </div>

            <div style={s.info}>
              <div style={{ marginBottom: 4 }}>
                <strong>E-posta:</strong> {invite.email}
              </div>
              <div>
                <strong>Rol:</strong>{" "}
                <span style={s.badge}>{ROLE_LABELS[invite.role] ?? invite.role}</span>
              </div>
            </div>

            <form onSubmit={accept}>
              <label style={s.label}>Adınız (isteğe bağlı)</label>
              <input style={s.input} value={name} onChange={e => setName(e.target.value)}
                placeholder="Ad Soyad" autoComplete="name" />

              <label style={s.label}>Şifre</label>
              <input style={s.input} type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="En az 8 karakter" autoComplete="new-password" />

              <label style={s.label}>Şifre (Tekrar)</label>
              <input style={s.input} type="password" value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Şifreyi tekrar girin" autoComplete="new-password" />

              {err && <div style={s.err}>{err}</div>}

              <button type="submit" style={s.btn} disabled={saving}>
                {saving ? "İşleniyor…" : "Daveti Kabul Et"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
