import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { MemberList, ApiKeyList, NewApiKey, WebhookList, NewWebhook, DeliveryList } from "../lib/api.js";

const s: Record<string, React.CSSProperties> = {
  nav:    { background: "#0066CC", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 },
  back:   { color: "rgba(255,255,255,.8)", textDecoration: "none", fontSize: 13 },
  brand:  { fontWeight: 700, fontSize: 18, color: "#fff" },
  page:   { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  h1:     { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub:    { color: "#6B7280", fontSize: 14, marginBottom: 24 },
  tabs:   { display: "flex", gap: 0, borderBottom: "1px solid #E5E7EB", marginBottom: 28 },
  tab:    { padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: "none", color: "#6B7280", borderBottom: "2px solid transparent", marginBottom: -1 },
  tabA:   { color: "#0066CC", borderBottom: "2px solid #0066CC" },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "20px", marginBottom: 16 },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 },
  input:  { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", marginBottom: 12, boxSizing: "border-box" as const },
  select: { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, background: "#fff", marginBottom: 12, boxSizing: "border-box" as const },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #F3F4F6" },
  rowL:   { fontSize: 14 },
  rowR:   { display: "flex", gap: 8, alignItems: "center" },
  badge:  { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  btnSm:  { padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  btnP:   { background: "#0066CC", color: "#fff" },
  btnR:   { background: "#FEE2E2", color: "#DC2626" },
  btnG:   { background: "#D1FAE5", color: "#065F46" },
  btnSec: { background: "#F3F4F6", color: "#374151" },
  err:    { color: "#DC2626", fontSize: 13, marginBottom: 12 },
  ok:     { color: "#059669", fontSize: 13, marginBottom: 12 },
  row2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  mono:   { fontFamily: "monospace", background: "#F3F4F6", padding: "6px 10px", borderRadius: 5, fontSize: 12, wordBreak: "break-all" as const },
  section:{ fontSize: 13, fontWeight: 600, color: "#6B7280", marginBottom: 10, marginTop: 20, textTransform: "uppercase" as const, letterSpacing: ".05em" },
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  owner:    { bg: "#FEF3C7", color: "#92400E" },
  admin:    { bg: "#DBEAFE", color: "#1E40AF" },
  analyst:  { bg: "#D1FAE5", color: "#065F46" },
  viewer:   { bg: "#F3F4F6", color: "#6B7280" },
};

// ── Ekip Sekmesi ─────────────────────────────────────────────────────────────
function TeamTab() {
  const [members, setMembers] = useState<MemberList["members"]>([]);
  const [myRole, setMyRole]   = useState<string>("viewer");
  const [userId, setUserId]   = useState("");
  const [role, setRole]       = useState("analyst");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [ok, setOk]           = useState("");

  useEffect(() => {
    api.members.me().then(r => setMyRole(r.role)).catch(() => {});
    api.members.list().then(r => setMembers(r.members)).catch(() => {});
  }, []);

  const canManage = ["owner", "admin"].includes(myRole);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!userId.trim()) return;
    setErr(""); setSaving(true);
    try {
      await api.members.add({ userId: userId.trim(), role });
      setOk("Üye eklendi.");
      setUserId("");
      const r = await api.members.list();
      setMembers(r.members);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Hata"); }
    setSaving(false);
  }

  async function changeRole(memberId: string, newRole: string) {
    try {
      await api.members.update(memberId, newRole);
      setMembers(prev => prev.map(m => m.userId === memberId ? { ...m, role: newRole } : m));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  async function remove(memberId: string) {
    if (!confirm("Bu üyeyi çıkarmak istediğinizden emin misiniz?")) return;
    try {
      await api.members.remove(memberId);
      setMembers(prev => prev.filter(m => m.userId !== memberId));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Hata"); }
  }

  return (
    <div>
      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Ekip Üyeleri</div>
        {members.length === 0 && <div style={{ color: "#6B7280", fontSize: 13 }}>Henüz üye yok.</div>}
        {members.map((m, i) => {
          const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer;
          return (
            <div key={m.id} style={{ ...s.row, ...(i === members.length - 1 ? { borderBottom: "none" } : {}) }}>
              <div>
                <div style={{ fontSize: 13, fontFamily: "monospace", color: "#374151" }}>{m.userId.slice(0, 18)}...</div>
                <div style={{ fontSize: 11, color: "#9CA3AF" }}>{new Date(m.createdAt).toLocaleDateString("tr-TR")} tarihinde eklendi</div>
              </div>
              <div style={s.rowR}>
                <span style={{ ...s.badge, ...rc }}>{m.role}</span>
                {canManage && (
                  <>
                    <select style={{ padding: "4px 8px", borderRadius: 5, border: "1px solid #D1D5DB", fontSize: 12 }}
                      value={m.role} onChange={e => changeRole(m.userId, e.target.value)}>
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
      </div>

      {canManage && (
        <div style={s.card}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Üye Ekle</div>
          {err && <div style={s.err}>{err}</div>}
          {ok  && <div style={s.ok}>{ok}</div>}
          <form onSubmit={add}>
            <div style={s.row2}>
              <div>
                <label style={s.label}>Kullanıcı ID (UUID)</label>
                <input style={s.input} value={userId} onChange={e => setUserId(e.target.value)}
                  placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" />
              </div>
              <div>
                <label style={s.label}>Rol</label>
                <select style={s.select} value={role} onChange={e => setRole(e.target.value)}>
                  <option value="viewer">Viewer — sadece görüntüle</option>
                  <option value="analyst">Analyst — hesapla ve görüntüle</option>
                  <option value="admin">Admin — tam yönetim</option>
                  {myRole === "owner" && <option value="owner">Owner</option>}
                </select>
              </div>
            </div>
            <button type="submit" style={{ ...s.btnSm, ...s.btnP, padding: "8px 18px", fontSize: 13 }} disabled={saving}>
              {saving ? "Ekleniyor..." : "Ekle"}
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

// ── API Anahtarları Sekmesi ───────────────────────────────────────────────────
const ALL_SCOPES = ["emissions:read", "emissions:write", "cfe:read", "cfe:write", "report:read"];

function ApiKeysTab() {
  const [keys, setKeys]     = useState<ApiKeyList["keys"]>([]);
  const [form, setForm]     = useState({ name: "", scopes: ["emissions:read"], expiresAt: "" });
  const [newKey, setNewKey] = useState<NewApiKey | null>(null);
  const [saving, setSaving] = useState(false);
  const [err, setErr]       = useState("");

  useEffect(() => { api.apiKeys.list().then(r => setKeys(r.keys)).catch(() => {}); }, []);

  async function create(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || form.scopes.length === 0) return;
    setErr(""); setSaving(true);
    try {
      const res = await api.apiKeys.create({
        name: form.name.trim(),
        scopes: form.scopes,
        expiresAt: form.expiresAt || undefined,
      });
      setNewKey(res);
      setForm({ name: "", scopes: ["emissions:read"], expiresAt: "" });
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
      scopes: f.scopes.includes(scope) ? f.scopes.filter(s => s !== scope) : [...f.scopes, scope],
    }));
  }

  return (
    <div>
      {newKey && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#065F46", marginBottom: 8 }}>Anahtar oluşturuldu — yalnızca bir kez gösterilir!</div>
          <div style={s.mono}>{newKey.key}</div>
          <button style={{ ...s.btnSm, ...s.btnG, marginTop: 10 }}
            onClick={() => { navigator.clipboard.writeText(newKey.key); }}>
            Kopyala
          </button>
          <button style={{ ...s.btnSm, ...s.btnSec, marginTop: 10, marginLeft: 8 }}
            onClick={() => setNewKey(null)}>
            Kapat
          </button>
        </div>
      )}

      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Mevcut Anahtarlar</div>
        {keys.length === 0 && <div style={{ color: "#6B7280", fontSize: 13 }}>Henüz API anahtarı yok.</div>}
        {keys.map((k, i) => (
          <div key={k.id} style={{ ...s.row, ...(i === keys.length - 1 ? { borderBottom: "none" } : {}) }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{k.name}</div>
              <div style={{ fontSize: 12, color: "#6B7280", marginTop: 2 }}>
                {k.prefix}·····
                {k.expiresAt && ` · ${new Date(k.expiresAt).toLocaleDateString("tr-TR")} tarihinde sona erer`}
                {k.lastUsedAt && ` · Son kullanım: ${new Date(k.lastUsedAt).toLocaleDateString("tr-TR")}`}
              </div>
              <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                {k.scopes.map(sc => (
                  <span key={sc} style={{ ...s.badge, background: "#EFF6FF", color: "#1D4ED8" }}>{sc}</span>
                ))}
              </div>
            </div>
            <button style={{ ...s.btnSm, ...s.btnR }} onClick={() => revoke(k.id, k.name)}>İptal Et</button>
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Yeni API Anahtarı</div>
        {err && <div style={s.err}>{err}</div>}
        <form onSubmit={create}>
          <div style={s.row2}>
            <div>
              <label style={s.label}>Anahtar Adı *</label>
              <input style={s.input} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Örn: ERP entegrasyonu" required />
            </div>
            <div>
              <label style={s.label}>Son Kullanma Tarihi</label>
              <input style={s.input} type="date" value={form.expiresAt}
                onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))}
                min={new Date().toISOString().slice(0, 10)} />
            </div>
          </div>
          <label style={s.label}>Kapsamlar *</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 14 }}>
            {ALL_SCOPES.map(sc => (
              <label key={sc} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.scopes.includes(sc)} onChange={() => toggleScope(sc)} />
                {sc}
              </label>
            ))}
          </div>
          <button type="submit" style={{ ...s.btnSm, ...s.btnP, padding: "8px 18px", fontSize: 13 }} disabled={saving || form.scopes.length === 0}>
            {saving ? "Oluşturuluyor..." : "Oluştur"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Webhook Sekmesi ───────────────────────────────────────────────────────────
const WEBHOOK_EVENTS = [
  "emission.calculated",
  "period.created",
  "cfe.updated",
  "share_link.created",
];

function WebhooksTab() {
  const [hooks, setHooks]           = useState<WebhookList["webhooks"]>([]);
  const [form, setForm]             = useState({ url: "", events: ["emission.calculated"] });
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
      setForm({ url: "", events: ["emission.calculated"] });
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
    delivered: { bg: "#D1FAE5", color: "#065F46" },
    failed:    { bg: "#FEE2E2", color: "#DC2626" },
    pending:   { bg: "#FEF3C7", color: "#92400E" },
  };

  return (
    <div>
      {newHook && (
        <div style={{ background: "#F0FDF4", border: "1px solid #BBF7D0", borderRadius: 10, padding: 16, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, color: "#065F46", marginBottom: 8 }}>Webhook oluşturuldu — imzalama sırrını kaydedin!</div>
          <div style={{ fontSize: 12, color: "#374151", marginBottom: 4 }}>HMAC-SHA256 imzalama sırrı:</div>
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

      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Mevcut Webhook'lar</div>
        {hooks.length === 0 && <div style={{ color: "#6B7280", fontSize: 13 }}>Henüz webhook yok.</div>}
        {hooks.map((h, i) => (
          <div key={h.id}>
            <div style={{ ...s.row, ...(i === hooks.length - 1 && deliveries?.id !== h.id ? { borderBottom: "none" } : {}) }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{h.url}</div>
                <div style={{ fontSize: 11, color: "#6B7280", marginTop: 3, display: "flex", gap: 4 }}>
                  {h.events.map(ev => <span key={ev} style={{ ...s.badge, background: "#F3F4F6", color: "#374151" }}>{ev}</span>)}
                </div>
              </div>
              <div style={s.rowR}>
                <span style={{ ...s.badge, background: h.active ? "#D1FAE5" : "#F3F4F6", color: h.active ? "#065F46" : "#6B7280" }}>
                  {h.active ? "aktif" : "pasif"}
                </span>
                <button style={{ ...s.btnSm, ...s.btnSec }} onClick={() => showDeliveries(h.id)}>
                  {deliveries?.id === h.id ? "Gizle" : `${h._count.deliveries} teslimat`}
                </button>
                <button style={{ ...s.btnSm, ...s.btnR }} onClick={() => del(h.id, h.url)}>Sil</button>
              </div>
            </div>
            {deliveries?.id === h.id && (
              <div style={{ background: "#F9FAFB", border: "1px solid #E5E7EB", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#6B7280", marginBottom: 8 }}>SON TESLİMATLAR</div>
                {deliveries.list.length === 0 && <div style={{ fontSize: 12, color: "#9CA3AF" }}>Henüz teslimat yok.</div>}
                {deliveries.list.slice(0, 10).map(d => {
                  const sc = STATUS_COLOR[d.status] ?? STATUS_COLOR.pending;
                  return (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #E5E7EB", fontSize: 12 }}>
                      <span style={{ color: "#374151" }}>{d.event}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ ...s.badge, ...sc }}>{d.status}</span>
                        {d.responseStatus && <span style={{ color: "#6B7280" }}>HTTP {d.responseStatus}</span>}
                        <span style={{ color: "#9CA3AF" }}>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleTimeString("tr-TR") : "—"}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ))}
      </div>

      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Yeni Webhook</div>
        {err && <div style={s.err}>{err}</div>}
        <form onSubmit={create}>
          <label style={s.label}>Endpoint URL *</label>
          <input style={s.input} type="url" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
            placeholder="https://your-server.com/webhook" required />
          <label style={s.label}>Olaylar *</label>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" as const, marginBottom: 14 }}>
            {WEBHOOK_EVENTS.map(ev => (
              <label key={ev} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 13, cursor: "pointer" }}>
                <input type="checkbox" checked={form.events.includes(ev)} onChange={() => toggleEvent(ev)} />
                {ev}
              </label>
            ))}
          </div>
          <button type="submit" style={{ ...s.btnSm, ...s.btnP, padding: "8px 18px", fontSize: 13 }} disabled={saving || form.events.length === 0}>
            {saving ? "Oluşturuluyor..." : "Oluştur"}
          </button>
        </form>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
type Tab = "team" | "apikeys" | "webhooks";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("team");

  const tabs: { id: Tab; label: string }[] = [
    { id: "team",     label: "Ekip" },
    { id: "apikeys",  label: "API Anahtarları" },
    { id: "webhooks", label: "Webhook'lar" },
  ];

  return (
    <>
      <nav style={s.nav}>
        <Link to="/" style={s.back}>← Tesisler</Link>
        <span style={s.brand}>Ayarlar</span>
      </nav>
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

        {tab === "team"     && <TeamTab />}
        {tab === "apikeys"  && <ApiKeysTab />}
        {tab === "webhooks" && <WebhooksTab />}
      </div>
    </>
  );
}
