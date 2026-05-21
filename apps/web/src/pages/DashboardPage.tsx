import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";
import { api } from "../lib/api.js";
import type { InstallationDetail, EmbeddedEmission } from "../lib/api.js";
import { SECTOR_COLORS, SECTOR_LABELS, fmtTco2, fmtEur, fmt } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 28 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 },
  kpi:     { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" },
  kpiL:    { fontSize: 12, color: "#5c7a72", marginBottom: 6 },
  kpiV:    { fontSize: 26, fontWeight: 700, color: "#0a1f1a" },
  kpiIcon: { width: 40, height: 40, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 },
  row2:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  card:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px" },
  cardH:   { fontSize: 14, fontWeight: 600, color: "#0a1f1a", marginBottom: 16 },
  skel:    { background: "#eef7f3", borderRadius: 8, animation: "pulse 1.5s ease-in-out infinite" },
  empty:   { textAlign: "center" as const, padding: "60px 0", color: "#5c7a72" },
};

interface PeriodWithInst { facilityName: string; periodName: string; result: EmbeddedEmission; }

export default function DashboardPage() {
  const [installations, setInstallations] = useState<InstallationDetail[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const list = await api.installations.list();
      const details = await Promise.all(list.map(i => api.installations.get(i.id)));
      setInstallations(details);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const allPeriods = installations.flatMap(i => i.periods);
  const withResult: PeriodWithInst[] = installations.flatMap(inst =>
    inst.periods
      .filter(p => p.result)
      .map(p => ({ facilityName: inst.facilityName, periodName: p.periodName, result: p.result! }))
  );

  const totalReduction = withResult.reduce((s, p) => s + p.result.reductionTco2, 0);
  const totalSavings   = withResult.reduce((s, p) => s + (p.result.savingsVsDefaultEur ?? 0), 0);

  const sectorData = Object.entries(
    installations.reduce((acc, i) => {
      const sec = (i as InstallationDetail & { sector?: string }).sector ?? "steel";
      acc[sec] = (acc[sec] ?? 0) + 1;
      return acc;
    }, {} as Record<string, number>)
  ).map(([key, value]) => ({
    name: SECTOR_LABELS[key] ?? key,
    value,
    color: SECTOR_COLORS[key] ?? "#5c7a72",
  }));

  const seeData = withResult.map(p => ({
    name: `${p.facilityName.slice(0, 10)}…/${p.periodName.slice(0, 6)}`,
    seeBaseline: p.result.seeBaseline,
    seeVoltfox:  p.result.seeVoltfox,
  }));

  const KPIS = [
    { label: "Toplam Tesis",    value: loading ? "—" : String(installations.length),          icon: "🏭", iconBg: "#e6f9f2", iconColor: "#009966" },
    { label: "Toplam Dönem",    value: loading ? "—" : String(allPeriods.length),              icon: "📅", iconBg: "#F0FDF4", iconColor: "#059669" },
    { label: "Toplam Azaltım",  value: loading ? "—" : fmtTco2(totalReduction),               icon: "🌿", iconBg: "#ECFDF5", iconColor: "#059669" },
    { label: "CBAM Tasarruf",   value: loading ? "—" : fmtEur(totalSavings),                  icon: "💰", iconBg: "#FEF3C7", iconColor: "#D97706" },
  ];

  if (!loading && installations.length === 0) {
    return (
      <div style={s.page}>
        <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
        <div style={s.h1}>Dashboard</div>
        <div style={s.sub}>Emisyon analizi ve CFE performansı</div>
        <div style={s.empty}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
          <div style={{ marginBottom: 12 }}>Görselleştirme için önce tesis ekleyin.</div>
          <Link to="/cbam" style={{ color: "#00b87a", fontSize: 14 }}>→ Tesis Ekle</Link>
        </div>
      </div>
    );
  }

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={s.h1}>Dashboard</div>
      <div style={s.sub}>Emisyon analizi ve CFE performansı</div>

      {/* KPI Grid */}
      <div style={s.kpiGrid}>
        {KPIS.map(k => (
          <div key={k.label} style={s.kpi}>
            <div>
              <div style={s.kpiL}>{k.label}</div>
              {loading
                ? <div style={{ ...s.skel, width: 80, height: 28 }} />
                : <div style={s.kpiV}>{k.value}</div>}
            </div>
            <div style={{ ...s.kpiIcon, background: k.iconBg, color: k.iconColor }}>
              {k.icon}
            </div>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div style={s.row2}>
        {/* Sektör dağılımı */}
        <div style={s.card}>
          <div style={s.cardH}>Sektör Dağılımı</div>
          {loading ? (
            <div style={{ ...s.skel, height: 240 }} />
          ) : sectorData.length === 0 ? (
            <div style={{ color: "#5c7a72", fontSize: 13 }}>Veri yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={sectorData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
                  {sectorData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [`${v} tesis`, ""]} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* SEE Karşılaştırma */}
        <div style={s.card}>
          <div style={s.cardH}>SEE Karşılaştırması (tCO₂e/t)</div>
          {loading ? (
            <div style={{ ...s.skel, height: 240 }} />
          ) : seeData.length === 0 ? (
            <div style={{ color: "#5c7a72", fontSize: 13 }}>Hesaplanmış dönem yok</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={seeData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef7f3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => [`${fmt(v, 4)} tCO₂e/t`, ""]} />
                <Legend />
                <Bar dataKey="seeBaseline" name="Baseline" fill="#d4ece4" />
                <Bar dataKey="seeVoltfox"  name="Voltfox"  fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Recent periods table */}
      {!loading && withResult.length > 0 && (
        <div style={s.card}>
          <div style={s.cardH}>Hesaplanmış Dönemler</div>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                {["Tesis", "Dönem", "SEE Baseline", "SEE Voltfox", "Azaltım", "CBAM Tasarruf"].map(h => (
                  <th key={h} style={{ padding: "8px 12px", textAlign: "left", fontSize: 12, fontWeight: 600, color: "#5c7a72", borderBottom: "1px solid #d4ece4", background: "#f4fbf8" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {withResult.slice(0, 10).map((p, i) => (
                <tr key={i} style={{ borderBottom: "1px solid #eef7f3" }}>
                  <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{p.facilityName}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#5c7a72" }}>{p.periodName}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13 }}>{fmt(p.result.seeBaseline, 4)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#059669", fontWeight: 600 }}>{fmt(p.result.seeVoltfox, 4)}</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#059669" }}>{fmt(p.result.reductionPct, 1)}%</td>
                  <td style={{ padding: "10px 12px", fontSize: 13, color: "#D97706" }}>
                    {p.result.savingsVsDefaultEur !== null ? fmtEur(p.result.savingsVsDefaultEur) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
