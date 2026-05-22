import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

interface Metrics {
  tenantCount:      number;
  installationCount: number;
  periodCount:      number;
  cfeCount:         number;
  auditCount30d:    number;
  newTenants30d:    number;
  dailyActivity:    { day: string; count: number }[];
  asOf:             string;
}

function KpiCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 10,
      padding: "20px 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
    }}>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 700, color: "#111827" }}>{value}</div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function AdminDashboardPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    api.admin.metrics()
      .then(setMetrics)
      .catch(e => setError(e.message ?? "Metrik yüklenemedi."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={{ padding: "32px 36px", maxWidth: 1100 }}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Sistem Genel Bakış</h1>
        {metrics && (
          <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>
            Son güncelleme: {new Date(metrics.asOf).toLocaleString("tr-TR")}
          </div>
        )}
      </div>

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}
      {error   && <div style={{ color: "#ef4444" }}>{error}</div>}

      {metrics && (
        <>
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: 16,
            marginBottom: 32,
          }}>
            <KpiCard label="Toplam Tenant"         value={metrics.tenantCount}       sub={`+${metrics.newTenants30d} son 30 gün`} />
            <KpiCard label="Toplam Tesis"           value={metrics.installationCount} />
            <KpiCard label="Raporlama Dönemi"       value={metrics.periodCount} />
            <KpiCard label="CFE Hesaplama"          value={metrics.cfeCount} />
            <KpiCard label="Aktivite (30 gün)"      value={metrics.auditCount30d} />
          </div>

          {/* Aktivite grafiği — basit bar chart */}
          {metrics.dailyActivity.length > 0 && (
            <div style={{ background: "#fff", borderRadius: 10, padding: "20px 24px", boxShadow: "0 1px 3px rgba(0,0,0,0.08)" }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "#374151", marginBottom: 16 }}>
                Son 30 Gün — Günlük Aktivite
              </div>
              <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 80 }}>
                {(() => {
                  const max = Math.max(...metrics.dailyActivity.map(d => d.count), 1);
                  return metrics.dailyActivity.map((d, i) => (
                    <div
                      key={i}
                      title={`${d.day.slice(0, 10)}: ${d.count}`}
                      style={{
                        flex: 1,
                        height: `${Math.max(4, (d.count / max) * 80)}px`,
                        background: "#3b82f6",
                        borderRadius: "2px 2px 0 0",
                        opacity: 0.7,
                        minWidth: 4,
                      }}
                    />
                  ));
                })()}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6, fontSize: 11, color: "#9ca3af" }}>
                <span>{metrics.dailyActivity[0]?.day.slice(0, 10)}</span>
                <span>{metrics.dailyActivity[metrics.dailyActivity.length - 1]?.day.slice(0, 10)}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
