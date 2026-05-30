import { useState, useEffect, Fragment } from "react";
import { api } from "../lib/api.js";
import type { MemberList, MemberItem, PendingInviteList, ApiKeyList, NewApiKey, WebhookList, NewWebhook, DeliveryList, AuditLogList, TenantProfile, IntegrationConfig } from "../lib/api.js";
import { Button, Card, Input } from "../components/ui/index.js";

const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  h1:     { fontSize: 22, fontWeight: 700, marginBottom: 4, color: "var(--text)" },
  sub:    { color: "var(--text-muted)", fontSize: 14, marginBottom: 24 },
  tabs:   { display: "flex", gap: 0, borderBottom: "1px solid var(--border)", marginBottom: 28, overflowX: "auto" as const },
  tab:    { padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: "none", color: "var(--text-muted)", borderBottom: "2px solid transparent", marginBottom: -1, whiteSpace: "nowrap" as const },
  tabA:   { color: "var(--accent)", borderBottom: "2px solid var(--accent)" },
  select: { width: "100%", padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 13, background: "var(--bg-surface)", color: "var(--text-primary)", marginBottom: 12, boxSizing: "border-box" as const },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid var(--border)" },
  rowL:   { fontSize: 14, color: "var(--text-primary)" },
  rowR:   { display: "flex", gap: 8, alignItems: "center" },
  badge:  { display: "inline-block", padding: "2px 8px", borderRadius: "var(--radius-sm)", fontSize: 11, fontWeight: 600 },
  btnSm:  { padding: "5px 12px", borderRadius: "var(--radius-md)", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  btnR:   { background: "var(--bg-subtle)", color: "var(--danger)" },
  btnG:   { background: "var(--bg-subtle)", color: "var(--success)" },
  btnSec: { background: "var(--accent-bg)", color: "var(--text-primary)" },
  err:    { color: "var(--danger)", fontSize: 13, marginBottom: 12 },
  ok:     { color: "var(--success)", fontSize: 13, marginBottom: 12 },
  row2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  mono:   { fontFamily: "monospace", background: "var(--accent-bg)", padding: "6px 10px", borderRadius: "var(--radius-sm)", fontSize: 12, wordBreak: "break-all" as const, color: "var(--text-primary)" },
  section:{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10, marginTop: 20, textTransform: "uppercase" as const, letterSpacing: ".05em" },
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  owner:    { bg: "var(--bg-subtle)", color: "var(--warning)" },
  admin:    { bg: "var(--bg-elevated)", color: "var(--accent)" },
  analyst:  { bg: "var(--bg-subtle)", color: "var(--success)" },
  viewer:   { bg: "var(--bg-base)", color: "var(--text-muted)" },
};

const ROLE_LABELS_FULL: Record<string, string> = {
  viewer:  "Viewer — sadece görüntüle",
  analyst: "Analyst — hesapla ve görüntüle",
  admin:   "Admin — tam yönetim",
  owner:   "Owner — tam yetki",
};

// ── Ekip Sekmesi ─────────────────────────────────────────────────────────────
function MemberAvatar({ member }: { member: MemberItem }) {
  const label = member.displayName ?? member.email ?? member.userId;
  const initials = label.slice(0, 2).toUpperCase();
  const colors = ["var(--accent)", "var(--info)", "#8b5cf6", "var(--warning)", "var(--danger)", "#14b8a6"];
  const color  = colors[label.charCodeAt(0) % colors.length];
  return (
    <div style={{
      width: 34, height: 34, borderRadius: "var(--radius-pill)", background: color,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 12, fontWeight: 800, color: "var(--bg-surface)", flexShrink: 0,
    }}>{initials}</div>
  );
}

function TeamTab() {
  const [members,  setMembers]  = useState<MemberItem[]>([]);
  const [invites,  setInvites]  = useState<PendingInviteList["invites"]>([]);
  const [myRole,   setMyRole]   = useState<string>("viewer");
  const [email,    setEmail]    = useState("");
  const [role,     setRole]     = useState("analyst");
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");
  const [ok,       setOk]       = useState("");
  const [loading,  setLoading]  = useState(true);

  function loadAll() {
    return Promise.all([
      api.members.me().then(r => setMyRole(r.role)).catch(() => {}),
      api.members.list().then(r => setMembers(r.members)).catch(() => {}),
      api.members.invites.list().then(r => setInvites(r.invites)).catch(() => {}),
    ]);
  }

  useEffect(() => { loadAll().finally(() => setLoading(false)); }, []);

  const canManage = ["owner", "admin"].includes(myRole);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setErr(""); setOk(""); setSaving(true);
    try {
      const res = await api.members.invite({ email: email.trim(), role });
      setOk(res.message);
      setEmail("");
      await loadAll();
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Davet gönderilemedi."); }
    setSaving(false);
  }

  async function changeRole(userId: string, newRole: string) {
    try {
      await api.members.update(userId, newRole);
      setMembers(prev => prev.map(m => m.userId === userId ? { ...m, role: newRole } : m));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  async function remove(userId: string) {
    if (!confirm("Bu üyeyi çıkarmak istediğinizden emin misiniz?")) return;
    try {
      await api.members.remove(userId);
      setMembers(prev => prev.filter(m => m.userId !== userId));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  async function cancelInvite(id: string, email: string) {
    if (!confirm(`"${email}" davetini iptal etmek istiyor musunuz?`)) return;
    try {
      await api.members.invites.cancel(id);
      setInvites(prev => prev.filter(i => i.id !== id));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  function timeLeft(expiresAt: string): string {
    const h = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 3600000);
    if (h < 1) return "< 1 saat";
    if (h < 24) return `${h} saat`;
    return `${Math.floor(h / 24)} gün`;
  }

  return (
    <div>
      {/* Aktif üyeler */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 14 }}>Ekip Üyeleri</div>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{members.length} üye</span>
        </div>
        {loading && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Yükleniyor…</div>}
        {!loading && members.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Henüz üye yok.</div>}
        {members.map((m, i) => {
          const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer;
          const isLast = i === members.length - 1;
          return (
            <div key={m.id} style={{ ...s.row, ...(isLast ? { borderBottom: "none" } : {}), gap: 12 }}>
              <MemberAvatar member={m} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {m.displayName ?? m.email ?? m.userId.slice(0, 8) + "…"}
                </div>
                {m.email && (
                  <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{m.email}</div>
                )}
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                  {new Date(m.createdAt).toLocaleDateString("tr-TR")} tarihinde katıldı
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
                <span style={{ ...s.badge, ...rc }}>{m.role}</span>
                {canManage && (
                  <>
                    <select
                      style={{ padding: "4px 8px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12, background: "var(--bg-surface)" }}
                      value={m.role}
                      onChange={e => changeRole(m.userId, e.target.value)}
                    >
                      <option value="viewer">viewer</option>
                      <option value="analyst">analyst</option>
                      <option value="admin">admin</option>
                      {myRole === "owner" && <option value="owner">owner</option>}
                    </select>
                    {myRole === "owner" && (
                      <button style={{ ...s.btnSm, ...s.btnR }} onClick={() => remove(m.userId)}>Çıkar</button>
                    )}
                  </>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      {/* Bekleyen davetler */}
      {invites.length > 0 && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 12 }}>
            Bekleyen Davetler
            <span style={{ marginLeft: 8, background: "var(--bg-subtle)", color: "var(--warning)", borderRadius: "var(--radius-sm)", fontSize: 11, padding: "1px 6px", fontWeight: 600 }}>
              {invites.length}
            </span>
          </div>
          {invites.map((inv, i) => {
            const rc = ROLE_COLORS[inv.role] ?? ROLE_COLORS.viewer;
            return (
              <div key={inv.id} style={{ ...s.row, ...(i === invites.length - 1 ? { borderBottom: "none" } : {}) }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{inv.email}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>
                    <span style={{ ...s.badge, ...rc, marginRight: 6 }}>{inv.role}</span>
                    · {timeLeft(inv.expiresAt)} kaldı · {new Date(inv.createdAt).toLocaleDateString("tr-TR")} gönderildi
                  </div>
                </div>
                {canManage && (
                  <button style={{ ...s.btnSm, ...s.btnR }} onClick={() => cancelInvite(inv.id, inv.email)}>
                    İptal
                  </button>
                )}
              </div>
            );
          })}
        </Card>
      )}

      {/* Davet formu */}
      {canManage && (
        <Card style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Üye Davet Et</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14 }}>
            Platformda kayıtlı değilse 48 saatlik davet bağlantısı gönderilir. Kayıtlıysa direkt eklenir.
          </div>
          {err && <div style={s.err}>{err}</div>}
          {ok  && (
            <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-md)", padding: "10px 14px", fontSize: 13, color: "var(--success)", marginBottom: 12, display: "flex", alignItems: "center", gap: 8 }}>
              ✅ {ok}
            </div>
          )}
          <form onSubmit={invite}>
            <div style={s.row2}>
              <div>
                <Input label="E-posta Adresi" value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="kullanici@sirket.com" required />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>Rol</label>
                <select style={s.select} value={role} onChange={e => setRole(e.target.value)}>
                  {Object.entries(ROLE_LABELS_FULL)
                    .filter(([r]) => r !== "owner" || myRole === "owner")
                    .map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                </select>
              </div>
            </div>
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? "Gönderiliyor…" : "Davet Gönder"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}

// ── API Anahtarları Sekmesi ───────────────────────────────────────────────────
const ALL_SCOPES: { id: string; label: string; desc: string }[] = [
  { id: "ef:read",              label: "EF Okuma",          desc: "Emisyon faktörü verilerini oku (saatlik EF, ülke/şebeke)" },
  { id: "calculation:read",     label: "Hesap Okuma",       desc: "Hesaplama sonuçlarını ve raporları oku" },
  { id: "calculation:write",    label: "Hesap Yazma",       desc: "Yeni hesaplama başlat, veri yükle" },
  { id: "report:read",          label: "Rapor Okuma",       desc: "CBAM, GHG ve CFE raporlarını indir" },
];

const EXPIRY_PRESETS: { label: string; days: number | null }[] = [
  { label: "30 gün",  days: 30 },
  { label: "90 gün",  days: 90 },
  { label: "1 yıl",   days: 365 },
  { label: "Süresiz", days: null },
];

function daysFromNow(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function NewKeyBanner({ keyData, onClose }: { keyData: NewApiKey; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(keyData.key).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    });
  }

  return (
    <div style={{
      background: "var(--bg-base)", border: "2px solid var(--accent)", borderRadius: "var(--radius-lg)",
      padding: "20px 22px", marginBottom: 20,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 12 }}>
        <span style={{ fontSize: 22 }}>🔑</span>
        <div>
          <div style={{ fontWeight: 700, fontSize: 15, color: "var(--success)" }}>
            API anahtarı oluşturuldu!
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
            Bu anahtar <strong>yalnızca bir kez</strong> gösterilir. Güvenli bir yere kopyalayın.
          </div>
        </div>
      </div>

      <div style={{
        background: "var(--bg-surface)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-md)",
        padding: "10px 14px", fontFamily: "monospace", fontSize: 13,
        wordBreak: "break-all", color: "var(--text-primary)", letterSpacing: ".02em",
        marginBottom: 12,
      }}>
        {keyData.key}
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const }}>
        <button
          onClick={copy}
          style={{
            ...s.btnSm, padding: "7px 16px", fontSize: 13,
            background: copied ? "var(--text-secondary)" : "var(--accent)", color: "var(--bg-surface)",
            transition: "background .2s",
          }}
        >
          {copied ? "✓ Kopyalandı!" : "Kopyala"}
        </button>
        <button onClick={onClose} style={{ ...s.btnSm, ...s.btnSec, padding: "7px 14px", fontSize: 13 }}>
          Kapat
        </button>
      </div>
    </div>
  );
}

function ApiKeysTab() {
  const [keys, setKeys]         = useState<ApiKeyList["keys"]>([]);
  const [form, setForm]         = useState({ name: "", scopes: ["ef:read"], expiryPreset: 90 as number | null });
  const [newKey, setNewKey]     = useState<NewApiKey | null>(null);
  const [saving, setSaving]     = useState(false);
  const [err, setErr]           = useState("");
  const [showCurl, setShowCurl] = useState(false);

  useEffect(() => { api.apiKeys.list().then(r => setKeys(r.keys)).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.scopes.length === 0) return;
    setErr(""); setSaving(true);
    try {
      const expiresAt = form.expiryPreset !== null ? daysFromNow(form.expiryPreset) : undefined;
      const res = await api.apiKeys.create({
        name: form.name.trim(),
        scopes: form.scopes,
        expiresAt,
      });
      setNewKey(res);
      setForm({ name: "", scopes: ["ef:read"], expiryPreset: 90 });
      const r = await api.apiKeys.list();
      setKeys(r.keys);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Hata"); }
    setSaving(false);
  }

  async function revoke(id: string, name: string) {
    if (!confirm(`"${name}" anahtarını iptal etmek istediğinizden emin misiniz?`)) return;
    try {
      await api.apiKeys.revoke(id);
      setKeys(prev => prev.filter(k => k.id !== id));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  function toggleScope(scope: string) {
    setForm(f => ({
      ...f,
      scopes: f.scopes.includes(scope) ? f.scopes.filter(sc => sc !== scope) : [...f.scopes, scope],
    }));
  }

  const exampleKey = keys[0]?.prefix ? `${keys[0].prefix}${"x".repeat(28)}` : "vf_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx";

  return (
    <div>
      {newKey && <NewKeyBanner keyData={newKey} onClose={() => setNewKey(null)} />}

      {/* Existing keys */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 14 }}>Mevcut API Anahtarları</div>
        {keys.length === 0 ? (
          <div style={{ color: "var(--text-muted)", fontSize: 13, padding: "8px 0" }}>
            Henüz API anahtarı yok. Aşağıdan yeni bir anahtar oluşturun.
          </div>
        ) : keys.map((k, i) => {
          const expired = k.expiresAt ? new Date(k.expiresAt) < new Date() : false;
          return (
            <div key={k.id} style={{
              display: "flex", justifyContent: "space-between", alignItems: "flex-start",
              padding: "14px 0", gap: 12,
              borderBottom: i < keys.length - 1 ? "1px solid var(--bg-base)" : "none",
            }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" as const }}>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{k.name}</span>
                  {expired && (
                    <span style={{ ...s.badge, background: "var(--bg-subtle)", color: "var(--danger)" }}>Süresi doldu</span>
                  )}
                </div>
                <div style={{ fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)", marginTop: 3 }}>
                  {k.prefix}{"·".repeat(24)}
                </div>
                <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4, display: "flex", gap: 12, flexWrap: "wrap" as const }}>
                  <span>Oluşturuldu: {new Date(k.createdAt).toLocaleDateString("tr-TR")}</span>
                  {k.expiresAt && (
                    <span style={{ color: expired ? "var(--danger)" : undefined }}>
                      Son kullanım: {new Date(k.expiresAt).toLocaleDateString("tr-TR")}
                    </span>
                  )}
                  {k.lastUsedAt && (
                    <span>Son istek: {new Date(k.lastUsedAt).toLocaleDateString("tr-TR")}</span>
                  )}
                </div>
                <div style={{ marginTop: 6, display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                  {k.scopes.map(sc => (
                    <span key={sc} style={{ ...s.badge, background: "var(--accent-bg)", color: "var(--accent)", fontSize: 10.5 }}>{sc}</span>
                  ))}
                </div>
              </div>
              <button style={{ ...s.btnSm, ...s.btnR, flexShrink: 0 }} onClick={() => revoke(k.id, k.name)}>
                İptal
              </button>
            </div>
          );
        })}
      </Card>

      {/* Create new key */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 16 }}>Yeni API Anahtarı Oluştur</div>
        {err && <div style={s.err}>{err}</div>}
        <form onSubmit={create}>
          <Input
            label="Anahtar Adı *"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="Örn: ERP entegrasyonu, CI/CD pipeline"
            required
          />

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>Son Kullanma Tarihi</label>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, flexWrap: "wrap" as const }}>
            {EXPIRY_PRESETS.map(p => (
              <button
                key={p.label}
                type="button"
                onClick={() => setForm(f => ({ ...f, expiryPreset: p.days }))}
                style={{
                  ...s.btnSm,
                  padding: "6px 14px",
                  fontSize: 13,
                  background: form.expiryPreset === p.days ? "var(--accent)" : "var(--bg-base)",
                  color: form.expiryPreset === p.days ? "var(--bg-surface)" : "var(--text-primary)",
                  border: `1px solid ${form.expiryPreset === p.days ? "var(--accent)" : "var(--border)"}`,
                  transition: "all .15s",
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          {form.expiryPreset !== null && (
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 14, marginTop: -8 }}>
              Sona erme: {new Date(daysFromNow(form.expiryPreset)).toLocaleDateString("tr-TR")}
            </div>
          )}

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>Kapsamlar *</label>
          <div style={{ display: "flex", flexDirection: "column" as const, gap: 8, marginBottom: 18 }}>
            {ALL_SCOPES.map(sc => (
              <label key={sc.id} style={{
                display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer",
                padding: "10px 12px", borderRadius: "var(--radius-md)",
                background: form.scopes.includes(sc.id) ? "var(--bg-base)" : "var(--bg-elevated)",
                border: `1px solid ${form.scopes.includes(sc.id) ? "var(--border-accent)" : "var(--border)"}`,
                transition: "all .15s",
              }}>
                <input
                  type="checkbox"
                  checked={form.scopes.includes(sc.id)}
                  onChange={() => toggleScope(sc.id)}
                  style={{ marginTop: 2, flexShrink: 0, accentColor: "var(--accent)" }}
                />
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{sc.id}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>{sc.desc}</div>
                </div>
              </label>
            ))}
          </div>

          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={saving || form.scopes.length === 0}
          >
            {saving ? "Oluşturuluyor..." : "Anahtar Oluştur"}
          </Button>
        </form>
      </Card>

      {/* curl usage guide */}
      <Card style={{ padding: "14px 20px", marginBottom: 16 }}>
        <button
          onClick={() => setShowCurl(v => !v)}
          style={{
            display: "flex", alignItems: "center", gap: 8, width: "100%",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            fontSize: 14, fontWeight: 700, color: "var(--text-primary)", textAlign: "left" as const,
          }}
        >
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>{showCurl ? "▾" : "▸"}</span>
          API Kullanım Rehberi
        </button>
        {showCurl && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 13, color: "var(--text-primary)", marginBottom: 10 }}>
              Voltfox API'sine tüm isteklerde <code style={{ background: "var(--bg-base)", padding: "1px 5px", borderRadius: "var(--radius-sm)" }}>Authorization</code> header'ı ekleyin:
            </div>
            <div style={{ ...s.mono, padding: "12px 14px", fontSize: 12, lineHeight: 1.7 }}>
              {`# Emisyon faktörü verisi çek\ncurl -H "Authorization: Bearer ${exampleKey}" \\\n     https://api.voltfox.io/api/v1/ef?country=TR&grid=EPiAS\n\n# Saatlik hesaplama başlat\ncurl -X POST \\\n     -H "Authorization: Bearer ${exampleKey}" \\\n     -H "Content-Type: application/json" \\\n     -d '{"installationId":"...","periodId":"..."}' \\\n     https://api.voltfox.io/api/v1/calculations`}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
              Rate limit: 100 istek/dakika · Tüm yanıtlar JSON formatındadır.
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ── Webhook Sekmesi ───────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  "ef.updated",
  "calculation.completed",
  "cfe.completed",
  "report.generated",
];

function WebhooksTab() {
  const [hooks, setHooks]           = useState<WebhookList["webhooks"]>([]);
  const [form, setForm]             = useState({ url: "", events: ["calculation.completed"] });
  const [newHook, setNewHook]       = useState<NewWebhook | null>(null);
  const [deliveries, setDeliveries] = useState<{ id: string; list: DeliveryList["deliveries"] } | null>(null);
  const [saving, setSaving]         = useState(false);
  const [err, setErr]               = useState("");

  useEffect(() => { api.webhooks.list().then(r => setHooks(r.webhooks)).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.url.trim() || form.events.length === 0) return;
    setErr(""); setSaving(true);
    try {
      const res = await api.webhooks.create({ url: form.url.trim(), events: form.events });
      setNewHook(res);
      setForm({ url: "", events: ["calculation.completed"] });
      const r = await api.webhooks.list();
      setHooks(r.webhooks);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Hata"); }
    setSaving(false);
  }

  async function del(id: string, url: string) {
    if (!confirm(`"${url}" webhook'unu silmek istediğinizden emin misiniz?`)) return;
    try {
      await api.webhooks.delete(id);
      setHooks(prev => prev.filter(h => h.id !== id));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  async function showDeliveries(id: string) {
    if (deliveries?.id === id) { setDeliveries(null); return; }
    try {
      const r = await api.webhooks.deliveries(id);
      setDeliveries({ id, list: r.deliveries });
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  function toggleEvent(ev: string) {
    setForm(f => ({
      ...f,
      events: f.events.includes(ev) ? f.events.filter(e => e !== ev) : [...f.events, ev],
    }));
  }

  const STATUS_COLOR: Record<string, { bg: string; color: string }> = {
    delivered: { bg: "var(--bg-subtle)", color: "var(--success)" },
    failed:    { bg: "var(--bg-subtle)", color: "var(--danger)" },
    pending:   { bg: "var(--bg-subtle)", color: "var(--warning)" },
  };

  return (
    <div>
      {newHook && (
        <div style={{ background: "var(--bg-base)", border: "1px solid var(--border-accent)", borderRadius: "var(--radius-lg)", padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "var(--success)", marginBottom: 8 }}>Webhook oluşturuldu — imzalama sırrını kaydedin!</div>
          <div style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 4 }}>HMAC-SHA256 imzalama sırrı:</div>
          <div style={s.mono}>{newHook.secret}</div>
          <button style={{ ...s.btnSm, ...s.btnG, marginTop: 10 }}
            onClick={() => navigator.clipboard.writeText(newHook.secret)}>
            Kopyala
          </button>
          <button style={{ ...s.btnSm, ...s.btnSec, marginTop: 10, marginLeft: 8 }}
            onClick={() => setNewHook(null)}>
            Kapat
          </button>
        </div>
      )}

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Mevcut Webhook'lar</div>
        {hooks.length === 0 && <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Henüz webhook yok.</div>}
        {hooks.map((h, i) => (
          <div key={h.id}>
            <div style={{ ...s.row, ...(i === hooks.length - 1 && deliveries?.id !== h.id ? { borderBottom: "none" } : {}) }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{h.url}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 3, display: "flex", gap: 4 }}>
                  {h.events.map(ev => <span key={ev} style={{ ...s.badge, background: "var(--bg-base)", color: "var(--text-primary)" }}>{ev}</span>)}
                </div>
              </div>
              <div style={s.rowR}>
                <span style={{ ...s.badge, background: h.active ? "var(--bg-subtle)" : "var(--bg-base)", color: h.active ? "var(--success)" : "var(--text-muted)" }}>
                  {h.active ? "aktif" : "pasif"}
                </span>
                <button style={{ ...s.btnSm, ...s.btnSec }} onClick={() => showDeliveries(h.id)}>
                  {deliveries?.id === h.id ? "Gizle" : `${h._count.deliveries} teslimat`}
                </button>
                <button style={{ ...s.btnSm, ...s.btnR }} onClick={() => del(h.id, h.url)}>Sil</button>
              </div>
            </div>
            {deliveries?.id === h.id && (
              <div style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>SON TESLİMATLAR</div>
                {deliveries.list.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>Henüz teslimat yok.</div>}
                {deliveries.list.slice(0, 10).map(d => {
                  const sc = STATUS_COLOR[d.status] ?? STATUS_COLOR.pending;
                  return (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid var(--border)", fontSize: 12 }}>
                      <span style={{ color: "var(--text-primary)" }}>{d.event}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ ...s.badge, ...sc }}>{d.status}</span>
                        {d.responseStatus && <span style={{ color: "var(--text-muted)" }}>HTTP {d.responseStatus}</span>}
                        <span style={{ color: "var(--text-muted)" }}>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleTimeString("tr-TR") : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Yeni Webhook</div>
        {err && <div style={s.err}>{err}</div>}
        <form onSubmit={create}>
          <Input label="Endpoint URL *" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://your-server.com/webhook" required />
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>Olaylar *</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 14 }}>
            {WEBHOOK_EVENTS.map(ev => (
              <label key={ev} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                {ev}
              </label>
            ))}
          </div>
          <Button type="submit" variant="primary" size="md" disabled={saving || form.events.length === 0}>
            {saving ? "Oluşturuluyor..." : "Oluştur"}
          </Button>
        </form>
      </Card>
    </div>
  );
}

// ── Audit Trail Sekmesi ───────────────────────────────────────────────────────
type AuditLog = AuditLogList["logs"][0];

const ACTION_BADGE: Record<string, { bg: string; color: string }> = {
  CREATE:    { bg: "var(--bg-subtle)", color: "var(--success)" },
  UPDATE:    { bg: "var(--bg-elevated)", color: "var(--accent)" },
  DELETE:    { bg: "var(--bg-subtle)", color: "var(--danger)" },
  CALCULATE: { bg: "var(--bg-elevated)", color: "var(--info)" },
};

const RESOURCE_OPTIONS = ["", "Installation", "ReportingPeriod", "Tenant", "ApiKey", "Webhook"];
const ACTION_OPTIONS   = ["", "CREATE", "UPDATE", "DELETE", "CALCULATE"];

function AuditTrailTab() {
  const [logs, setLogs]         = useState<AuditLog[]>([]);
  const [nextCursor, setNext]   = useState<string | null>(null);
  const [count, setCount]       = useState<number>(0);
  const [loading, setLoading]   = useState(false);
  const [resource, setResource] = useState("");
  const [action, setAction]     = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo,   setDateTo]   = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr]           = useState("");

  async function load(cursor?: string) {
    setLoading(true); setErr("");
    try {
      const res = await api.auditLogs.list({
        resource: resource || undefined,
        action:   action   || undefined,
        from:     dateFrom || undefined,
        to:       dateTo   || undefined,
        limit:    50,
        cursor:   cursor   || undefined,
      });
      setLogs(prev => cursor ? [...prev, ...res.logs] : res.logs);
      setNext(res.nextCursor);
      setCount(res.count);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Yüklenemedi"); }
    setLoading(false);
  }

  function exportCsv() {
    const header = ["Tarih", "İşlem", "Kaynak", "Kaynak ID", "Kullanıcı ID", "IP", "Payload"];
    const rows   = logs.map(l => [
      new Date(l.createdAt).toISOString(),
      l.action,
      l.resource,
      l.resourceId,
      l.userId ?? "",
      l.ipAddress ?? "",
      JSON.stringify(l.payload).replace(/"/g, '""'),
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url; a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click(); URL.revokeObjectURL(url);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" as const, alignItems: "flex-end" }}>
        <select style={{ ...s.select, width: "auto", marginBottom: 0 }} value={resource} onChange={e => setResource(e.target.value)}>
          {RESOURCE_OPTIONS.map(r => <option key={r} value={r}>{r || "Tüm Kaynaklar"}</option>)}
        </select>
        <select style={{ ...s.select, width: "auto", marginBottom: 0 }} value={action} onChange={e => setAction(e.target.value)}>
          {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a || "Tüm İşlemler"}</option>)}
        </select>
        <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12 }}
          title="Başlangıç tarihi" />
        <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
          style={{ padding: "7px 10px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12 }}
          title="Bitiş tarihi" />
        <button style={{ ...s.btnSm, background: "var(--accent)", color: "var(--bg-surface)", padding: "7px 16px" }} onClick={() => load()}>Filtrele</button>
        {logs.length > 0 && (
          <button style={{ ...s.btnSm, ...s.btnSec, padding: "7px 14px" }} onClick={exportCsv} title="CSV olarak indir">
            ↓ CSV
          </button>
        )}
        {count > 0 && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>{count} kayıt</span>}
      </div>

      {err && <div style={s.err}>{err}</div>}

      <Card style={{ padding: 0, overflow: "hidden", marginBottom: 16 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <thead>
            <tr>
              {["Tarih", "İşlem", "Kaynak", "ID", "Kullanıcı"].map(h => (
                <th key={h} style={{ background: "var(--bg-elevated)", padding: "10px 14px", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ padding: "24px 14px", color: "var(--text-muted)", fontSize: 13, textAlign: "center" as const }}>Kayıt bulunamadı.</td></tr>
            )}
            {logs.map((log, i) => {
              const ac = ACTION_BADGE[log.action] ?? { bg: "var(--bg-base)", color: "var(--text-muted)" };
              const isOpen = expanded === log.id;
              return (
                <Fragment key={log.id}>
                  <tr key={log.id}
                    style={{ borderBottom: "1px solid var(--bg-base)", cursor: "pointer", background: isOpen ? "var(--bg-elevated)" : "transparent" }}
                    onClick={() => setExpanded(isOpen ? null : log.id)}>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", whiteSpace: "nowrap" as const }}>
                      {new Date(log.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ ...s.badge, ...ac }}>{log.action}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>{log.resource}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: "var(--text-primary)" }}>{log.resourceId.slice(0, 8)}…</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {log.userId ? log.userId.slice(0, 8) + "…" : "sistem"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={log.id + "-payload"} style={{ borderBottom: i === logs.length - 1 ? "none" : "1px solid var(--bg-base)" }}>
                      <td colSpan={5} style={{ padding: "0 14px 12px" }}>
                        <div style={{ display: "flex", gap: 8, marginBottom: 6, flexWrap: "wrap" as const }}>
                          {log.ipAddress && <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-base)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>IP: {log.ipAddress}</span>}
                          <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-base)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>ID: {log.id.slice(0, 8)}…</span>
                          <span style={{ fontSize: 11, color: "var(--text-muted)", background: "var(--bg-base)", padding: "2px 8px", borderRadius: "var(--radius-sm)" }}>{new Date(log.createdAt).toLocaleString("tr-TR")}</span>
                        </div>
                        {log.payload && typeof log.payload === "object" && !Array.isArray(log.payload) ? (
                          <table style={{ fontSize: 11, fontFamily: "monospace", borderCollapse: "collapse" as const, width: "100%" }}>
                            <tbody>
                              {Object.entries(log.payload as Record<string, unknown>).map(([k, v]) => (
                                <tr key={k} style={{ borderBottom: "1px solid var(--bg-base)" }}>
                                  <td style={{ padding: "3px 8px", color: "var(--accent)", fontWeight: 700, whiteSpace: "nowrap" as const, width: 1 }}>{k}</td>
                                  <td style={{ padding: "3px 8px", color: "var(--text-primary)", wordBreak: "break-all" as const }}>
                                    {typeof v === "object" ? JSON.stringify(v) : String(v ?? "")}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <pre style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "10px 12px", fontSize: 11, fontFamily: "monospace", overflowX: "auto", margin: 0, color: "var(--text-primary)" }}>
                            {JSON.stringify(log.payload, null, 2)}
                          </pre>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </Card>

      {loading && <div style={{ textAlign: "center", padding: "12px 0", color: "var(--text-muted)", fontSize: 13 }}>Yükleniyor...</div>}
      {nextCursor && !loading && (
        <div style={{ textAlign: "center", marginTop: 12 }}>
          <button style={{ ...s.btnSm, ...s.btnSec, padding: "8px 18px", fontSize: 13 }} onClick={() => load(nextCursor)}>
            Daha Fazla Yükle
          </button>
        </div>
      )}
    </div>
  );
}

// ── Şirket Sekmesi ───────────────────────────────────────────────────────────
const TIMEZONES_EU = [
  "Europe/Istanbul", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Europe/Rome", "Europe/Madrid", "Europe/Amsterdam", "Europe/Warsaw",
  "Europe/Vienna", "Europe/Stockholm", "Europe/Helsinki", "Europe/Athens",
  "Europe/Brussels", "Europe/Lisbon", "Europe/Copenhagen", "Europe/Oslo",
  "UTC",
];

function TenantTab() {
  const [tenant,    setTenant]    = useState<TenantProfile | null>(null);
  const [name,      setName]      = useState("");
  const [logoUrl,   setLogoUrl]   = useState("");
  const [color,     setColor]     = useState("#00b87a");
  const [timezone,  setTimezone]  = useState("Europe/Istanbul");
  const [saving,    setSaving]    = useState(false);
  const [ok,        setOk]        = useState("");
  const [err,       setErr]       = useState("");
  const [myRole,    setMyRole]    = useState("viewer");

  useEffect(() => {
    api.members.me().then(r => setMyRole(r.role)).catch(() => {});
    api.tenant.get().then(r => {
      const t = r.tenant;
      setTenant(t);
      setName(t.name);
      setLogoUrl(t.logoUrl ?? "");
      setColor(t.brandColor ?? "#00b87a");
      setTimezone(t.timezone);
    }).catch(() => {});
  }, []);

  const canEdit = ["owner", "admin"].includes(myRole);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setOk(""); setErr(""); setSaving(true);
    try {
      const res = await api.tenant.update({
        name: name.trim() || undefined,
        logoUrl: logoUrl.trim() || null,
        brandColor: color,
        timezone,
      });
      setTenant(res.tenant);
      setOk("Kaydedildi!");
      setTimeout(() => setOk(""), 3000);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Güncelleme başarısız.");
    } finally {
      setSaving(false);
    }
  }

  if (!tenant) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Yükleniyor…</div>;

  return (
    <div>
      {/* Mevcut bilgiler */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Şirket Kimliği</div>
        <div style={s.row}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Slug (URL)</span>
          <code style={{ fontSize: 12, background: "var(--bg-base)", padding: "3px 8px", borderRadius: "var(--radius-sm)" }}>{tenant.slug}</code>
        </div>
        <div style={{ ...s.row, borderBottom: "none" }}>
          <span style={{ fontSize: 13, color: "var(--text-muted)" }}>Tenant ID</span>
          <code style={{ fontSize: 11, color: "var(--text-muted)" }}>{tenant.id.slice(0, 8)}…</code>
        </div>
      </Card>

      {/* Düzenleme formu */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Profil Özelleştirme</div>
        <form onSubmit={save}>
          <Input label="Şirket Adı" value={name} onChange={e => setName(e.target.value)}
            disabled={!canEdit} placeholder="Şirket adını girin" />

          <Input label="Logo URL" value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
            disabled={!canEdit} placeholder="https://example.com/logo.png (opsiyonel)" />
          {logoUrl && (
            <div style={{ marginBottom: 12 }}>
              <img src={logoUrl} alt="Logo önizleme"
                style={{ maxHeight: 48, maxWidth: 200, borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}
                onError={e => (e.currentTarget.style.display = "none")} />
            </div>
          )}

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>Marka Rengi</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              disabled={!canEdit}
              style={{ width: 44, height: 36, border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
                       cursor: canEdit ? "pointer" : "not-allowed", padding: 2 }} />
            <input style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 13, outline: "none", boxSizing: "border-box" as const, background: "var(--bg-surface)", color: "var(--text-primary)", marginBottom: 0, maxWidth: 110 }} value={color}
              onChange={e => setColor(e.target.value)} disabled={!canEdit}
              placeholder="#00b87a" maxLength={7} />
            <div style={{ width: 36, height: 36, borderRadius: "var(--radius-md)", background: color,
                          border: "1px solid var(--border)", flexShrink: 0 }} />
          </div>

          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>Zaman Dilimi</label>
          <select style={s.select} value={timezone} onChange={e => setTimezone(e.target.value)}
            disabled={!canEdit}>
            {TIMEZONES_EU.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>

          {!canEdit && (
            <div style={{ fontSize: 12, color: "var(--warning)", background: "var(--bg-subtle)",
                          padding: "8px 12px", borderRadius: "var(--radius-md)", marginBottom: 12 }}>
              Bu ayarları değiştirmek için admin veya owner yetkisi gereklidir.
            </div>
          )}
          {ok  && <div style={s.ok}>{ok}</div>}
          {err && <div style={s.err}>{err}</div>}
          {canEdit && (
            <Button type="submit" variant="primary" size="md" disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </Button>
          )}
        </form>
      </Card>
    </div>
  );
}

// ── İzin Matrisi Sekmesi ─────────────────────────────────────────────────────
type Role = "owner" | "admin" | "analyst" | "viewer";

const ROLE_LABELS: Record<Role, string> = {
  owner:   "Owner",
  admin:   "Admin",
  analyst: "Analyst",
  viewer:  "Viewer",
};

const ROLE_COLORS_DEF: Record<Role, { bg: string; color: string }> = {
  owner:   { bg: "var(--bg-subtle)", color: "var(--warning)" },
  admin:   { bg: "var(--bg-elevated)", color: "var(--accent)" },
  analyst: { bg: "var(--bg-subtle)", color: "var(--success)" },
  viewer:  { bg: "var(--bg-base)", color: "var(--text-muted)" },
};

interface PermRow { feature: string; owner: boolean; admin: boolean; analyst: boolean; viewer: boolean; }

const PERMISSION_MATRIX: PermRow[] = [
  { feature: "Tesis görüntüleme",            owner: true,  admin: true,  analyst: true,  viewer: true  },
  { feature: "Dönem görüntüleme",            owner: true,  admin: true,  analyst: true,  viewer: true  },
  { feature: "Rapor indirme",                owner: true,  admin: true,  analyst: true,  viewer: true  },
  { feature: "EF veri servisi",              owner: true,  admin: true,  analyst: true,  viewer: true  },
  { feature: "GEC hesaplama",               owner: true,  admin: true,  analyst: true,  viewer: false },
  { feature: "CFE matching",                owner: true,  admin: true,  analyst: true,  viewer: false },
  { feature: "CBAM emisyon hesaplama",      owner: true,  admin: true,  analyst: true,  viewer: false },
  { feature: "Dönem oluşturma/düzenleme",   owner: true,  admin: true,  analyst: true,  viewer: false },
  { feature: "Tesis oluşturma/düzenleme",   owner: true,  admin: true,  analyst: false, viewer: false },
  { feature: "Tesis silme",                 owner: true,  admin: true,  analyst: false, viewer: false },
  { feature: "Üye davet",                   owner: true,  admin: true,  analyst: false, viewer: false },
  { feature: "Üye rolü değiştirme",         owner: true,  admin: true,  analyst: false, viewer: false },
  { feature: "API anahtarı oluşturma",      owner: true,  admin: true,  analyst: false, viewer: false },
  { feature: "Webhook yönetimi",            owner: true,  admin: true,  analyst: false, viewer: false },
  { feature: "Şirket profili düzenleme",    owner: true,  admin: true,  analyst: false, viewer: false },
  { feature: "Üye çıkarma",                 owner: true,  admin: false, analyst: false, viewer: false },
  { feature: "Owner atama",                 owner: true,  admin: false, analyst: false, viewer: false },
];

function PermissionsTab() {
  const roles: Role[] = ["owner", "admin", "analyst", "viewer"];

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Rol Açıklamaları</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16, lineHeight: 1.6 }}>
          Her rol, platforma farklı düzeyde erişim sağlar. Roller hiyerarşiktir: üst roller alt rollerin tüm yetkilerini içerir.
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 8 }}>
          {roles.map(r => {
            const rc = ROLE_COLORS_DEF[r];
            const descs: Record<Role, string> = {
              owner:   "Tam yetki. Rol değiştirme, silme, owner atama dahil.",
              admin:   "Tesis, üye, API, webhook yönetimi. Silme hariç her şey.",
              analyst: "Hesaplama ve analiz. Tesis/üye yönetimi yok.",
              viewer:  "Yalnızca görüntüleme. Veri değiştirme yok.",
            };
            return (
              <div key={r} style={{ padding: "12px 14px", borderRadius: "var(--radius-md)",
                                     background: rc.bg, border: `1px solid var(--border)` }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: rc.color, marginBottom: 4 }}>
                  {ROLE_LABELS[r]}
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", lineHeight: 1.5 }}>{descs[r]}</div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Özellik Erişim Matrisi</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "2px solid var(--border)" }}>
                <th style={{ textAlign: "left", padding: "8px 12px", color: "var(--text-muted)",
                             fontWeight: 700, fontSize: 12, width: "55%" }}>Özellik</th>
                {roles.map(r => {
                  const rc = ROLE_COLORS_DEF[r];
                  return (
                    <th key={r} style={{ textAlign: "center", padding: "8px 12px", width: "12.5%" }}>
                      <span style={{ background: rc.bg, color: rc.color, padding: "3px 10px",
                                     borderRadius: "var(--radius-pill)", fontSize: 11, fontWeight: 700,
                                     display: "inline-block" }}>{ROLE_LABELS[r]}</span>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {PERMISSION_MATRIX.map((row, i) => (
                <tr key={i} style={{ borderBottom: "1px solid var(--bg-base)",
                                      background: i % 2 === 0 ? "transparent" : "var(--bg-elevated)" }}>
                  <td style={{ padding: "8px 12px", color: "var(--text-primary)" }}>{row.feature}</td>
                  {roles.map(r => (
                    <td key={r} style={{ textAlign: "center", padding: "8px 12px" }}>
                      {row[r]
                        ? <span style={{ color: "var(--accent)", fontSize: 16 }}>✓</span>
                        : <span style={{ color: "var(--border)", fontSize: 14 }}>—</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

// ── Abonelik Sekmesi ─────────────────────────────────────────────────────────
import type { TenantSubscription } from "../lib/api.js";

function UsageBar({ used, limit, label }: { used: number; limit: number; label: string }) {
  const pct = Math.min((used / limit) * 100, 100);
  const color = pct >= 90 ? "var(--danger)" : pct >= 70 ? "var(--warning)" : "var(--accent)";
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13,
                    color: "var(--text-primary)", marginBottom: 6 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        <span style={{ color: "var(--text-muted)" }}>{used} / {limit}</span>
      </div>
      <div style={{ height: 8, borderRadius: "var(--radius-pill)", background: "var(--bg-base)", overflow: "hidden" }}>
        <div style={{ width: `${pct}%`, height: "100%", background: color,
                      borderRadius: "var(--radius-pill)", transition: "width .4s" }} />
      </div>
    </div>
  );
}

const PLAN_FEATURES: Record<string, string[]> = {
  free:       ["5 tesis", "3 kullanıcı", "Temel GEC hesaplama", "7 günlük EF verisi"],
  starter:    ["20 tesis", "10 kullanıcı", "Tam GEC + CFE", "1 yıllık EF verisi", "CSV export"],
  pro:        ["Sınırsız tesis", "50 kullanıcı", "Tüm özellikler", "XML export", "Webhook", "API erişimi"],
  enterprise: ["Sınırsız her şey", "Özel SLA", "Öncelikli destek", "SSO", "Denetim desteği"],
};

function SubscriptionTab() {
  const [sub, setSub] = useState<TenantSubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.tenant.subscription()
      .then(setSub)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Yükleniyor…</div>;
  if (!sub) return <div style={{ color: "var(--danger)", fontSize: 13 }}>Abonelik bilgisi yüklenemedi.</div>;

  const planColor = sub.plan === "free" ? "var(--text-muted)" : sub.plan === "enterprise" ? "var(--info)" : "var(--accent)";
  const features  = PLAN_FEATURES[sub.plan] ?? PLAN_FEATURES.free;

  return (
    <div>
      {/* Mevcut plan */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase",
                          letterSpacing: ".08em", marginBottom: 4 }}>Aktif Plan</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: planColor }}>{sub.planName}</div>
            {sub.planExpires && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
                Bitiş: {new Date(sub.planExpires).toLocaleDateString("tr-TR")}
              </div>
            )}
            {!sub.planExpires && sub.plan !== "free" && (
              <div style={{ fontSize: 12, color: "var(--accent)", marginTop: 4 }}>Süresiz</div>
            )}
          </div>
          <div style={{ background: "var(--accent-bg)", border: "1px solid var(--border-accent)",
                        borderRadius: "var(--radius-lg)", padding: "12px 16px", minWidth: 140 }}>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 6, fontWeight: 600 }}>Plan Kapsamı</div>
            {features.map((f, i) => (
              <div key={i} style={{ fontSize: 12, color: "var(--text-primary)", marginBottom: 3 }}>
                <span style={{ color: planColor, marginRight: 5 }}>✓</span>{f}
              </div>
            ))}
          </div>
        </div>
      </Card>

      {/* Kullanım */}
      <Card style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Kullanım Limitleri</div>
        <UsageBar used={sub.usage.seats}    limit={sub.limits.seats}    label="Kullanıcılar" />
        <UsageBar used={sub.usage.installs} limit={sub.limits.installs} label="Tesisler" />
      </Card>

      {/* Plan yükseltme */}
      {sub.plan !== "enterprise" && (
        <Card style={{ background: "var(--bg-base)", border: "1px solid var(--border-accent)", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 4 }}>Planınızı Yükseltin</div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14, lineHeight: 1.6 }}>
            Daha fazla tesis, kullanıcı ve gelişmiş özellikler için plan yükseltin.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 16 }}>
            {(["starter", "pro", "enterprise"] as const)
              .filter(p => p !== sub.plan)
              .map(plan => {
                const fc = PLAN_FEATURES[plan] ?? [];
                const pc = plan === "enterprise" ? "var(--info)" : "var(--accent)";
                const prices: Record<string, string> = { starter: "€99/ay", pro: "€299/ay", enterprise: "Özel fiyat" };
                return (
                  <div key={plan} style={{ border: "1px solid var(--border)", borderRadius: "var(--radius-md)",
                                            padding: "14px", background: "var(--bg-surface)" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: pc, marginBottom: 4,
                                   textTransform: "capitalize" }}>
                      {PLAN_FEATURES[plan] ? plan.charAt(0).toUpperCase() + plan.slice(1) : plan}
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", marginBottom: 8 }}>
                      {prices[plan]}
                    </div>
                    {fc.slice(0, 3).map((f, i) => (
                      <div key={i} style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 2 }}>
                        <span style={{ color: pc, marginRight: 4 }}>✓</span>{f}
                      </div>
                    ))}
                  </div>
                );
              })}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Plan değişikliği için: <a href="mailto:sales@voltfox.io" style={{ color: "var(--accent)" }}>sales@voltfox.io</a>
          </div>
        </Card>
      )}
    </div>
  );
}

// ── Bildirimler Sekmesi ───────────────────────────────────────────────────────
function NotificationsTab() {
  const [prefs, setPrefs] = useState<import("../lib/api.js").NotificationPrefs | null>(null);
  const [saving, setSaving] = useState(false);
  const [ok, setOk]         = useState("");

  useEffect(() => { api.notifications.preferences().then(setPrefs); }, []);

  async function toggle(key: keyof import("../lib/api.js").NotificationPrefs) {
    if (!prefs) return;
    const updated = { ...prefs, [key]: !prefs[key] };
    setPrefs(updated);
    setSaving(true); setOk("");
    try {
      await api.notifications.updatePrefs({ [key]: updated[key] });
      setOk("Kaydedildi.");
    } catch { /* revert */ setPrefs(prefs); }
    setSaving(false);
  }

  if (!prefs) return <div style={{ color: "var(--text-muted)", fontSize: 13 }}>Yükleniyor...</div>;

  const EVENT_ROWS: { key: keyof import("../lib/api.js").NotificationPrefs; label: string; desc: string }[] = [
    { key: "calculationDone", label: "SEE Hesaplama Tamamlandı",  desc: "Bir dönem SEE hesabı tamamlandığında bildirim al" },
    { key: "cfeDone",         label: "CFE Eşleştirme Tamamlandı", desc: "CFE matching analizi bittiğinde bildirim al" },
    { key: "memberInvited",   label: "Ekip Daveti Gönderildi",    desc: "Bir üye davet edildiğinde bildirim al" },
    { key: "periodCreated",   label: "Yeni Dönem Oluşturuldu",    desc: "Yeni bir üretim dönemi eklendiğinde bildirim al" },
  ];

  return (
    <div>
      {ok && <div style={s.ok}>{ok}</div>}

      <div style={s.section}>Uygulama İçi Bildirimler</div>
      <Card style={{ marginBottom: 16 }}>
        {EVENT_ROWS.map(row => (
          <div key={row.key} style={{ ...s.row, alignItems: "center" }}>
            <div>
              <div style={s.rowL}>{row.label}</div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{row.desc}</div>
            </div>
            <button
              style={{
                width: 44, height: 24, borderRadius: "var(--radius-pill)", border: "none", cursor: "pointer",
                background: prefs[row.key] ? "var(--accent)" : "var(--border)", transition: "background .2s",
                position: "relative" as const,
              }}
              onClick={() => toggle(row.key)}
              disabled={saving}
              title={prefs[row.key] ? "Açık — tıklayarak kapat" : "Kapalı — tıklayarak aç"}
            >
              <span style={{
                position: "absolute" as const, top: 3,
                left:  prefs[row.key] ? 22 : 3,
                width: 18, height: 18, borderRadius: "var(--radius-pill)", background: "var(--bg-surface)",
                transition: "left .2s",
              }} />
            </button>
          </div>
        ))}
      </Card>

      <div style={s.section}>E-posta Bildirimleri</div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ ...s.row, alignItems: "center" }}>
          <div>
            <div style={s.rowL}>E-posta Bildirimleri</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Etkinleştirilen olaylar için hesap e-postanıza bildirim gönderilir</div>
          </div>
          <button
            style={{
              width: 44, height: 24, borderRadius: "var(--radius-pill)", border: "none", cursor: "pointer",
              background: prefs.emailEnabled ? "var(--accent)" : "var(--border)", transition: "background .2s",
              position: "relative" as const,
            }}
            onClick={() => toggle("emailEnabled")}
            disabled={saving}
          >
            <span style={{
              position: "absolute" as const, top: 3,
              left:  prefs.emailEnabled ? 22 : 3,
              width: 18, height: 18, borderRadius: "var(--radius-pill)", background: "var(--bg-surface)",
              transition: "left .2s",
            }} />
          </button>
        </div>
        {prefs.emailEnabled && (
          <div style={{ padding: "10px 0 4px", fontSize: 12, color: "var(--text-muted)" }}>
            Yukarıda etkinleştirilmiş olaylar için e-posta gönderilir. RESEND_API_KEY ortam değişkeni sunucuda ayarlanmış olmalıdır.
          </div>
        )}
      </Card>
    </div>
  );
}

// ── MCP Servers Bölümü ───────────────────────────────────────────────────────
interface McpServer { name: string; type: "sse" | "stdio" | "http"; url: string; enabled: boolean; }

function McpServersSection() {
  const [servers,  setServers]  = useState<McpServer[]>([]);
  const [form,     setForm]     = useState<McpServer>({ name: "", type: "sse", url: "", enabled: true });
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  function load() {
    api.integrations.list().then(r => {
      const cfg = r.integrations.find(i => i.key === "mcp-servers");
      const list = (cfg?.config as unknown as { servers?: McpServer[] })?.servers ?? [];
      setServers(list);
    }).catch(() => {});
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!form.name.trim() || !form.url.trim()) { setErr("Ad ve URL zorunludur."); return; }
    setSaving(true); setErr("");
    try {
      const updated = [...servers, { ...form, name: form.name.trim(), url: form.url.trim() }];
      await api.integrations.save("mcp-servers", { config: { servers: JSON.stringify(updated) }, enabled: true });
      setServers(updated);
      setForm({ name: "", type: "sse", url: "", enabled: true });
      setShowForm(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Kaydetme hatası"); }
    setSaving(false);
  }

  async function remove(idx: number) {
    const updated = servers.filter((_, i) => i !== idx);
    try {
      await api.integrations.save("mcp-servers", { config: { servers: JSON.stringify(updated) }, enabled: updated.length > 0 });
      setServers(updated);
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Silme hatası"); }
  }

  async function toggle(idx: number) {
    const updated = servers.map((s, i) => i === idx ? { ...s, enabled: !s.enabled } : s);
    try {
      await api.integrations.save("mcp-servers", { config: { servers: JSON.stringify(updated) }, enabled: true });
      setServers(updated);
    } catch { /* ignore */ }
  }

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            🔌 MCP Servers
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Model Context Protocol sunucuları — Claude'un araç olarak kullanabileceği harici servisler
          </div>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(f => !f)}>
          {showForm ? "İptal" : "+ Ekle"}
        </Button>
      </div>

      {servers.length === 0 && !showForm && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" as const, padding: "16px 0" }}>
          Henüz MCP server eklenmemiş.
        </div>
      )}

      {servers.map((srv, idx) => (
        <div key={idx} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
          background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: 8, border: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 18 }}>{srv.type === "sse" ? "📡" : srv.type === "stdio" ? "⚙️" : "🌐"}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{srv.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{srv.type.toUpperCase()} · {srv.url}</div>
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, cursor: "pointer", flexShrink: 0 }}>
            <input type="checkbox" checked={srv.enabled} onChange={() => toggle(idx)} />
            {srv.enabled ? "Aktif" : "Pasif"}
          </label>
          <button style={{ ...s.btnSm, ...s.btnR, flexShrink: 0 }} onClick={() => remove(idx)}>Sil</button>
        </div>
      ))}

      {showForm && (
        <div style={{ background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", padding: "14px", border: "1px solid var(--border)", marginTop: 8 }}>
          <div style={s.row2}>
            <div>
              <Input label="Server Adı *" value={form.name} placeholder="örn: Filesystem, Slack"
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>Protokol</label>
              <select style={s.select} value={form.type}
                onChange={e => setForm(f => ({ ...f, type: e.target.value as McpServer["type"] }))}>
                <option value="sse">SSE (Server-Sent Events)</option>
                <option value="http">HTTP (Streamable HTTP)</option>
                <option value="stdio">stdio (Komut satırı)</option>
              </select>
            </div>
          </div>
          <Input
            label={form.type === "stdio" ? "Komut / Çalıştırılabilir *" : "Endpoint URL *"}
            value={form.url}
            placeholder={form.type === "stdio" ? "npx -y @modelcontextprotocol/server-filesystem /path" : "https://mcp.example.com/sse"}
            onChange={e => setForm(f => ({ ...f, url: e.target.value }))} />
          {err && <div style={s.err}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size="sm" onClick={save} disabled={saving}>
              {saving ? "Kaydediliyor..." : "Ekle"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => { setShowForm(false); setErr(""); }}>İptal</Button>
          </div>
        </div>
      )}
    </Card>
  );
}

// ── Claude Skill.md Bölümü ────────────────────────────────────────────────────
function ClaudeSkillsSection() {
  const [skills,   setSkills]   = useState<Array<{ name: string; content: string }>>([]);
  const [editing,  setEditing]  = useState<number | null>(null);
  const [draft,    setDraft]    = useState({ name: "", content: "" });
  const [showNew,  setShowNew]  = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [err,      setErr]      = useState("");

  function load() {
    api.integrations.list().then(r => {
      const cfg = r.integrations.find(i => i.key === "claude-skills");
      const list = (cfg?.config as unknown as { skills?: Array<{ name: string; content: string }> })?.skills ?? [];
      setSkills(list);
    }).catch(() => {});
  }
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function saveSkill() {
    if (!draft.name.trim() || !draft.content.trim()) { setErr("Ad ve içerik zorunludur."); return; }
    setSaving(true); setErr("");
    try {
      const updated = editing !== null
        ? skills.map((s, i) => i === editing ? { ...draft } : s)
        : [...skills, { ...draft }];
      await api.integrations.save("claude-skills", { config: { skills: JSON.stringify(updated) }, enabled: true });
      setSkills(updated);
      setDraft({ name: "", content: "" });
      setEditing(null); setShowNew(false);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Kaydetme hatası"); }
    setSaving(false);
  }

  async function removeSkill(idx: number) {
    if (!confirm("Bu skill'i silmek istediğinizden emin misiniz?")) return;
    const updated = skills.filter((_, i) => i !== idx);
    try {
      await api.integrations.save("claude-skills", { config: { skills: JSON.stringify(updated) }, enabled: updated.length > 0 });
      setSkills(updated);
      if (editing === idx) { setEditing(null); setDraft({ name: "", content: "" }); }
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Silme hatası"); }
  }

  const PLACEHOLDER = `---
name: voltfox-engineering
description: Voltfox teknik mühendislik asistanı
---

Sen Voltfox'un teknik sahibisin. CBAM, GHG Protocol ve ISO 14064-1 gereksinimlerini
teknik tasarıma yansıtan kıdemli bir yazılım mühendisi gibi düşün.`;

  const isOpen = showNew || editing !== null;

  return (
    <Card style={{ marginBottom: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, display: "flex", alignItems: "center", gap: 8 }}>
            📄 Claude Skill.md Dosyaları
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            Claude Code CLI skill tanımları — Claude'un davranışını özelleştiren sistem promptlar
          </div>
        </div>
        {!isOpen && (
          <Button variant="primary" size="sm" onClick={() => { setDraft({ name: "", content: "" }); setShowNew(true); }}>
            + Yeni Skill
          </Button>
        )}
      </div>

      {skills.length === 0 && !isOpen && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", textAlign: "center" as const, padding: "16px 0" }}>
          Henüz skill tanımı eklenmemiş.
        </div>
      )}

      {!isOpen && skills.map((skill, idx) => (
        <div key={idx} style={{
          display: "flex", alignItems: "center", gap: 10, padding: "8px 12px",
          background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", marginBottom: 8, border: "1px solid var(--border)",
        }}>
          <span style={{ fontSize: 18 }}>📋</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{skill.name}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {skill.content.slice(0, 80)}...
            </div>
          </div>
          <button style={{ ...s.btnSm, ...s.btnSec, flexShrink: 0 }}
            onClick={() => { setDraft({ ...skill }); setEditing(idx); }}>Düzenle</button>
          <button style={{ ...s.btnSm, ...s.btnR, flexShrink: 0 }} onClick={() => removeSkill(idx)}>Sil</button>
        </div>
      ))}

      {isOpen && (
        <div style={{ marginTop: 8 }}>
          <Input label="Skill Adı *" value={draft.name} placeholder="örn: voltfox-engineering"
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))} />
          <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>skill.md İçeriği *</label>
          <textarea
            value={draft.content}
            onChange={e => setDraft(d => ({ ...d, content: e.target.value }))}
            placeholder={PLACEHOLDER}
            rows={14}
            style={{
              width: "100%", padding: "8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)",
              fontSize: 12, outline: "none", marginBottom: 10, boxSizing: "border-box" as const,
              background: "var(--bg-surface)", color: "var(--text-primary)",
              fontFamily: "monospace", lineHeight: 1.6,
              resize: "vertical" as const, minHeight: 200,
            }}
          />
          {err && <div style={s.err}>{err}</div>}
          <div style={{ display: "flex", gap: 8 }}>
            <Button variant="primary" size="sm" onClick={saveSkill} disabled={saving}>
              {saving ? "Kaydediliyor..." : editing !== null ? "Güncelle" : "Kaydet"}
            </Button>
            <Button variant="secondary" size="sm"
              onClick={() => { setShowNew(false); setEditing(null); setDraft({ name: "", content: "" }); setErr(""); }}>
              İptal
            </Button>
            {editing !== null && (
              <button style={{ ...s.btnSm, ...s.btnR }} onClick={() => removeSkill(editing!)}>Sil</button>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: 14, padding: "10px 14px", background: "var(--bg-subtle)", borderRadius: "var(--radius-md)", border: "1px solid var(--warning)", fontSize: 12, color: "var(--warning)", lineHeight: 1.6 }}>
        <strong>Nasıl kullanılır?</strong> Skill.md dosyaları Claude Code CLI'da <code>/.voltfox-engineering</code> gibi slash komutları olarak çalışır.
        Bu sayfada oluşturduğunuz tanımlar ekip genelinde paylaşılır.
      </div>
    </Card>
  );
}

// ── AI Modeller Sekmesi ───────────────────────────────────────────────────────
const AI_PROVIDERS: Array<{
  key: string; name: string; icon: string; desc: string;
  fields: Array<{ id: string; label: string; placeholder: string }>;
}> = [
  {
    key: "anthropic", name: "Anthropic Claude", icon: "🤖",
    desc: "ESG Co-Pilot için birincil model. Claude Sonnet ile canvas'ı doğal dilde düzenleyin.",
    fields: [{ id: "apiKey", label: "API Anahtarı", placeholder: "sk-ant-api03-..." }],
  },
  {
    key: "openai", name: "OpenAI GPT-4o", icon: "🟢",
    desc: "Anthropic anahtarı yoksa ESG Co-Pilot otomatik olarak GPT-4o kullanır.",
    fields: [{ id: "apiKey", label: "API Anahtarı", placeholder: "sk-proj-..." }],
  },
  {
    key: "gemini", name: "Google Gemini", icon: "💎",
    desc: "Anthropic ve OpenAI anahtarı yoksa Gemini 2.0 Flash kullanılır.",
    fields: [{ id: "apiKey", label: "API Anahtarı", placeholder: "AIzaSy..." }],
  },
];

const AI_STATUS_BADGE: Record<string, { bg: string; color: string; label: string }> = {
  connected:    { bg: "var(--bg-subtle)", color: "var(--success)", label: "Bağlı" },
  disconnected: { bg: "var(--bg-subtle)", color: "var(--warning)", label: "Yapılandırılmamış" },
  error:        { bg: "var(--bg-subtle)", color: "var(--danger)", label: "Hata" },
  beta:         { bg: "var(--bg-elevated)", color: "var(--accent)", label: "Beta" },
  coming_soon:  { bg: "var(--bg-elevated)", color: "var(--text-muted)", label: "Yakında" },
};

function AiModelsTab() {
  const [configs,         setConfigs]         = useState<Record<string, IntegrationConfig>>({});
  const [forms,           setForms]           = useState<Record<string, Record<string, string>>>({});
  const [saving,          setSaving]          = useState<Record<string, boolean>>({});
  const [testing,         setTesting]         = useState<Record<string, boolean>>({});
  const [testResult,      setTestResult]      = useState<Record<string, { ok: boolean; message: string } | null>>({});
  const [showKey,         setShowKey]         = useState<Record<string, boolean>>({});
  const [saveErrors,      setSaveErrors]      = useState<Record<string, string | null>>({});
  const [confirmRemoveKey, setConfirmRemoveKey] = useState<string | null>(null);

  function refreshConfigs() {
    return api.integrations.list().then(r => {
      const map: Record<string, IntegrationConfig> = {};
      for (const intg of r.integrations) {
        if (["anthropic", "openai", "gemini"].includes(intg.key)) map[intg.key] = intg;
      }
      setConfigs(map);
    }).catch(() => {});
  }

  useEffect(() => { refreshConfigs(); }, []);

  async function save(key: string) {
    const form = forms[key] ?? {};
    if (!Object.values(form).some(v => v.trim())) return;
    setSaving(p => ({ ...p, [key]: true }));
    setSaveErrors(p => ({ ...p, [key]: null }));
    try {
      await api.integrations.save(key, { config: form, enabled: true });
      await refreshConfigs();
      setForms(p => ({ ...p, [key]: {} }));
      setTestResult(p => ({ ...p, [key]: null }));
    } catch (e: unknown) {
      setSaveErrors(p => ({ ...p, [key]: e instanceof Error ? e.message : "Kaydetme başarısız" }));
    }
    setSaving(p => ({ ...p, [key]: false }));
  }

  async function test(key: string) {
    setTesting(p => ({ ...p, [key]: true }));
    setTestResult(p => ({ ...p, [key]: null }));
    try {
      const res = await api.integrations.test(key);
      setTestResult(p => ({ ...p, [key]: { ok: res.ok, message: res.message } }));
      refreshConfigs();
    } catch (e: unknown) {
      setTestResult(p => ({ ...p, [key]: { ok: false, message: e instanceof Error ? e.message : "Test başarısız" } }));
    }
    setTesting(p => ({ ...p, [key]: false }));
  }

  async function remove(key: string) {
    if (confirmRemoveKey !== key) { setConfirmRemoveKey(key); return; }
    setConfirmRemoveKey(null);
    setSaveErrors(p => ({ ...p, [key]: null }));
    try {
      await api.integrations.delete(key);
      setConfigs(p => { const n = { ...p }; delete n[key]; return n; });
      setTestResult(p => ({ ...p, [key]: null }));
    } catch (e: unknown) {
      setSaveErrors(p => ({ ...p, [key]: e instanceof Error ? e.message : "Silme başarısız" }));
    }
  }

  return (
    <div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
        ESG Co-Pilot ve diğer AI özellikleri için harici AI sağlayıcılarının API anahtarlarını yapılandırın.
        Anahtarlar şifrelenmiş olarak saklanır ve kayıt sonrası tam değerleri gösterilmez.
      </div>

      {AI_PROVIDERS.map(provider => {
        const cfg        = configs[provider.key];
        const form       = forms[provider.key] ?? {};
        const isSaving   = saving[provider.key];
        const isTesting  = testing[provider.key];
        const result     = testResult[provider.key];
        const status     = cfg?.status ?? "disconnected";
        const badge      = AI_STATUS_BADGE[status] ?? AI_STATUS_BADGE.disconnected;
        const hasNewValue = Object.values(form).some(v => v.trim());

        return (
          <Card key={provider.key} style={{ marginBottom: 16 }}>
            {/* Başlık satırı */}
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontSize: 26 }}>{provider.icon}</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{provider.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, maxWidth: 380, lineHeight: 1.5 }}>
                    {provider.desc}
                  </div>
                </div>
              </div>
              <span style={{ ...s.badge, background: badge.bg, color: badge.color, flexShrink: 0, marginLeft: 12 }}>
                {badge.label}
              </span>
            </div>

            {/* Son test bilgisi */}
            {cfg?.lastTestedAt && (
              <div style={{ fontSize: 11, color: "var(--text-muted)", marginBottom: 12, padding: "6px 10px",
                            background: "var(--bg-elevated)", borderRadius: "var(--radius-md)", border: "1px solid var(--border)" }}>
                Son test: {new Date(cfg.lastTestedAt).toLocaleString("tr-TR")}
                {cfg.testMessage && (
                  <span style={{ marginLeft: 6, color: status === "connected" ? "var(--success)" : "var(--danger)" }}>
                    · {cfg.testMessage}
                  </span>
                )}
              </div>
            )}

            {/* API Anahtarı alanı */}
            {provider.fields.map(field => (
              <div key={field.id}>
                <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: "var(--text-primary)", marginBottom: 5 }}>
                  {field.label}
                  {cfg && (
                    <span style={{ fontSize: 11, color: "var(--text-muted)", fontWeight: 400, marginLeft: 8 }}>
                      (kayıtlı — değiştirmek için yeni değer girin)
                    </span>
                  )}
                </label>
                <div style={{ position: "relative" as const }}>
                  <input
                    style={{ width: "100%", padding: "8px 40px 8px 12px", borderRadius: "var(--radius-md)", border: "1px solid var(--border)", fontSize: 12, outline: "none", marginBottom: 12, boxSizing: "border-box" as const, background: "var(--bg-surface)", color: "var(--text-primary)", fontFamily: "monospace" }}
                    type={showKey[`${provider.key}:${field.id}`] ? "text" : "password"}
                    value={form[field.id] ?? ""}
                    onChange={e => setForms(p => ({
                      ...p,
                      [provider.key]: { ...(p[provider.key] ?? {}), [field.id]: e.target.value },
                    }))}
                    placeholder={cfg ? "••••••••••••••••••••••" : field.placeholder}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey(p => ({ ...p, [`${provider.key}:${field.id}`]: !p[`${provider.key}:${field.id}`] }))}
                    style={{
                      position: "absolute", right: 10, top: "50%", transform: "translateY(-56%)",
                      background: "none", border: "none", cursor: "pointer",
                      color: "var(--text-muted)", fontSize: 15, padding: 0, lineHeight: 1,
                    }}
                    title={showKey[`${provider.key}:${field.id}`] ? "Gizle" : "Göster"}
                    tabIndex={-1}
                  >
                    {showKey[`${provider.key}:${field.id}`] ? "🙈" : "👁"}
                  </button>
                </div>
              </div>
            ))}

            {/* Test sonucu */}
            {result && (
              <div style={{
                padding: "9px 12px", borderRadius: "var(--radius-md)", marginBottom: 14,
                background: result.ok ? "var(--bg-base)" : "var(--bg-subtle)",
                border: `1px solid ${result.ok ? "var(--border-accent)" : "var(--danger)"}`,
                fontSize: 13, color: result.ok ? "var(--success)" : "var(--danger)",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span>{result.ok ? "✅" : "❌"}</span>
                <span>{result.message}</span>
              </div>
            )}

            {/* Kaydetme / silme hatası */}
            {saveErrors[provider.key] && (
              <div style={{
                padding: "8px 12px", borderRadius: "var(--radius-md)", marginBottom: 14,
                background: "var(--bg-subtle)", border: "1px solid var(--danger)",
                fontSize: 13, color: "var(--danger)",
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span>❌</span>
                <span>{saveErrors[provider.key]}</span>
                <button onClick={() => setSaveErrors(p => ({ ...p, [provider.key]: null }))}
                  style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--danger)", fontSize: 14, lineHeight: 1 }}>×</button>
              </div>
            )}

            {/* Butonlar */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" as const, alignItems: "center" }}>
              <button
                style={{ ...s.btnSm, background: "var(--accent)", color: "var(--bg-surface)", padding: "7px 18px", fontSize: 13 }}
                onClick={() => save(provider.key)}
                disabled={isSaving || !hasNewValue}
              >
                {isSaving ? "Kaydediliyor..." : "Kaydet"}
              </button>
              {cfg && (
                <>
                  <button
                    style={{ ...s.btnSm, ...s.btnG, padding: "7px 18px", fontSize: 13 }}
                    onClick={() => test(provider.key)}
                    disabled={isTesting}
                  >
                    {isTesting ? "Test ediliyor..." : "Bağlantıyı Test Et"}
                  </button>
                  {confirmRemoveKey === provider.key ? (
                    <>
                      <span style={{ fontSize: 12, color: "var(--danger)", fontWeight: 600 }}>Emin misiniz?</span>
                      <button
                        style={{ ...s.btnSm, ...s.btnR, padding: "7px 14px", fontSize: 13 }}
                        onClick={() => remove(provider.key)}
                      >
                        Evet, kaldır
                      </button>
                      <button
                        style={{ ...s.btnSm, ...s.btnSec, padding: "7px 12px", fontSize: 13 }}
                        onClick={() => setConfirmRemoveKey(null)}
                      >
                        İptal
                      </button>
                    </>
                  ) : (
                    <button
                      style={{ ...s.btnSm, ...s.btnR, padding: "7px 16px", fontSize: 13 }}
                      onClick={() => remove(provider.key)}
                    >
                      Kaldır
                    </button>
                  )}
                </>
              )}
            </div>
          </Card>
        );
      })}

      <Card style={{ background: "var(--bg-base)", border: "1px solid var(--info)", marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4, color: "var(--info)" }}>
          Co-Pilot nasıl çalışır?
        </div>
        <div style={{ fontSize: 12, color: "var(--text-primary)", lineHeight: 1.7 }}>
          En az bir API anahtarı yapılandırın. Öncelik sırası: <strong>Anthropic → OpenAI → Gemini</strong>.<br />
          ESG Playground ekranında <strong>"AI"</strong> sekmesine geçerek doğal dilde komut verebilirsiniz.<br />
          Örnek: <em>"Berlin fabrikamı ekle, DE şebekesine bağla ve CBAM hesap motoru ekle"</em>
        </div>
      </Card>

      <McpServersSection />
      <ClaudeSkillsSection />
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
type Tab = "team" | "company" | "subscription" | "permissions" | "apikeys" | "webhooks" | "audit" | "notifications" | "ai-models";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("team");

  const tabs: { id: Tab; label: string }[] = [
    { id: "team",         label: "Ekip" },
    { id: "company",      label: "Şirket" },
    { id: "subscription", label: "Abonelik" },
    { id: "permissions",  label: "İzinler" },
    { id: "ai-models",     label: "AI Modeller" },
    { id: "apikeys",       label: "API Anahtarları" },
    { id: "webhooks",      label: "Webhook'lar" },
    { id: "notifications", label: "Bildirimler" },
    { id: "audit",         label: "Audit Trail" },
  ];

  return (
    <div style={s.page}>
      <div style={s.h1}>Ayarlar</div>
      <div style={s.sub}>Ekip üyeleri, API anahtarları ve webhook entegrasyonları</div>

      <div style={s.tabs}>
        {tabs.map(t => (
          <button key={t.id} style={{ ...s.tab, ...(tab === t.id ? s.tabA : {}) }}
            onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === "team"         && <TeamTab />}
      {tab === "company"      && <TenantTab />}
      {tab === "subscription" && <SubscriptionTab />}
      {tab === "permissions"  && <PermissionsTab />}
      {tab === "ai-models"    && <AiModelsTab />}
      {tab === "apikeys"      && <ApiKeysTab />}
      {tab === "webhooks"      && <WebhooksTab />}
      {tab === "notifications" && <NotificationsTab />}
      {tab === "audit"         && <AuditTrailTab />}
    </div>
  );
}
