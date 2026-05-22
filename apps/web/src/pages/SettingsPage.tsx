import { useState, useEffect, Fragment } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { MemberList, ApiKeyList, NewApiKey, WebhookList, NewWebhook, DeliveryList, AuditLogList, TenantProfile } from "../lib/api.js";

const s: Record<string, React.CSSProperties> = {
  nav:    { background: "#00b87a", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", gap: 12 },
  back:   { color: "rgba(255,255,255,.8)", textDecoration: "none", fontSize: 13 },
  brand:  { fontWeight: 700, fontSize: 18, color: "#fff" },
  page:   { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  h1:     { fontSize: 22, fontWeight: 700, marginBottom: 4 },
  sub:    { color: "#5c7a72", fontSize: 14, marginBottom: 24 },
  tabs:   { display: "flex", gap: 0, borderBottom: "1px solid #d4ece4", marginBottom: 28 },
  tab:    { padding: "10px 20px", fontSize: 14, fontWeight: 600, cursor: "pointer", border: "none", background: "none", color: "#5c7a72", borderBottom: "2px solid transparent", marginBottom: -1 },
  tabA:   { color: "#00b87a", borderBottom: "2px solid #00b87a" },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 16 },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#1a3530", marginBottom: 5 },
  input:  { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, outline: "none", marginBottom: 12, boxSizing: "border-box" as const },
  select: { width: "100%", padding: "8px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 13, background: "#fff", marginBottom: 12, boxSizing: "border-box" as const },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eef7f3" },
  rowL:   { fontSize: 14 },
  rowR:   { display: "flex", gap: 8, alignItems: "center" },
  badge:  { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  btnSm:  { padding: "5px 12px", borderRadius: 6, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600 },
  btnP:   { background: "#00b87a", color: "#fff" },
  btnR:   { background: "#FEE2E2", color: "#DC2626" },
  btnG:   { background: "#D1FAE5", color: "#065F46" },
  btnSec: { background: "#eef7f3", color: "#1a3530" },
  err:    { color: "#DC2626", fontSize: 13, marginBottom: 12 },
  ok:     { color: "#059669", fontSize: 13, marginBottom: 12 },
  row2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  mono:   { fontFamily: "monospace", background: "#eef7f3", padding: "6px 10px", borderRadius: 5, fontSize: 12, wordBreak: "break-all" as const },
  section:{ fontSize: 13, fontWeight: 600, color: "#5c7a72", marginBottom: 10, marginTop: 20, textTransform: "uppercase" as const, letterSpacing: ".05em" },
};

const ROLE_COLORS: Record<string, { bg: string; color: string }> = {
  owner:    { bg: "#FEF3C7", color: "#92400E" },
  admin:    { bg: "#DBEAFE", color: "#009966" },
  analyst:  { bg: "#D1FAE5", color: "#065F46" },
  viewer:   { bg: "#eef7f3", color: "#5c7a72" },
};

const ROLE_LABELS_FULL: Record<string, string> = {
  viewer:  "Viewer — sadece görüntüle",
  analyst: "Analyst — hesapla ve görüntüle",
  admin:   "Admin — tam yönetim",
  owner:   "Owner — tam yetki",
};

// ── Ekip Sekmesi ─────────────────────────────────────────────────────────────
function TeamTab() {
  const [members, setMembers] = useState<MemberList["members"]>([]);
  const [myRole, setMyRole]   = useState<string>("viewer");
  const [email, setEmail]     = useState("");
  const [role, setRole]       = useState("analyst");
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState("");
  const [ok, setOk]           = useState("");

  useEffect(() => {
    api.members.me().then(r => setMyRole(r.role)).catch(() => {});
    api.members.list().then(r => setMembers(r.members)).catch(() => {});
  }, []);

  const canManage = ["owner", "admin"].includes(myRole);

  async function invite(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setErr(""); setOk(""); setSaving(true);
    try {
      const res = await api.members.invite({ email: email.trim(), role });
      setOk(res.message);
      setEmail("");
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
        {members.length === 0 && <div style={{ color: "#5c7a72", fontSize: 13 }}>Henüz üye yok.</div>}
        {members.map((m, i) => {
          const rc = ROLE_COLORS[m.role] ?? ROLE_COLORS.viewer;
          return (
            <div key={m.id} style={{ ...s.row, ...(i === members.length - 1 ? { borderBottom: "none" } : {}) }}>
              <div>
                <div style={{ fontSize: 13, color: "#1a3530", fontFamily: "monospace" }}>
                  {m.userId.slice(0, 8)}…
                </div>
                <div style={{ fontSize: 11, color: "#5c7a72" }}>
                  {new Date(m.createdAt).toLocaleDateString("tr-TR")} tarihinde eklendi
                </div>
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
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Üye Davet Et</div>
          {err && <div style={s.err}>{err}</div>}
          {ok  && <div style={s.ok}>{ok}</div>}
          <form onSubmit={invite}>
            <div style={s.row2}>
              <div>
                <label style={s.label}>E-posta Adresi</label>
                <input
                  style={s.input}
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="kullanici@sirket.com"
                  required
                />
              </div>
              <div>
                <label style={s.label}>Rol</label>
                <select style={s.select} value={role} onChange={e => setRole(e.target.value)}>
                  {Object.entries(ROLE_LABELS_FULL)
                    .filter(([r]) => r !== "owner" || myRole === "owner")
                    .map(([r, l]) => <option key={r} value={r}>{l}</option>)}
                </select>
              </div>
            </div>
            <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 10 }}>
              Platformda kayıtlı değilse davet e-postası gönderilir. Kayıtlıysa direkt eklenir.
            </div>
            <button type="submit" style={{ ...s.btnSm, ...s.btnP, padding: "8px 18px", fontSize: 13 }} disabled={saving}>
              {saving ? "Gönderiliyor..." : "Davet Et"}
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
        {keys.length === 0 && <div style={{ color: "#5c7a72", fontSize: 13 }}>Henüz API anahtarı yok.</div>}
        {keys.map((k, i) => (
          <div key={k.id} style={{ ...s.row, ...(i === keys.length - 1 ? { borderBottom: "none" } : {}) }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600 }}>{k.name}</div>
              <div style={{ fontSize: 12, color: "#5c7a72", marginTop: 2 }}>
                {k.prefix}·····
                {k.expiresAt && ` · ${new Date(k.expiresAt).toLocaleDateString("tr-TR")} tarihinde sona erer`}
                {k.lastUsedAt && ` · Son kullanım: ${new Date(k.lastUsedAt).toLocaleDateString("tr-TR")}`}
              </div>
              <div style={{ marginTop: 4, display: "flex", gap: 4, flexWrap: "wrap" as const }}>
                {k.scopes.map(sc => (
                  <span key={sc} style={{ ...s.badge, background: "#e6f9f2", color: "#009966" }}>{sc}</span>
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
          <div style={{ fontSize: 12, color: "#1a3530", marginBottom: 4 }}>HMAC-SHA256 imzalama sırrı:</div>
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
        {hooks.length === 0 && <div style={{ color: "#5c7a72", fontSize: 13 }}>Henüz webhook yok.</div>}
        {hooks.map((h, i) => (
          <div key={h.id}>
            <div style={{ ...s.row, ...(i === hooks.length - 1 && deliveries?.id !== h.id ? { borderBottom: "none" } : {}) }}>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, fontFamily: "monospace" }}>{h.url}</div>
                <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 3, display: "flex", gap: 4 }}>
                  {h.events.map(ev => <span key={ev} style={{ ...s.badge, background: "#eef7f3", color: "#1a3530" }}>{ev}</span>)}
                </div>
              </div>
              <div style={s.rowR}>
                <span style={{ ...s.badge, background: h.active ? "#D1FAE5" : "#eef7f3", color: h.active ? "#065F46" : "#5c7a72" }}>
                  {h.active ? "aktif" : "pasif"}
                </span>
                <button style={{ ...s.btnSm, ...s.btnSec }} onClick={() => showDeliveries(h.id)}>
                  {deliveries?.id === h.id ? "Gizle" : `${h._count.deliveries} teslimat`}
                </button>
                <button style={{ ...s.btnSm, ...s.btnR }} onClick={() => del(h.id, h.url)}>Sil</button>
              </div>
            </div>
            {deliveries?.id === h.id && (
              <div style={{ background: "#f4fbf8", border: "1px solid #d4ece4", borderRadius: 8, padding: 12, marginBottom: 8 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "#5c7a72", marginBottom: 8 }}>SON TESLİMATLAR</div>
                {deliveries.list.length === 0 && <div style={{ fontSize: 12, color: "#5c7a72" }}>Henüz teslimat yok.</div>}
                {deliveries.list.slice(0, 10).map(d => {
                  const sc = STATUS_COLOR[d.status] ?? STATUS_COLOR.pending;
                  return (
                    <div key={d.id} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #d4ece4", fontSize: 12 }}>
                      <span style={{ color: "#1a3530" }}>{d.event}</span>
                      <div style={{ display: "flex", gap: 8 }}>
                        <span style={{ ...s.badge, ...sc }}>{d.status}</span>
                        {d.responseStatus && <span style={{ color: "#5c7a72" }}>HTTP {d.responseStatus}</span>}
                        <span style={{ color: "#5c7a72" }}>{d.deliveredAt ? new Date(d.deliveredAt).toLocaleTimeString("tr-TR") : "—"}</span>
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

// ── Audit Trail Sekmesi ───────────────────────────────────────────────────────
type AuditLog = AuditLogList["logs"][0];

const ACTION_BADGE: Record<string, { bg: string; color: string }> = {
  CREATE:    { bg: "#D1FAE5", color: "#065F46" },
  UPDATE:    { bg: "#DBEAFE", color: "#009966" },
  DELETE:    { bg: "#FEE2E2", color: "#DC2626" },
  CALCULATE: { bg: "#F3E8FF", color: "#6D28D9" },
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
  const [expanded, setExpanded] = useState<string | null>(null);
  const [err, setErr]           = useState("");

  async function load(cursor?: string) {
    setLoading(true); setErr("");
    try {
      const res = await api.auditLogs.list({
        resource: resource || undefined,
        action:   action   || undefined,
        limit:    50,
        cursor:   cursor   || undefined,
      });
      setLogs(prev => cursor ? [...prev, ...res.logs] : res.logs);
      setNext(res.nextCursor);
      setCount(res.count);
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Yüklenemedi"); }
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  return (
    <div>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap" as const, alignItems: "flex-end" }}>
        <select style={{ ...s.select, width: "auto", marginBottom: 0 }} value={resource} onChange={e => setResource(e.target.value)}>
          {RESOURCE_OPTIONS.map(r => <option key={r} value={r}>{r || "Tüm Kaynaklar"}</option>)}
        </select>
        <select style={{ ...s.select, width: "auto", marginBottom: 0 }} value={action} onChange={e => setAction(e.target.value)}>
          {ACTION_OPTIONS.map(a => <option key={a} value={a}>{a || "Tüm İşlemler"}</option>)}
        </select>
        <button style={{ ...s.btnSm, ...s.btnP, padding: "7px 16px" }} onClick={() => load()}>Filtrele</button>
        {count > 0 && <span style={{ fontSize: 12, color: "#5c7a72" }}>{count} kayıt</span>}
      </div>

      {err && <div style={s.err}>{err}</div>}

      <div style={{ ...s.card, padding: 0, overflow: "hidden" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" as const }}>
          <thead>
            <tr>
              {["Tarih", "İşlem", "Kaynak", "ID", "Kullanıcı"].map(h => (
                <th key={h} style={{ background: "#f4fbf8", padding: "10px 14px", textAlign: "left" as const, fontSize: 12, fontWeight: 600, color: "#5c7a72", borderBottom: "1px solid #d4ece4" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 && !loading && (
              <tr><td colSpan={5} style={{ padding: "24px 14px", color: "#5c7a72", fontSize: 13, textAlign: "center" as const }}>Kayıt bulunamadı.</td></tr>
            )}
            {logs.map((log, i) => {
              const ac = ACTION_BADGE[log.action] ?? { bg: "#eef7f3", color: "#5c7a72" };
              const isOpen = expanded === log.id;
              return (
                <Fragment key={log.id}>
                  <tr key={log.id}
                    style={{ borderBottom: "1px solid #eef7f3", cursor: "pointer", background: isOpen ? "#f4fbf8" : "transparent" }}
                    onClick={() => setExpanded(isOpen ? null : log.id)}>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#5c7a72", whiteSpace: "nowrap" as const }}>
                      {new Date(log.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td style={{ padding: "10px 14px" }}>
                      <span style={{ ...s.badge, ...ac }}>{log.action}</span>
                    </td>
                    <td style={{ padding: "10px 14px", fontSize: 13 }}>{log.resource}</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, fontFamily: "monospace", color: "#1a3530" }}>{log.resourceId.slice(0, 8)}…</td>
                    <td style={{ padding: "10px 14px", fontSize: 12, color: "#5c7a72", fontFamily: "monospace" }}>
                      {log.userId ? log.userId.slice(0, 8) + "…" : "sistem"}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr key={log.id + "-payload"} style={{ borderBottom: i === logs.length - 1 ? "none" : "1px solid #eef7f3" }}>
                      <td colSpan={5} style={{ padding: "0 14px 12px" }}>
                        <pre style={{ background: "#f4fbf8", borderRadius: 6, padding: "10px 12px", fontSize: 11, fontFamily: "monospace", overflowX: "auto", margin: 0, color: "#1a3530" }}>
                          {JSON.stringify(log.payload, null, 2)}
                        </pre>
                        {log.ipAddress && <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 4 }}>IP: {log.ipAddress}</div>}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {loading && <div style={{ textAlign: "center", padding: "12px 0", color: "#5c7a72", fontSize: 13 }}>Yükleniyor...</div>}
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

  if (!tenant) return <div style={{ color: "#5c7a72", fontSize: 13 }}>Yükleniyor…</div>;

  return (
    <div>
      {/* Mevcut bilgiler */}
      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 12 }}>Şirket Kimliği</div>
        <div style={s.row}>
          <span style={{ fontSize: 13, color: "#5c7a72" }}>Slug (URL)</span>
          <code style={{ fontSize: 12, background: "#eef7f3", padding: "3px 8px", borderRadius: 5 }}>{tenant.slug}</code>
        </div>
        <div style={{ ...s.row, borderBottom: "none" }}>
          <span style={{ fontSize: 13, color: "#5c7a72" }}>Tenant ID</span>
          <code style={{ fontSize: 11, color: "#94a3b8" }}>{tenant.id.slice(0, 8)}…</code>
        </div>
      </div>

      {/* Düzenleme formu */}
      <div style={s.card}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 16 }}>Profil Özelleştirme</div>
        <form onSubmit={save}>
          <label style={s.label}>Şirket Adı</label>
          <input style={s.input} value={name} onChange={e => setName(e.target.value)}
            disabled={!canEdit} placeholder="Şirket adını girin" />

          <label style={s.label}>Logo URL</label>
          <input style={s.input} value={logoUrl} onChange={e => setLogoUrl(e.target.value)}
            disabled={!canEdit} placeholder="https://example.com/logo.png (opsiyonel)" />
          {logoUrl && (
            <div style={{ marginBottom: 12 }}>
              <img src={logoUrl} alt="Logo önizleme"
                style={{ maxHeight: 48, maxWidth: 200, borderRadius: 6, border: "1px solid #d4ece4" }}
                onError={e => (e.currentTarget.style.display = "none")} />
            </div>
          )}

          <label style={s.label}>Marka Rengi</label>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 14 }}>
            <input type="color" value={color} onChange={e => setColor(e.target.value)}
              disabled={!canEdit}
              style={{ width: 44, height: 36, border: "1px solid #d4ece4", borderRadius: 6,
                       cursor: canEdit ? "pointer" : "not-allowed", padding: 2 }} />
            <input style={{ ...s.input, marginBottom: 0, maxWidth: 110 }} value={color}
              onChange={e => setColor(e.target.value)} disabled={!canEdit}
              placeholder="#00b87a" maxLength={7} />
            <div style={{ width: 36, height: 36, borderRadius: 8, background: color,
                          border: "1px solid rgba(0,0,0,.1)", flexShrink: 0 }} />
          </div>

          <label style={s.label}>Zaman Dilimi</label>
          <select style={s.select} value={timezone} onChange={e => setTimezone(e.target.value)}
            disabled={!canEdit}>
            {TIMEZONES_EU.map(tz => <option key={tz} value={tz}>{tz}</option>)}
          </select>

          {!canEdit && (
            <div style={{ fontSize: 12, color: "#d97706", background: "#fef3c7",
                          padding: "8px 12px", borderRadius: 6, marginBottom: 12 }}>
              Bu ayarları değiştirmek için admin veya owner yetkisi gereklidir.
            </div>
          )}
          {ok  && <div style={s.ok}>{ok}</div>}
          {err && <div style={s.err}>{err}</div>}
          {canEdit && (
            <button type="submit" style={{ ...s.btnSm, ...s.btnP, padding: "9px 20px" }}
              disabled={saving}>
              {saving ? "Kaydediliyor…" : "Kaydet"}
            </button>
          )}
        </form>
      </div>
    </div>
  );
}

// ── Ana Sayfa ─────────────────────────────────────────────────────────────────
type Tab = "team" | "company" | "apikeys" | "webhooks" | "audit";

export default function SettingsPage() {
  const [tab, setTab] = useState<Tab>("team");

  const tabs: { id: Tab; label: string }[] = [
    { id: "team",     label: "Ekip" },
    { id: "company",  label: "Şirket" },
    { id: "apikeys",  label: "API Anahtarları" },
    { id: "webhooks", label: "Webhook'lar" },
    { id: "audit",    label: "Audit Trail" },
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
        {tab === "company"  && <TenantTab />}
        {tab === "apikeys"  && <ApiKeysTab />}
        {tab === "webhooks" && <WebhooksTab />}
        {tab === "audit"    && <AuditTrailTab />}
      </div>
    </>
  );
}
