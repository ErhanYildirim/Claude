import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

interface AdminUser {
  id:             string;
  email:          string;
  createdAt:      string;
  lastSignIn:     string | null;
  banned:         boolean;
  emailConfirmed: boolean;
  isSuperAdmin:   boolean;
  tenantId:       string | null;
}

export default function AdminUsersPage() {
  const [users,   setUsers]   = useState<AdminUser[]>([]);
  const [total,   setTotal]   = useState(0);
  const [search,  setSearch]  = useState("");
  const [page,    setPage]    = useState(1);
  const [loading, setLoading] = useState(true);
  const [busy,    setBusy]    = useState<string | null>(null);

  function load(q = "", p = 1) {
    setLoading(true);
    api.admin.users.list(q, p)
      .then(r => { setUsers(r.users); setTotal(r.total ?? r.users.length); })
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function ban(id: string) {
    setBusy(id);
    await api.admin.users.ban(id, 24);
    setBusy(null);
    load(search, page);
  }

  async function unban(id: string) {
    setBusy(id);
    await api.admin.users.unban(id);
    setBusy(null);
    load(search, page);
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Kullanıcı Yönetimi</h1>
        <span style={{ fontSize: 13, color: "#6b7280" }}>({total} toplam)</span>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); load(e.target.value, 1); }}
          placeholder="E-posta veya ID ara..."
          style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 280 }}
        />
      </div>

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

      {!loading && (
        <>
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>E-posta</th>
                  <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Doğrulandı</th>
                  <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Son Giriş</th>
                  <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Rol</th>
                  <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Durum</th>
                  <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>İşlem</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{ borderBottom: "1px solid #f3f4f6", opacity: busy === u.id ? 0.5 : 1 }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 500, color: "#111827" }}>{u.email}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>{u.id.slice(0, 8)}…</div>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {u.emailConfirmed ? "✅" : "❌"}
                    </td>
                    <td style={{ padding: "12px 16px", fontSize: 12, color: "#6b7280" }}>
                      {u.lastSignIn ? new Date(u.lastSignIn).toLocaleDateString("tr-TR") : "—"}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {u.isSuperAdmin && (
                        <span style={{ padding: "2px 8px", borderRadius: 12, fontSize: 11, background: "#fef3c7", color: "#92400e" }}>
                          super-admin
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      <span style={{
                        padding: "2px 8px",
                        borderRadius: 12,
                        fontSize: 12,
                        background: u.banned ? "#fee2e2" : "#d1fae5",
                        color: u.banned ? "#b91c1c" : "#065f46",
                      }}>
                        {u.banned ? "Banlı" : "Aktif"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {u.banned ? (
                        <button
                          onClick={() => unban(u.id)}
                          disabled={busy === u.id}
                          style={{ padding: "4px 10px", borderRadius: 6, border: "1px solid #6ee7b7", fontSize: 12, cursor: "pointer", background: "#d1fae5", color: "#065f46" }}
                        >
                          Ban Kaldır
                        </button>
                      ) : (
                        <button
                          onClick={() => ban(u.id)}
                          disabled={busy === u.id || u.isSuperAdmin}
                          title={u.isSuperAdmin ? "Super-admin banlanamaz" : ""}
                          style={{
                            padding: "4px 10px",
                            borderRadius: 6,
                            border: "1px solid #fca5a5",
                            fontSize: 12,
                            cursor: u.isSuperAdmin ? "not-allowed" : "pointer",
                            background: "#fee2e2",
                            color: "#b91c1c",
                            opacity: u.isSuperAdmin ? 0.4 : 1,
                          }}
                        >
                          Banla (24s)
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Kullanıcı bulunamadı.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end" }}>
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(search, p); }}
              disabled={page === 1}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, cursor: "pointer", background: "#fff" }}
            >
              ← Önceki
            </button>
            <span style={{ padding: "6px 12px", fontSize: 13, color: "#6b7280" }}>Sayfa {page}</span>
            <button
              onClick={() => { const p = page + 1; setPage(p); load(search, p); }}
              disabled={users.length < 50}
              style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db", fontSize: 13, cursor: "pointer", background: "#fff" }}
            >
              Sonraki →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
