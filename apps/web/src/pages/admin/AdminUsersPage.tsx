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

const BADGE: React.CSSProperties = {
  display: "inline-flex", alignItems: "center",
  padding: "2px 8px", borderRadius: 99,
  fontSize: 11, fontWeight: 700,
};

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

  async function run(id: string, action: () => Promise<unknown>) {
    setBusy(id);
    try { await action(); } finally { setBusy(null); load(search, page); }
  }

  const perPage = 50;
  const totalPages = Math.ceil(total / perPage);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1200 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", margin: 0 }}>Kullanıcı Yönetimi</h1>
        <span style={{ ...BADGE, background: "#e0f2fe", color: "#0369a1" }}>{total} kullanıcı</span>
      </div>

      <div style={{ marginBottom: 20 }}>
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); load(e.target.value, 1); }}
          placeholder="E-posta veya ID ara..."
          style={{
            padding: "9px 14px", border: "1px solid #d1d5db", borderRadius: 8,
            fontSize: 14, width: 300, outline: "none",
          }}
        />
      </div>

      {loading && <div style={{ color: "#6b7280", padding: "20px 0" }}>Yükleniyor...</div>}

      {!loading && (
        <>
          <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", border: "1px solid #e5e7eb" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                  <th style={{ textAlign: "left", padding: "10px 16px", color: "#6b7280", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>Kullanıcı</th>
                  <th style={{ textAlign: "left", padding: "10px 16px", color: "#6b7280", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>Son Giriş</th>
                  <th style={{ textAlign: "center", padding: "10px 16px", color: "#6b7280", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>Durum</th>
                  <th style={{ textAlign: "center", padding: "10px 16px", color: "#6b7280", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>Rol</th>
                  <th style={{ textAlign: "center", padding: "10px 16px", color: "#6b7280", fontWeight: 600, fontSize: 11, letterSpacing: "0.05em", textTransform: "uppercase" }}>İşlemler</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id} style={{
                    borderBottom: "1px solid #f3f4f6",
                    opacity: busy === u.id ? 0.5 : 1,
                    transition: "opacity .15s",
                    background: u.banned ? "#fff9f9" : undefined,
                  }}>
                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ fontWeight: 600, color: "#111827", marginBottom: 2 }}>{u.email}</div>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#9ca3af", fontFamily: "monospace" }}>{u.id.slice(0, 8)}…</span>
                        {u.emailConfirmed ? (
                          <span style={{ ...BADGE, background: "#d1fae5", color: "#065f46", fontSize: 10 }}>✓ Doğrulandı</span>
                        ) : (
                          <span style={{ ...BADGE, background: "#fef3c7", color: "#92400e", fontSize: 10 }}>E-posta doğrulanmadı</span>
                        )}
                      </div>
                    </td>

                    <td style={{ padding: "12px 16px", color: "#6b7280", fontSize: 12 }}>
                      {u.lastSignIn
                        ? new Date(u.lastSignIn).toLocaleString("tr-TR", { dateStyle: "short", timeStyle: "short" })
                        : <span style={{ color: "#d1d5db" }}>Hiç giriş yapmadı</span>}
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {u.banned ? (
                        <span style={{ ...BADGE, background: "#fee2e2", color: "#b91c1c" }}>Banlı</span>
                      ) : (
                        <span style={{ ...BADGE, background: "#d1fae5", color: "#065f46" }}>Aktif</span>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px", textAlign: "center" }}>
                      {u.isSuperAdmin && (
                        <span style={{ ...BADGE, background: "#fef3c7", color: "#92400e", gap: 3 }}>
                          ⚡ super-admin
                        </span>
                      )}
                    </td>

                    <td style={{ padding: "12px 16px" }}>
                      <div style={{ display: "flex", gap: 6, justifyContent: "center", flexWrap: "wrap" }}>
                        {/* Ban/Unban */}
                        {u.banned ? (
                          <button
                            onClick={() => run(u.id, () => api.admin.users.unban(u.id))}
                            disabled={busy === u.id}
                            style={actionBtn("#d1fae5", "#6ee7b7", "#065f46")}
                          >
                            Ban Kaldır
                          </button>
                        ) : (
                          <button
                            onClick={() => { if (confirm(`"${u.email}" kullanıcısını 24 saat banla?`)) run(u.id, () => api.admin.users.ban(u.id, 24)); }}
                            disabled={busy === u.id || u.isSuperAdmin}
                            title={u.isSuperAdmin ? "Super-admin banlanamaz" : ""}
                            style={{ ...actionBtn("#fee2e2", "#fca5a5", "#b91c1c"), opacity: u.isSuperAdmin ? 0.3 : 1, cursor: u.isSuperAdmin ? "not-allowed" : "pointer" }}
                          >
                            Banla (24s)
                          </button>
                        )}

                        {/* Super-admin toggle */}
                        <button
                          onClick={() => {
                            const label = u.isSuperAdmin ? "Super-admin yetkisini kaldır" : "Super-admin yap";
                            if (confirm(`${u.email} — ${label}?`)) {
                              run(u.id, () => api.admin.users.setSuperAdmin(u.id, !u.isSuperAdmin));
                            }
                          }}
                          disabled={busy === u.id}
                          style={actionBtn(
                            u.isSuperAdmin ? "#fef3c7" : "#f3f4f6",
                            u.isSuperAdmin ? "#fde68a" : "#d1d5db",
                            u.isSuperAdmin ? "#92400e" : "#374151",
                          )}
                        >
                          {u.isSuperAdmin ? "Admin Kaldır" : "Admin Yap"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={5} style={{ padding: "32px 24px", textAlign: "center", color: "#9ca3af" }}>
                      Kullanıcı bulunamadı.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div style={{ display: "flex", gap: 8, marginTop: 16, justifyContent: "flex-end", alignItems: "center" }}>
            <span style={{ fontSize: 13, color: "#6b7280" }}>
              Sayfa {page} / {totalPages || 1}
            </span>
            <button
              onClick={() => { const p = Math.max(1, page - 1); setPage(p); load(search, p); }}
              disabled={page === 1}
              style={pageBtn(page !== 1)}
            >
              ← Önceki
            </button>
            <button
              onClick={() => { const p = page + 1; setPage(p); load(search, p); }}
              disabled={users.length < perPage}
              style={pageBtn(users.length >= perPage)}
            >
              Sonraki →
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function actionBtn(bg: string, borderColor: string, color: string): React.CSSProperties {
  return {
    padding: "4px 10px", borderRadius: 6, border: `1px solid ${borderColor}`,
    fontSize: 11, fontWeight: 600, cursor: "pointer", background: bg, color,
    whiteSpace: "nowrap",
  };
}

function pageBtn(enabled: boolean): React.CSSProperties {
  return {
    padding: "6px 14px", borderRadius: 6, border: "1px solid #d1d5db",
    fontSize: 13, cursor: enabled ? "pointer" : "not-allowed",
    background: "#fff", color: enabled ? "#374151" : "#d1d5db",
    opacity: enabled ? 1 : 0.5,
  };
}
