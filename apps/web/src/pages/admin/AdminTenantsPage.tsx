import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

interface Tenant {
  id:        string;
  name:      string;
  slug:      string;
  plan:      string;
  disabled:  boolean;
  createdAt: string;
  _count:    { members: number; installations: number };
}

const PLAN_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  enterprise: { bg: "#dbeafe", color: "#1d4ed8", border: "#bfdbfe" },
  pro:        { bg: "#d1fae5", color: "#065f46", border: "#6ee7b7" },
  free:       { bg: "#f3f4f6", color: "#374151", border: "#d1d5db" },
};

const BADGE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99,
  fontSize: 11, fontWeight: 700,
};

function PlanBadge({ plan }: { plan: string }) {
  const style = PLAN_STYLE[plan] ?? PLAN_STYLE.free;
  return (
    <span style={{ ...BADGE, background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
      {plan === "enterprise" ? "Enterprise" : plan === "pro" ? "Pro" : "Free"}
    </span>
  );
}

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total,   setTotal]   = useState(0);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState<string | null>(null);

  function load(q = "") {
    setLoading(true);
    api.admin.tenants.list(q)
      .then(r => { setTenants(r.tenants); setTotal(r.total); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggleDisabled(id: string, name: string, current: boolean) {
    const action = current ? "aktif et" : "devre dışı bırak";
    if (!confirm(`"${name}" tenant'ını ${action}?`)) return;
    setBusy(id);
    try { await api.admin.tenants.update(id, { disabled: !current }); }
    finally { setBusy(null); load(search); }
  }

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Tenant Yönetimi</h1>
        <span style={{ ...BADGE, background: "#e0f2fe", color: "#0369a1" }}>{total} tenant</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); load(e.target.value); }}
          placeholder="İsim veya slug ara..."
          style={{
            padding: "9px 14px", border: "1px solid #d1d5db", borderRadius: 8,
            fontSize: 14, width: 300, outline: "none",
          }}
        />
      </div>

      {loading && <div style={{ color: "#6b7280", padding: "20px 0" }}>Yükleniyor...</div>}

      {!loading && (
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", border: "1px solid #e5e7eb" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <th style={th}>Tenant</th>
                <th style={th}>Plan</th>
                <th style={{ ...th, textAlign: "center" }}>Üyeler</th>
                <th style={{ ...th, textAlign: "center" }}>Tesisler</th>
                <th style={th}>Oluşturma</th>
                <th style={{ ...th, textAlign: "center" }}>Durum</th>
                <th style={{ ...th, textAlign: "center" }}>İşlem</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{
                  borderBottom: "1px solid #f3f4f6",
                  background: t.disabled ? "#fffbf5" : undefined,
                  opacity: busy === t.id ? 0.5 : 1,
                  transition: "opacity .15s",
                }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 600, color: "#111827" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace", marginTop: 1 }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <PlanBadge plan={t.plan ?? "free"} />
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 28, height: 28, borderRadius: 8,
                      background: "#f3f4f6", color: "#374151",
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {t._count.members}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <span style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      width: 28, height: 28, borderRadius: 8,
                      background: "#f3f4f6", color: "#374151",
                      fontSize: 12, fontWeight: 700,
                    }}>
                      {t._count.installations}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(t.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    {t.disabled ? (
                      <span style={{ ...BADGE, background: "#fee2e2", color: "#b91c1c" }}>Devre Dışı</span>
                    ) : (
                      <span style={{ ...BADGE, background: "#d1fae5", color: "#065f46" }}>Aktif</span>
                    )}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => toggleDisabled(t.id, t.name, t.disabled)}
                      disabled={busy === t.id}
                      style={{
                        padding: "5px 12px", borderRadius: 6, border: "1px solid",
                        fontSize: 11, fontWeight: 600, cursor: busy === t.id ? "not-allowed" : "pointer",
                        background: t.disabled ? "#d1fae5" : "#fee2e2",
                        borderColor: t.disabled ? "#6ee7b7" : "#fca5a5",
                        color: t.disabled ? "#065f46" : "#b91c1c",
                      }}
                    >
                      {t.disabled ? "Aktif Et" : "Devre Dışı"}
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>
                    Tenant bulunamadı.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const th: React.CSSProperties = {
  textAlign: "left",
  padding: "10px 16px",
  color: "#6b7280",
  fontWeight: 600,
  fontSize: 11,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
};
