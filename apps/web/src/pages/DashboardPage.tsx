import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import type { InstallationDetail, EmbeddedEmission } from "../lib/api.js";
import { fmtTco2, fmtEur, fmt } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:    { fontSize: 14, color: "#5c7a72", marginBottom: 28 },

  kpiGrid:{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 },
  kpi:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:   { fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 6,
            textTransform: "uppercase" as const, letterSpacing: ".06em" },
  kpiV:   { fontSize: 26, fontWeight: 800, color: "#0a1f1a", lineHeight: 1 },
  kpiU:   { fontSize: 11, color: "#5c7a72", marginTop: 4 },

  prodGrid:{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 16, marginBottom: 24 },
  prod:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px",
            display: "flex", flexDirection: "column" as const, gap: 10 },
  prodH:  { display: "flex", alignItems: "center", gap: 10 },
  prodIcon:{ fontSize: 22 },
  prodTitle:{ fontSize: 15, fontWeight: 700, color: "#0a1f1a" },
  prodSub:{ fontSize: 12, color: "#5c7a72" },
  statRow:{ display: "flex", gap: 16, flexWrap: "wrap" as const },
  stat:   { textAlign: "center" as const },
  statV:  { fontSize: 20, fontWeight: 800, color: "#0a1f1a" },
  statL:  { fontSize: 11, color: "#5c7a72" },
  cta:    { display: "inline-block", marginTop: "auto", padding: "7px 14px", borderRadius: 7,
            background: "#e6f9f2", color: "#009966", fontSize: 13, fontWeight: 600,
            textDecoration: "none", alignSelf: "flex-start" as const },

  row2:   { display: "grid", gridTemplateColumns: "1fr 340px", gap: 20, marginBottom: 20 },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px" },
  cardH:  { fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 16,
            textTransform: "uppercase" as const, letterSpacing: ".08em" },

  logRow: { display: "flex", gap: 10, padding: "8px 0", borderBottom: "1px solid #eef7f3", alignItems: "flex-start" },
  logDot: { width: 7, height: 7, borderRadius: "50%", background: "#00b87a", marginTop: 4, flexShrink: 0 },
  logTxt: { fontSize: 12, color: "#1a3530", lineHeight: 1.4 },
  logTs:  { fontSize: 11, color: "#5c7a72", marginTop: 2 },

  skel:   { background: "#eef7f3", borderRadius: 8 },
};

interface PeriodWithInst { facilityName: string; periodName: string; result: EmbeddedEmission; }

const ACTION_LABELS: Record<string, string> = {
  CALCULATE: "SEE Hesaplandı",
  IMPORT_CFE_CSV: "CFE CSV Yüklendi",
  CREATE: "Oluşturuldu",
  DELETE: "Silindi",
  UPDATE: "Güncellendi",
};

export default function DashboardPage() {
  const [installations, setInstallations] = useState<InstallationDetail[]>([]);
  const [efZoneCount,   setEfZoneCount]   = useState<number | null>(null);
  const [auditLogs,     setAuditLogs]     = useState<Array<{ id: string; action: string; resource: string; createdAt: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [list, efRes, logsRes] = await Promise.all([
        api.installations.list(),
        api.ef.zones().catch(() => ({ count: 0, zones: [] })),
        api.auditLogs.list({ limit: 8 }).catch(() => ({ logs: [], nextCursor: null, count: 0 })),
      ]);
      const details = await Promise.all(list.map(i => api.installations.get(i.id)));
      setInstallations(details);
      setEfZoneCount(efRes.count);
      setAuditLogs(logsRes.logs);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  const allPeriods    = installations.flatMap(i => i.periods);
  const withResult: PeriodWithInst[] = installations.flatMap(inst =>
    inst.periods.filter(p => p.result).map(p => ({
      facilityName: inst.facilityName, periodName: p.periodName, result: p.result!,
    }))
  );

  const gecConnected  = allPeriods.filter(p => p.gecConnected);
  const avgCfe        = gecConnected.length > 0
    ? gecConnected.reduce((s, p) => s + p.matchingRatePct, 0) / gecConnected.length : 0;
  const totalReduction = withResult.reduce((s, p) => s + p.result.reductionTco2, 0);
  const totalSavings   = withResult.reduce((s, p) => s + (p.result.savingsVsDefaultEur ?? 0), 0);

  const seeData = withResult.map(p => ({
    name:        `${p.facilityName.slice(0, 8)}/${p.periodName.slice(0, 4)}`,
    seeBaseline: p.result.seeBaseline,
    seeVoltfox:  p.result.seeVoltfox,
  }));

  const Skel = ({ w, h }: { w: number | string; h: number }) => (
    <div style={{ ...s.skel, width: w, height: h }} />
  );

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
          <div style={s.kpiU}>{allPeriods.length} dönem</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>CBAM Azaltım</div>
          {loading ? <Skel w={80} h={28} /> : <div style={{ ...s.kpiV, color: "#059669" }}>{fmtTco2(totalReduction)}</div>}
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
          <div style={s.kpiU}>2024 saatlik · 96K+ satır</div>
        </div>
      </div>

      {/* 4 Ürün kartları */}
      <div style={s.prodGrid}>

        {/* GEC */}
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
          </div>
          <div style={{ fontSize: 12, color: "#5c7a72", background: "#f4fbf8", borderRadius: 7, padding: "8px 12px" }}>
            CSV yükle → saatlik tüketim × TR/EU EF → anlık tCO₂ sonucu
          </div>
          <Link to="/gec" style={s.cta}>GEC Hesapla →</Link>
        </div>

        {/* CBAM */}
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

        {/* CFE */}
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

        {/* EF Veri Servisi */}
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
              <div style={s.statV}>96K+</div>
              <div style={s.statL}>Satır</div>
            </div>
            <div style={s.stat}>
              <div style={s.statV}>2024</div>
              <div style={s.statL}>Yıl</div>
            </div>
          </div>
          <div style={{ fontSize: 12, color: "#5c7a72", background: "#f4fbf8", borderRadius: 7, padding: "8px 12px" }}>
            TR · DE · FR · AT · PL · IT · ES · GB · NL · BE · SE
          </div>
          <Link to="/ef-data" style={s.cta}>Zone Tarayıcı →</Link>
        </div>
      </div>

      {/* Alt bölüm: SEE chart + Audit logs */}
      <div style={s.row2}>

        {/* SEE Karşılaştırma */}
        <div style={s.card}>
          <div style={s.cardH}>SEE Karşılaştırması — Baseline vs Voltfox (tCO₂e/t)</div>
          {loading ? (
            <div style={{ ...s.skel, height: 240 }} />
          ) : seeData.length === 0 ? (
            <div style={{ color: "#5c7a72", fontSize: 13, textAlign: "center", padding: "48px 0" }}>
              Hesaplanmış dönem yok — CBAM'dan SEE Hesapla
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
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

        {/* Audit Logs */}
        <div style={s.card}>
          <div style={s.cardH}>Son Aktiviteler</div>
          {auditLogs.length === 0 ? (
            <div style={{ color: "#5c7a72", fontSize: 13 }}>Henüz aktivite yok</div>
          ) : (
            auditLogs.map(log => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
}
