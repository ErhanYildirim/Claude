import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";
import { api } from "../lib/api.js";
import type { NotificationPrefs } from "../lib/api.js";
import { Button, Card, Input } from "../components/ui/index.js";

const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 720, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 },
  sub:    { fontSize: 14, color: "var(--text-muted)", marginBottom: 28 },
  cardH:  { fontSize: 13, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 },
  ok:     { fontSize: 13, color: "var(--success)", marginBottom: 12, fontWeight: 500 },
  err:    { fontSize: 13, color: "var(--danger)", marginBottom: 12, fontWeight: 500 },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "11px 0", borderBottom: "1px solid var(--bg-elevated)" },
  avatarBig: {
    width: 80, height: 80, borderRadius: "var(--radius-pill)", flexShrink: 0,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 30, fontWeight: 800, color: "var(--bg-surface)",
    background: "var(--accent)",
  },
  inputReadonly: {
    width: "100%", padding: "9px 12px", borderRadius: "var(--radius-md)",
    border: "1px solid var(--border)", fontSize: 14, outline: "none",
    marginBottom: 14, boxSizing: "border-box" as const,
    background: "var(--bg-elevated)", color: "var(--text-muted)", cursor: "not-allowed",
    display: "block", lineHeight: "1.5",
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
  const [prefs,            setPrefs]             = useState<NotificationPrefs | null>(null);
  const [prefsSaving,      setPrefsSaving]       = useState(false);

  useEffect(() => {
    if (user?.user_metadata?.display_name) {
      setDisplayName(user.user_metadata.display_name as string);
    }
    api.notifications.preferences().then(setPrefs).catch(() => {});
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
      <Card style={{ display: "flex", alignItems: "center", gap: 20, marginBottom: 16 }}>
        <div style={s.avatarBig}>{avatar}</div>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>
            {name || email}
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{email}</div>
          <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
            Kullanıcı ID: {user?.id?.slice(0, 8)}…
          </div>
        </div>
      </Card>

      {/* İsim değiştir */}
      <Card style={{ marginBottom: 16 }}>
        <div style={s.cardH}>Görünen Ad</div>
        <form onSubmit={saveName}>
          <div style={{ marginBottom: 14 }}>
            <Input
              label="Ad Soyad"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Adınızı girin"
            />
          </div>
          {nameOk  && <div style={s.ok}>Kaydedildi!</div>}
          {nameErr && <div style={s.err}>{nameErr}</div>}
          <Button variant="primary" type="submit" disabled={nameSaving}>
            {nameSaving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </form>
      </Card>

      {/* E-posta (read-only) */}
      <Card style={{ marginBottom: 16 }}>
        <div style={s.cardH}>E-posta Adresi</div>
        <div style={s.inputReadonly}>
          {email}
        </div>
        <div style={{ fontSize: 12, color: "#94a3b8" }}>
          E-posta değişikliği için yöneticinizle iletişime geçin.
        </div>
      </Card>

      {/* Şifre değiştir */}
      <Card style={{ marginBottom: 16 }}>
        <div style={s.cardH}>Şifre Değiştir</div>
        <form onSubmit={changePassword}>
          <div style={{ marginBottom: 14 }}>
            <Input
              label="Mevcut Şifre"
              type="password"
              value={currentPwd}
              onChange={e => setCurrentPwd(e.target.value)}
              placeholder="Mevcut şifrenizi girin (doğrulama için)"
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Input
              label="Yeni Şifre"
              type="password"
              value={newPwd}
              onChange={e => setNewPwd(e.target.value)}
              placeholder="En az 8 karakter"
            />
          </div>
          <div style={{ marginBottom: 14 }}>
            <Input
              label="Yeni Şifre (Tekrar)"
              type="password"
              value={confirmPwd}
              onChange={e => setConfirmPwd(e.target.value)}
              placeholder="Şifreyi tekrar girin"
            />
          </div>
          {pwdOk  && <div style={s.ok}>Şifre başarıyla değiştirildi!</div>}
          {pwdErr && <div style={s.err}>{pwdErr}</div>}
          <Button variant="primary" type="submit" disabled={pwdSaving}>
            {pwdSaving ? "Değiştiriliyor…" : "Şifreyi Değiştir"}
          </Button>
        </form>
      </Card>

      {/* Oturum yönetimi */}
      <Card style={{ marginBottom: 16 }}>
        <div style={s.cardH}>Oturum Yönetimi</div>
        <div style={{ ...s.row, borderBottom: "none" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Tüm Oturumları Kapat</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Tüm cihaz ve tarayıcılardaki oturumları sonlandırır.
            </div>
          </div>
          <Button variant="danger" onClick={signOutAll} disabled={signOutAllLoading}>
            {signOutAllLoading ? "Kapatılıyor…" : "Tümünü Kapat"}
          </Button>
        </div>
      </Card>

      {/* Bildirim Tercihleri */}
      {prefs && (
        <Card style={{ marginBottom: 16 }}>
          <div style={s.cardH}>Bildirim Tercihleri</div>
          {([
            { key: "calculationDone", label: "Emisyon hesaplama tamamlandı" },
            { key: "cfeDone",         label: "CFE matching tamamlandı" },
            { key: "memberInvited",   label: "Yeni üye davet edildi" },
            { key: "periodCreated",   label: "Yeni dönem oluşturuldu" },
          ] as const).map(({ key, label }) => (
            <div key={key} style={{ ...s.row, ...(key === "periodCreated" ? { borderBottom: "none" } : {}) }}>
              <div style={{ fontSize: 14, color: "var(--text-primary)" }}>{label}</div>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
                <input type="checkbox"
                  checked={prefs[key]}
                  disabled={prefsSaving}
                  onChange={async e => {
                    const updated = { ...prefs, [key]: e.target.checked };
                    setPrefs(updated);
                    setPrefsSaving(true);
                    await api.notifications.updatePrefs({ [key]: e.target.checked }).catch(() => {});
                    setPrefsSaving(false);
                  }}
                  style={{ width: 16, height: 16, accentColor: "var(--accent)" }} />
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{prefs[key] ? "Açık" : "Kapalı"}</span>
              </label>
            </div>
          ))}
        </Card>
      )}

      {/* Veri & Gizlilik */}
      <Card style={{ marginBottom: 16 }}>
        <div style={s.cardH}>Veri & Gizlilik (GDPR)</div>
        <div style={s.row}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Verilerimi İndir</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Üyelik bilgileri ve işlem geçmişinizi JSON formatında indirin.
            </div>
          </div>
          <Button variant="secondary" onClick={downloadData}>
            ↓ İndir
          </Button>
        </div>
        <div style={{ ...s.row, borderBottom: "none" }}>
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--danger)" }}>Şirketten Ayrıl</div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Bu tenant'taki üyeliğinizi kalıcı olarak sonlandırır.
            </div>
          </div>
          <Button variant="danger" onClick={leaveOrganization} disabled={leaveLoading}>
            {leaveLoading ? "İşleniyor…" : "Ayrıl"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
