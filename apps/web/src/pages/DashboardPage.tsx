import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import type { InstallationDetail, Period, EFCoverageData } from "../lib/api.js";
import { fmtTco2, fmtEur, fmt } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 28 },

  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 },
  kpi:     { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:    { fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 6,
             textTransform: "uppercase" as const, letterSpacing: ".06em" },
  kpiV:    { fontSize: 26, fontWeight: 800, color: "#0a1f1a", lineHeight: 1 },
  kpiU:    { fontSize: 11, color: "#5c7a72", marginTop: 4 },

  alerts:  { marginBottom: 24 },
  alert:   { display: "flex", alignItems: "center", gap: 10, background: "#fffbeb",
             border: "1px solid #fcd34d", borderRadius: 8, padding: "10px 14px",
             marginBottom: 8, fontSize: 13 },
  alertI:  { fontSize: 16, flexShrink: 0 },
  alertTxt:{ color: "#92400e", flex: 1 },
  alertLnk:{ color: "#d97706", fontWeight: 600, textDecoration: "none", whiteSpace: "nowrap" as const },

  prodGrid:{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 },
  prod:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px",
             display: "flex", flexDirection: "column" as const, gap: 10 },
  prodH:   { display: "flex", alignItems: "center", gap: 10 },
  prodIcon:{ fontSize: 22 },
  prodTitle:{ fontSize: 15, fontWeight: 700, color: "#0a1f1a" },
  prodSub: { fontSize: 12, color: "#5c7a72" },
  statRow: { display: "flex", gap: 16, flexWrap: "wrap" as const },
  stat:    { textAlign: "center" as const },
  statV:   { fontSize: 20, fontWeight: 800, color: "#0a1f1a" },
  statL:   { fontSize: 11, color: "#5c7a72" },
  cta:     { display: "inline-block", marginTop: "auto", padding: "7px 14px", borderRadius: 7,
             background: "#e6f9f2", color: "#009966", fontSize: 13, fontWeight: 600,
             textDecoration: "none", alignSelf: "flex-start" as const },

  row2:    { display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 },
  row3:    { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  card:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px" },
  cardH:   { fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 16,
             textTransform: "uppercase" as const, letterSpacing: ".08em" },

  logRow:  { display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #eef7f3", alignItems: "flex-start" },
  logDot:  { width: 7, height: 7, borderRadius: "50%", background: "#00b87a", marginTop: 4, flexShrink: 0 },
  logTxt:  { fontSize: 12, color: "#1a3530", lineHeight: 1.4 },
  logTs:   { fontSize: 11, color: "#5c7a72", marginTop: 2 },

  skel:    { background: "#eef7f3", borderRadius: 8, animation: "pulse 1.4s ease-in-out infinite" },
};

interface PeriodWithMeta {
  facilityName: string;
  periodName: string;
  installationId: string;
  period: Period;
}

const ACTION_LABELS: Record<string, string> = {
  CALCULATE:     "SEE Hesaplandı",
  IMPORT_CFE_CSV:"CFE CSV Yüklendi",
  CREATE:        "Oluşturuldu",
  DELETE:        "Silindi",
  UPDATE:        "Güncellendi",
};

function monthKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  return new Date(Number(y), Number(m) - 1).toLocaleString("tr-TR", { month: "short", year: "2-digit" });
}

export default function DashboardPage() {
  const [installations, setInstallations] = useState<InstallationDetail[]>([]);
  const [coverage,      setCoverage]      = useState<EFCoverageData | null>(null);
  const [auditLogs,     setAuditLogs]     = useState<Array<{ id: string; action: string; resource: string; createdAt: string }>>([]);
  const [loading,       setLoading]       = useState(true);

  useEffect(() => {
    async function load() {
      const [list, cov, logsRes] = await Promise.all([
        api.installations.list(),
        api.ef.coverage().catch(() => null),
        api.auditLogs.list({ limit: 8 }).catch(() => ({ logs: [], nextCursor: null, count: 0 })),
      ]);
      const details = await Promise.all(list.map(i => api.installations.get(i.id)));
      setInstallations(details);
      setCoverage(cov);
      setAuditLogs(logsRes.logs);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  // ── Derived stats ──────────────────────────────────────────────────────────
  const allPeriods    = installations.flatMap(i => i.periods);
  const withResult    = installations.flatMap(inst =>
    inst.periods.filter(p => p.result).map(p => ({ facilityName: inst.facilityName, installationId: inst.id, period: p, periodName: p.periodName }))
  );
  const pending: PeriodWithMeta[] = installations.flatMap(inst =>
    inst.periods.filter(p => !p.result).map(p => ({ facilityName: inst.facilityName, installationId: inst.id, period: p, periodName: p.periodName }))
  );
  const noDataPeriods = pending.filter(p => p.period.electricityKwh === 0);
  const needsCalc     = pending.filter(p => p.period.electricityKwh > 0);
  const emptyInsts    = installations.filter(i => i.periods.length === 0);

  const gecConnected  = allPeriods.filter(p => p.gecConnected);
  const avgCfe        = gecConnected.length > 0
    ? gecConnected.reduce((s, p) => s + p.matchingRatePct, 0) / gecConnected.length : 0;
  const totalReduction = withResult.reduce((s, p) => s + p.period.result!.reductionTco2, 0);
  const totalSavings   = withResult.reduce((s, p) => s + (p.period.result!.savingsVsDefaultEur ?? 0), 0);

  // EF stats from coverage
  const efZoneCount = coverage?.zones.length ?? null;
  const efRowCount  = coverage?.zones.reduce((acc, z) => acc + z.years.reduce((a, y) => a + y.rowCount, 0), 0) ?? null;
  const efLatestYear = coverage && coverage.availableYears.length > 0 ? Math.max(...coverage.availableYears) : null;

  // Monthly emission trend (last 6 months by period startDate)
  const monthMap = new Map<string, number>();
  for (const { period } of withResult) {
    const k = monthKey(period.startDate);
    monthMap.set(k, (monthMap.get(k) ?? 0) + period.result!.scope2VoltfoxTco2);
  }
  const trendData = [...monthMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-6)
    .map(([k, tco2]) => ({ month: monthLabel(k), tco2: Math.round(tco2 * 10) / 10 }));

  // SEE baseline vs voltfox bar chart
  const seeData = withResult.map(p => ({
    name:        `${p.facilityName.slice(0, 8)}/${p.periodName.slice(0, 4)}`,
    seeBaseline: p.period.result!.seeBaseline,
    seeVoltfox:  p.period.result!.seeVoltfox,
  }));

  const Skel = ({ w, h }: { w: number | string; h: number }) => (
    <div style={{ ...s.skel, width: w, height: h }} />
  );

  const alerts = [
    ...emptyInsts.map(i => ({
      key: `inst-${i.id}`, icon: "🏭",
      msg: `"${i.facilityName}" tesisinde henüz dönem yok.`,
      link: `/installations/${i.id}`, linkLabel: "Dönem ekle →",
    })),
    ...noDataPeriods.map(p => ({
      key: `nodata-${p.period.id}`, icon: "📂",
      msg: `"${p.facilityName} / ${p.periodName}" için tüketim verisi yüklenmemiş.`,
      link: `/installations/${p.installationId}`, linkLabel: "Veri yükle →",
    })),
    ...needsCalc.map(p => ({
      key: `calc-${p.period.id}`, icon: "⏳",
      msg: `"${p.facilityName} / ${p.periodName}" için SEE hesaplaması bekliyor.`,
      link: `/installations/${p.installationId}`, linkLabel: "Hesapla →",
    })),
  ];

  return (
    <div style={s.page}>
      <style>{`@keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}`}</style>
      <div style={s.h1}>Platform Özeti</div>
      <div style={s.sub}>4 ürünün anlık durumu</div>

      {/* KPI satırı */}
      <div style={s.kpiGrid}>
        <div style={s.kpi}>
          <div style={s.kpiL}>Aktif Tesis</div>
          {loading ? <Skel w={60} h={28} /> : <div style={s.kpiV}>{installations.length}</div>}
          <div style={s.kpiU}>{allPeriods.length} dönem · {withResult.length} hesaplanmış</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>CBAM Azaltım</div>
          {loading ? <Skel w={80} h={28} /> : (
            <div style={{ ...s.kpiV, color: totalReduction > 0 ? "#059669" : "#0a1f1a" }}>
              {totalReduction > 0 ? fmtTco2(totalReduction) : "—"}
            </div>
          )}
          <div style={s.kpiU}>{totalSavings > 0 ? `${fmtEur(totalSavings)} tasarruf` : "hesaplanmış dönem yok"}</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Ort. CFE Skoru</div>
          {loading ? <Skel w={60} h={28} /> : (
            <div style={{ ...s.kpiV, color: avgCfe >= 70 ? "#059669" : avgCfe >= 40 ? "#d97706" : "#5c7a72" }}>
              {gecConnected.length > 0 ? `${fmt(avgCfe, 1)}%` : "—"}
            </div>
          )}
          <div style={s.kpiU}>{gecConnected.length} CFE bağlı dönem</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>EF Zone</div>
          {loading || efZoneCount === null ? <Skel w={40} h={28} /> : <div style={s.kpiV}>{efZoneCount}</div>}
          <div style={s.kpiU}>
            {efRowCount != null ? `${(efRowCount / 1000).toFixed(0)}K satır` : "—"}
            {efLatestYear != null ? ` · ${efLatestYear}` : ""}
          </div>
        </div>
      </div>

      {/* Action Items */}
      {!loading && alerts.length > 0 && (
        <div style={s.alerts}>
          {alerts.slice(0, 5).map(a => (
            <div key={a.key} style={s.alert}>
              <span style={s.alertI}>{a.icon}</span>
              <span style={s.alertTxt}>{a.msg}</span>
              <Link to={a.link} style={s.alertLnk}>{a.linkLabel}</Link>
            </div>
          ))}
          {alerts.length > 5 && (
            <div style={{ fontSize: 12, color: "#5c7a72", paddingLeft: 4 }}>
              + {alerts.length - 5} daha fazla yapılacak
            </div>
          )}
        </div>
      )}

      {/* 4 Ürün kartları */}
      <div style={s.prodGrid}>
        <div style={s.prod}>
          <div style={s.prodH}>
            <span style={s.prodIcon}>🔬</span>
            <div>
              <div style={s.prodTitle}>Granüler Emisyon Hesaplama</div>
              <div style={s.prodSub}>Saatlik tüketim × lokasyon bazlı EF → tCO₂</div>
            </div>
          </div>
          <div style={s.statRow}>
            <div style={s.stat}>
              <div style={{ ...s.statV, color: "#00b87a" }}>Hazır</div>
              <div style={s.statL}>Durum</div>
            </div>
            <div style={s.stat}>
              <div style={s.statV}>{loading ? "—" : allPeriods.length}</div>
              <div style={s.statL}>Dönem</div>
            </div>
            <div style={s.stat}>
              <div style={s.statV}>{loading ? "—" : gecConnected.length}</div>
              <div style={s.statL}>GEC Bağlı</div>
            </div>
            {needsCalc.length > 0 && (
              <div style={s.stat}>
                <div style={{ ...s.statV, color: "#d97706" }}>{needsCalc.length}</div>
                <div style={s.statL}>Bekleyen</div>
              </div>
            )}
          </div>
          <Link to="/gec" style={s.cta}>GEC Hesapla →</Link>
        </div>

        <div style={s.prod}>
          <div style={s.prodH}>
            <span style={s.prodIcon}>📋</span>
            <div>
              <div style={s.prodTitle}>CBAM Actual Emissions</div>
              <div style={s.prodSub}>Gömülü dolaylı emisyon teknik dosyası</div>
            </div>
          </div>
          <div style={s.statRow}>
            <div style={s.stat}>
              <div style={s.statV}>{loading ? "—" : installations.length}</div>
              <div style={s.statL}>Tesis</div>
            </div>
            <div style={s.stat}>
              <div style={s.statV}>{loading ? "—" : allPeriods.length}</div>
              <div style={s.statL}>Dönem</div>
            </div>
            <div style={s.stat}>
              <div style={{ ...s.statV, color: "#059669" }}>{loading ? "—" : withResult.length}</div>
              <div style={s.statL}>Hesaplanmış</div>
            </div>
            {totalSavings > 0 && (
              <div style={s.stat}>
                <div style={{ ...s.statV, fontSize: 16, color: "#d97706" }}>{fmtEur(totalSavings)}</div>
                <div style={s.statL}>CBAM Tasarruf</div>
              </div>
            )}
          </div>
          <Link to="/cbam" style={s.cta}>Tesisleri Yönet →</Link>
        </div>

        <div style={s.prod}>
          <div style={s.prodH}>
            <span style={s.prodIcon}>⚡</span>
            <div>
              <div style={s.prodTitle}>24/7 CFE Eşleştirme</div>
              <div style={s.prodSub}>Saatlik yenilenebilir enerji eşleştirme analizi</div>
            </div>
          </div>
          <div style={s.statRow}>
            <div style={s.stat}>
              <div style={{ ...s.statV, color: avgCfe >= 70 ? "#059669" : avgCfe >= 40 ? "#d97706" : "#5c7a72" }}>
                {gecConnected.length > 0 ? `${fmt(avgCfe, 1)}%` : "—"}
              </div>
              <div style={s.statL}>Ort. CFE</div>
            </div>
            <div style={s.stat}>
              <div style={s.statV}>{loading ? "—" : gecConnected.length}</div>
              <div style={s.statL}>Bağlı Dönem</div>
            </div>
          </div>
          {gecConnected.length === 0 && (
            <div style={{ fontSize: 12, color: "#5c7a72", background: "#f4fbf8", borderRadius: 7, padding: "8px 12px" }}>
              CFE sayfasından saatlik tüketim + üretim verisi yükleyin
            </div>
          )}
          <Link to="/cfe" style={s.cta}>CFE Analizi →</Link>
        </div>

        <div style={s.prod}>
          <div style={s.prodH}>
            <span style={s.prodIcon}>📡</span>
            <div>
              <div style={s.prodTitle}>EF Veri Servisi</div>
              <div style={s.prodSub}>Saatlik lokasyon bazlı emisyon faktörü API</div>
            </div>
          </div>
          <div style={s.statRow}>
            <div style={s.stat}>
              <div style={{ ...s.statV, color: "#00b87a" }}>{efZoneCount ?? "—"}</div>
              <div style={s.statL}>Zone</div>
            </div>
            <div style={s.stat}>
              <div style={s.statV}>{efRowCount != null ? `${(efRowCount / 1000).toFixed(0)}K+` : "—"}</div>
              <div style={s.statL}>Satır</div>
            </div>
            <div style={s.stat}>
              <div style={s.statV}>{efLatestYear ?? "—"}</div>
              <div style={s.statL}>Son Yıl</div>
            </div>
          </div>
          {coverage && (
            <div style={{ fontSize: 12, color: "#5c7a72", background: "#f4fbf8", borderRadius: 7, padding: "8px 12px" }}>
              {coverage.zones.slice(0, 8).map(z => z.zoneId).join(" · ")}
              {coverage.zones.length > 8 ? ` +${coverage.zones.length - 8} daha` : ""}
            </div>
          )}
          <Link to="/ef-data" style={s.cta}>Zone Tarayıcı →</Link>
        </div>
      </div>

      {/* Alt grafikler */}
      <div style={s.row3}>
        {/* Aylık emisyon trendi */}
        <div style={s.card}>
          <div style={s.cardH}>Aylık Emisyon Trendi — tCO₂e (Voltfox)</div>
          {loading ? (
            <div style={{ ...s.skel, height: 220 }} />
          ) : trendData.length === 0 ? (
            <div style={{ color: "#5c7a72", fontSize: 13, textAlign: "center", padding: "48px 0" }}>
              Hesaplanmış dönem yok
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={trendData} margin={{ top: 5, right: 16, bottom: 20, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef7f3" />
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${fmt(Number(v), 1)} tCO₂e`, "Emisyon"] as [string, string]} />
                <Line type="monotone" dataKey="tco2" stroke="#00b87a" strokeWidth={2} dot={{ r: 4 }} name="tCO₂e" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* SEE Karşılaştırma */}
        <div style={s.card}>
          <div style={s.cardH}>SEE Karşılaştırması — Baseline vs Voltfox (tCO₂e/t)</div>
          {loading ? (
            <div style={{ ...s.skel, height: 220 }} />
          ) : seeData.length === 0 ? (
            <div style={{ color: "#5c7a72", fontSize: 13, textAlign: "center", padding: "48px 0" }}>
              Hesaplanmış dönem yok — CBAM'dan SEE Hesapla
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={seeData} margin={{ top: 5, right: 10, bottom: 40, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#eef7f3" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: unknown) => [`${fmt(Number(v), 4)} tCO₂e/t`, ""] as [string, string]} />
                <Legend />
                <Bar dataKey="seeBaseline" name="Baseline" fill="#d4ece4" />
                <Bar dataKey="seeVoltfox"  name="Voltfox"  fill="#059669" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Audit Logs */}
      <div style={s.card}>
        <div style={s.cardH}>Son Aktiviteler</div>
        {auditLogs.length === 0 ? (
          <div style={{ color: "#5c7a72", fontSize: 13 }}>Henüz aktivite yok</div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 24px" }}>
            {auditLogs.map(log => (
              <div key={log.id} style={s.logRow}>
                <div style={s.logDot} />
                <div>
                  <div style={s.logTxt}>
                    <strong>{ACTION_LABELS[log.action] ?? log.action}</strong>
                    {" · "}
                    <span style={{ color: "#5c7a72" }}>{log.resource}</span>
                  </div>
                  <div style={s.logTs}>
                    {new Date(log.createdAt).toLocaleString("tr-TR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
