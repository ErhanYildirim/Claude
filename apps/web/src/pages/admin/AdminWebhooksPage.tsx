import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

interface Delivery {
  id:          string;
  webhookId:   string;
  status:      string;
  statusCode:  number | null;
  createdAt:   string;
  durationMs:  number | null;
  webhook:     { url: string; tenantId: string };
}

interface Stats {
  total:       number;
  success:     number;
  failed:      number;
  pending:     number;
  successRate: string;
}

export default function AdminWebhooksPage() {
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [stats,      setStats]      = useState<Stats | null>(null);
  const [loading,    setLoading]    = useState(true);
  const [busy,       setBusy]       = useState<string | null>(null);
  const [filter,     setFilter]     = useState<string>("");

  function load() {
    setLoading(true);
    Promise.all([
      api.admin.webhooks.deliveries(filter || undefined),
      api.admin.webhooks.stats(),
    ]).then(([d, s]) => {
      setDeliveries(d.deliveries);
      setStats(s);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, [filter]);

  async function retry(id: string) {
    setBusy(id);
    try { await api.admin.webhooks.retry(id); }
    finally { setBusy(null); load(); }
  }

  const statusColor = (s: string) => {
    if (s === "success") return { bg: "#d1fae5", color: "#065f46" };
    if (s === "failed")  return { bg: "#fee2e2", color: "#b91c1c" };
    return { bg: "#f3f4f6", color: "#374151" };
  };

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Webhook Teslimatları</h1>
      </div>

      {stats && (
        <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Toplam", value: stats.total, color: "#374151" },
            { label: "Başarılı", value: stats.success, color: "#065f46" },
            { label: "Başarısız", value: stats.failed, color: "#b91c1c" },
            { label: "Bekliyor", value: stats.pending, color: "#92400e" },
          ].map(s => (
            <div key={s.label} style={{
              background: "#fff",
              borderRadius: 8,
              padding: "12px 20px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
              minWidth: 100,
            }}>
              <div style={{ fontSize: 11, color: "#6b7280" }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            </div>
          ))}
          <div style={{ background: "#fff", borderRadius: 8, padding: "12px 20px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)" }}>
            <div style={{ fontSize: 11, color: "#6b7280" }}>Başarı Oranı</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#1d4ed8" }}>{stats.successRate}%</div>
          </div>
        </div>
      )}

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {["", "success", "failed", "pending"].map(s => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            style={{
              padding: "5px 12px",
              borderRadius: 6,
              border: "1px solid",
              fontSize: 13,
              cursor: "pointer",
              borderColor: filter === s ? "#3b82f6" : "#d1d5db",
              background: filter === s ? "#eff6ff" : "#fff",
              color: filter === s ? "#1d4ed8" : "#374151",
            }}
          >
            {s || "Tümü"}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

      {!loading && (
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>URL</th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Durum</th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>HTTP</th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Süre</th>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Zaman</th>
                <th style={{ textAlign: "center", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Tekrar</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map(d => {
                const sc = statusColor(d.status);
                return (
                  <tr key={d.id} style={{ borderBottom: "1px solid #f3f4f6", opacity: busy === d.id ? 0.5 : 1 }}>
                    <td style={{ padding: "11px 16px", maxWidth: 240, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <span title={d.webhook.url} style={{ color: "#111827" }}>{d.webhook.url}</span>
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "center" }}>
                      <span style={{ padding: "2px 8px", borderRadius: 10, fontSize: 11, background: sc.bg, color: sc.color }}>
                        {d.status}
                      </span>
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "center", color: "#374151" }}>
                      {d.statusCode ?? "—"}
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "center", color: "#374151" }}>
                      {d.durationMs != null ? `${d.durationMs}ms` : "—"}
                    </td>
                    <td style={{ padding: "11px 16px", fontSize: 11, color: "#6b7280" }}>
                      {new Date(d.createdAt).toLocaleString("tr-TR")}
                    </td>
                    <td style={{ padding: "11px 16px", textAlign: "center" }}>
                      {d.status === "failed" && (
                        <button
                          onClick={() => retry(d.id)}
                          disabled={busy === d.id}
                          style={{ padding: "3px 10px", borderRadius: 5, border: "1px solid #93c5fd", fontSize: 12, cursor: "pointer", background: "#eff6ff", color: "#1d4ed8" }}
                        >
                          Tekrar
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
              {deliveries.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Teslimat bulunamadı.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
