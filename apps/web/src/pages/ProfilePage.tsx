import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";

const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 720, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:    { fontSize: 14, color: "#5c7a72", marginBottom: 28 },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "24px", marginBottom: 16 },
  cardH:  { fontSize: 13, fontWeight: 700, color: "#0a1f1a", marginBottom: 16 },
  label:  { display: "block", fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 5 },
  input:  { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
            fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box" as const },
  btn:    { padding: "9px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 600, fontSize: 13 },
  btnG:   { background: "#00b87a", color: "#fff" },
  btnR:   { background: "#FEE2E2", color: "#DC2626" },
  btnGh:  { background: "#eef7f3", color: "#1a3530" },
  ok:     { fontSize: 13, color: "#059669", marginBottom: 12, fontWeight: 500 },
  err:    { fontSize: 13, color: "#DC2626", marginBottom: 12, fontWeight: 500 },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "11px 0", borderBottom: "1px solid #eef7f3" },
  avatarBig: {
    width: 80, height: 80, borderRadius: "50%", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 30, fontWeight: 800, color: "#fff",
    background: "linear-gradient(135deg,#00b87a,#009966)",
  },
};

function initials(name: string | undefined, email: string | undefined): string {
  if (name && name.trim()) {
    const parts = name.trim().split(/\s+/);
    return parts.length > 1
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return (email ?? "?").slice(0, 2).toUpperCase();
}

export default function ProfilePage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [nameOk, setNameOk] = useState(false);
  const [nameErr, setNameErr] = useState("");
  const [nameSaving, setNameSaving] = useState(false);

  const [currentPwd, setCurrentPwd] = useState("");
  const [newPwd,     setNewPwd]     = useState("");
  const [confirmPwd, setConfirmPwd] = useState("");
  const [pwdOk,  setPwdOk]  = useState(false);
  const [pwdErr, setPwdErr] = useState("");
  const [pwdSaving, setPwdSaving] = useState(false);

  const [signOutAllLoading, setSignOutAllLoading] = useState(false);
  const [leaveLoading,     setLeaveLoading]      = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.display_name) {
      setDisplayName(user.user_metadata.display_name as string);
    }
  }, [user]);

  async function saveName(e: React.FormEvent) {
    e.preventDefault();
    setNameOk(false); setNameErr("");
    if (!displayName.trim()) { setNameErr("İsim boş olamaz."); return; }
    setNameSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { display_name: displayName.trim() },
      });
      if (error) throw error;
      setNameOk(true);
      setTimeout(() => setNameOk(false), 3000);
    } catch (err: unknown) {
      setNameErr((err as Error).message ?? "Güncelleme başarısız.");
    } finally {
      setNameSaving(false);
    }
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdOk(false); setPwdErr("");
    if (newPwd.length < 8) { setPwdErr("Şifre en az 8 karakter olmalı."); return; }
    if (newPwd !== confirmPwd) { setPwdErr("Şifreler eşleşmiyor."); return; }
    setPwdSaving(true);
    try {
      // Re-authenticate first if current password provided
      if (currentPwd && user?.email) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email: user.email, password: currentPwd,
        });
        if (signInErr) { setPwdErr("Mevcut şifre yanlış."); return; }
      }
      const { error } = await supabase.auth.updateUser({ password: newPwd });
      if (error) throw error;
      setPwdOk(true);
      setCurrentPwd(""); setNewPwd(""); setConfirmPwd("");
      setTimeout(() => setPwdOk(false), 3000);
    } catch (err: unknown) {
      setPwdErr((err as Error).message ?? "Şifre değiştirme başarısız.");
    } finally {
      setPwdSaving(false);
    }
  }

  async function signOutAll() {
    if (!confirm("Tüm cihazlardaki oturumlar kapatılacak. Emin misiniz?")) return;
    setSignOutAllLoading(true);
    try {
      await supabase.auth.signOut({ scope: "global" });
      navigate("/");
    } catch {
      /* ignore */
    } finally {
      setSignOutAllLoading(false);
    }
  }

  function downloadData() {
    window.open("/api/v1/members/me/export", "_blank");
  }

  async function leaveOrganization() {
    if (!confirm("Bu şirketteki hesabınızı kapatmak istediğinizden emin misiniz? Bu işlem geri alınamaz.")) return;
    setLeaveLoading(true);
    try {
      await api.members.leave();
      await supabase.auth.signOut();
      navigate("/");
    } catch (err: unknown) {
      alert((err as Error).message ?? "İşlem başarısız. Son owner iseniz önce başka birine yetki verin.");
    } finally {
      setLeaveLoading(false);
    }
  }

  const name  = (user?.user_metadata?.display_name as string | undefined) ?? "";
  const email = user?.email ?? "";
  const avatar = initials(name, email);

  return (
    <div style={s.page}>
      <div style={s.h1}>Profil</div>
      <div style={s.sub}>Hesap bilgilerinizi ve güvenlik ayarlarınızı yönetin.</div>

      {/* Avatar + kimlik kartı */}
      <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 20 }}>
        <div style={s.avatarBig}>{avatar}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "#0a1f1a" }}>
            {name || email}
          </div>
          <div style={{ fontSize: 13, color: "#5c7a72", marginTop: 2 }}>{email}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Kullanıcı ID: {user?.id?.slice(0, 8)}…
          </div>
        </div>
      </div>

      {/* İsim değiştir */}
      <div style={s.card}>
        <div style={s.cardH}>Görünen Ad</div>
        <form onSubmit={saveName}>
          <label style={s.label}>Ad Soyad</label>
          <input style={s.input} value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Adınızı girin" />
          {nameOk  && <div style={s.ok}>Kaydedildi!</div>}
          {nameErr && <div style={s.err}>{nameErr}</div>}
          <button type="submit" style={{ ...s.btn, ...s.btnG }} disabled={nameSaving}>
            {nameSaving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </form>
      </div>

      {/* E-posta (read-only) */}
      <div style={s.card}>
        <div style={s.cardH}>E-posta Adresi</div>
        <div style={{ ...s.input, background: "#f4fbf8", color: "#5c7a72", cursor: "not-allowed",
                      display: "block", lineHeight: "1.5" }}>
          {email}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          E-posta değişikliği için yöneticinizle iletişime geçin.
        </div>
      </div>

      {/* Şifre değiştir */}
      <div style={s.card}>
        <div style={s.cardH}>Şifre Değiştir</div>
        <form onSubmit={changePassword}>
          <label style={s.label}>Mevcut Şifre</label>
          <input style={s.input} type="password" value={currentPwd}
            onChange={e => setCurrentPwd(e.target.value)}
            placeholder="Mevcut şifrenizi girin (doğrulama için)" />
          <label style={s.label}>Yeni Şifre</label>
          <input style={s.input} type="password" value={newPwd}
            onChange={e => setNewPwd(e.target.value)}
            placeholder="En az 8 karakter" />
          <label style={s.label}>Yeni Şifre (Tekrar)</label>
          <input style={s.input} type="password" value={confirmPwd}
            onChange={e => setConfirmPwd(e.target.value)}
            placeholder="Şifreyi tekrar girin" />
          {pwdOk  && <div style={s.ok}>Şifre başarıyla değiştirildi!</div>}
          {pwdErr && <div style={s.err}>{pwdErr}</div>}
          <button type="submit" style={{ ...s.btn, ...s.btnG }} disabled={pwdSaving}>
            {pwdSaving ? "Değiştiriliyor…" : "Şifreyi Değiştir"}
          </button>
        </form>
      </div>

      {/* Oturum yönetimi */}
      <div style={s.card}>
        <div style={s.cardH}>Oturum Yönetimi</div>
        <div style={{ ...s.row, borderBottom: "none" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a1f1a" }}>Tüm Oturumları Kapat</div>
            <div style={{ fontSize: 12, color: "#5c7a72", marginTop: 2 }}>
              Tüm cihaz ve tarayıcılardaki oturumları sonlandırır.
            </div>
          </div>
          <button style={{ ...s.btn, ...s.btnR }} onClick={signOutAll} disabled={signOutAllLoading}>
            {signOutAllLoading ? "Kapatılıyor…" : "Tümünü Kapat"}
          </button>
        </div>
      </div>

      {/* Veri & Gizlilik */}
      <div style={s.card}>
        <div style={s.cardH}>Veri & Gizlilik (GDPR)</div>
        <div style={s.row}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#0a1f1a" }}>Verilerimi İndir</div>
            <div style={{ fontSize: 12, color: "#5c7a72", marginTop: 2 }}>
              Üyelik bilgileri ve işlem geçmişinizi JSON formatında indirin.
            </div>
          </div>
          <button style={{ ...s.btn, ...s.btnGh, border: "1px solid #d4ece4" }}
            onClick={downloadData}>
            ↓ İndir
          </button>
        </div>
        <div style={{ ...s.row, borderBottom: "none" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "#DC2626" }}>Şirketten Ayrıl</div>
            <div style={{ fontSize: 12, color: "#5c7a72", marginTop: 2 }}>
              Bu tenant'taki üyeliğinizi kalıcı olarak sonlandırır.
            </div>
          </div>
          <button style={{ ...s.btn, ...s.btnR }} onClick={leaveOrganization} disabled={leaveLoading}>
            {leaveLoading ? "İşleniyor…" : "Ayrıl"}
          </button>
        </div>
      </div>
    </div>
  );
}
