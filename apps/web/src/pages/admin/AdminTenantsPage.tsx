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

export default function AdminTenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [total,   setTotal]   = useState(0);
  const [search,  setSearch]  = useState("");
  const [loading, setLoading] = useState(true);

  function load(q = "") {
    setLoading(true);
    api.admin.tenants.list(q)
      .then(r => { setTenants(r.tenants); setTotal(r.total); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function toggleDisabled(id: string, current: boolean) {
    await api.admin.tenants.update(id, { disabled: !current });
    load(search);
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>
          Tenant Yönetimi
        </h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>({total} toplam)</span>
      </div>

      <input
        value={search}
        onChange={e => { setSearch(e.target.value); load(e.target.value); }}
        placeholder="İsim veya slug ara..."
        style={{
          padding: "8px 12px",
          border: "1px solid #d1d5db",
          borderRadius: 6,
          fontSize: 14,
          width: 280,
          marginBottom: 20,
        }}
      />

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

      {!loading && (
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Tenant</th>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Plan</th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Üyeler</th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Tesisler</th>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Oluşturma</th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Durum</th>
              </tr>
            </thead>
            <tbody>
              {tenants.map(t => (
                <tr key={t.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                  <td style={{ padding: "12px 16px" }}>
                    <div style={{ fontWeight: 500, color: "#111827" }}>{t.name}</div>
                    <div style={{ fontSize: 11, color: "#9ca3af" }}>{t.slug}</div>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "2px 8px",
                      borderRadius: 12,
                      fontSize: 12,
                      background: t.plan === "enterprise" ? "#dbeafe" : t.plan === "pro" ? "#d1fae5" : "#f3f4f6",
                      color: t.plan === "enterprise" ? "#1d4ed8" : t.plan === "pro" ? "#065f46" : "#374151",
                    }}>
                      {t.plan ?? "free"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#374151" }}>{t._count.members}</td>
                  <td style={{ padding: "12px 16px", textAlign: "center", color: "#374151" }}>{t._count.installations}</td>
                  <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                    {new Date(t.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "center" }}>
                    <button
                      onClick={() => toggleDisabled(t.id, t.disabled)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 6,
                        border: "1px solid",
                        fontSize: 12,
                        cursor: "pointer",
                        background: t.disabled ? "#fee2e2" : "#d1fae5",
                        borderColor: t.disabled ? "#fca5a5" : "#6ee7b7",
                        color: t.disabled ? "#b91c1c" : "#065f46",
                      }}
                    >
                      {t.disabled ? "Devre Dışı" : "Aktif"}
                    </button>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Tenant bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
