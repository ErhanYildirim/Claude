import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from "recharts";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { EFZoneEntry, EFCoverageData, EFImportStatus } from "../lib/api.js";

function ciColor(ci: number) {
  if (ci < 100) return "#059669";
  if (ci < 200) return "#10b981";
  if (ci < 350) return "#d97706";
  if (ci < 500) return "#ef4444";
  return "#991b1b";
}

const CI_CATEGORIES = [
  { label: "Çok Temiz",  range: "<100 gCO₂",  color: "#059669", max: 100 },
  { label: "Temiz",      range: "100–200",       color: "#10b981", max: 200 },
  { label: "Orta",       range: "200–350",       color: "#d97706", max: 350 },
  { label: "Yoğun",      range: "350–500",       color: "#ef4444", max: 500 },
  { label: "Çok Yoğun",  range: ">500 gCO₂",   color: "#991b1b", max: Infinity },
];

function ciCategory(ci: number) {
  return CI_CATEGORIES.findIndex(c => ci < c.max);
}

export default function EfDataPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1a3530" : "#eef7f3";
  const card: React.CSSProperties = { background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: "20px", marginBottom: 16 };
  const cardH: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".08em" };

  const [zones,        setZones]        = useState<EFZoneEntry[]>([]);
  const [coverage,     setCoverage]     = useState<EFCoverageData | null>(null);
  const [importStatus, setImportStatus] = useState<EFImportStatus | null>(null);
  const [loading,      setLoading]      = useState(true);
  const [dbEmpty,      setDbEmpty]      = useState(false);

  // Per-zone avg CI for distribution (loaded lazily, top 20 by rowCount)
  const [zoneStats, setZoneStats] = useState<{ zoneId: string; avgCi: number; rowCount: number }[]>([]);

  useEffect(() => {
    Promise.all([
      api.ef.zones(),
      api.ef.coverage().catch(() => null),
      api.ef.importStatus().catch(() => null),
    ]).then(([zonesRes, cov, imp]) => {
      setLoading(false);
      if (imp) setImportStatus(imp);
      if (cov) setCoverage(cov);
      if (zonesRes.count === 0) { setDbEmpty(true); return; }
      setZones(zonesRes.zones);
      // Load top 20 zone summaries for distribution chart
      const top20 = [...zonesRes.zones].sort((a, b) => b.rowCount - a.rowCount).slice(0, 20);
      Promise.allSettled(top20.map(z => api.ef.zone(z.zoneId))).then(results => {
        const stats = results
          .map((r, i) => r.status === "fulfilled" ? { zoneId: top20[i].zoneId, avgCi: r.value.ciDirect.avg, rowCount: top20[i].rowCount } : null)
          .filter(Boolean) as { zoneId: string; avgCi: number; rowCount: number }[];
        setZoneStats(stats);
      });
    }).catch(() => { setLoading(false); setDbEmpty(true); });
  }, []);

  const totalRows = coverage?.zones.reduce((s, z) => s + z.years.reduce((ys, y) => ys + y.rowCount, 0), 0) ?? 0;
  const yearCount = coverage?.availableYears.length ?? 0;

  // CI category distribution
  const catCounts = CI_CATEGORIES.map(c => ({ ...c, count: 0 }));
  for (const z of zoneStats) {
    const idx = ciCategory(z.avgCi);
    if (idx >= 0) catCounts[idx].count++;
  }
  const catData = catCounts.filter(c => c.count > 0).map(c => ({ name: c.label, count: c.count, color: c.color }));

  // Top 10 cleanest zones
  const top10Clean = [...zoneStats].sort((a, b) => a.avgCi - b.avgCi).slice(0, 10);

  // Quick link cards
  const subPages = [
    { path: "/ef-data/zones", icon: "🌐", title: "Zone Tarayıcı", desc: `${zones.length} zone · Aylık & saatlik CI grafikleri` },
    { path: "/ef-data/coverage", icon: "📋", title: "Kapsam Yönetimi", desc: `${yearCount} yıl · Zone × yıl matris` },
    { path: "/ef-data/api", icon: "🔌", title: "API Dokümantasyonu", desc: "REST API · Kod örnekleri · Endpoint listesi" },
  ];

  if (loading) return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px", color: muted }}>Yükleniyor...</div>;

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>EF Veri Dashboard</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 28 }}>
        {dbEmpty
          ? "Emisyon faktörü verisi henüz yüklenmemiş"
          : `${zones.length} zone · ${coverage?.availableYears.join(", ") ?? "—"} · Kaynak: Electricity Maps`}
      </div>

      {dbEmpty ? (
        <div style={{ ...card, textAlign: "center", padding: "80px 40px" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: 18, fontWeight: 700, color: text, marginBottom: 8 }}>EF Verisi Bulunamadı</div>
          <div style={{ fontSize: 14, color: muted }}>
            Import scripti çalıştırın: <code>npx tsx scripts/import-ef-year.ts --year=2025</code>
          </div>
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 }}>
            {[
              { label: "Zone Sayısı",         value: zones.length.toString(),              color: "#00b87a",  desc: "Ülke & bölge" },
              { label: "Kapsanan Yıllar",     value: yearCount.toString(),                 color: "#0284c7",  desc: coverage?.availableYears.join(", ") ?? "—" },
              { label: "Toplam Veri Noktası", value: (totalRows / 1_000_000).toFixed(1) + "M", color: text, desc: "Saatlik kayıt" },
              { label: "Son Güncelleme",      value: importStatus?.lastImport ? (importStatus.lastImport.status === "ok" ? "✓" : "✗") : "—",
                color: importStatus?.lastImport?.status === "ok" ? "#059669" : "#dc2626",
                desc: importStatus?.lastImport ? new Date(importStatus.lastImport.createdAt).toLocaleDateString("tr-TR") : "Bilinmiyor" },
            ].map(k => (
              <div key={k.label} style={{ background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "18px 20px" }}>
                <div style={{ fontSize: 11, color: muted, marginBottom: 4, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".05em" }}>{k.label}</div>
                <div style={{ fontSize: 22, fontWeight: 800, color: k.color, marginBottom: 2 }}>{k.value}</div>
                <div style={{ fontSize: 11, color: muted }}>{k.desc}</div>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            {/* CI Category distribution */}
            {catData.length > 0 && (
              <div style={card}>
                <div style={cardH}>CI Kategori Dağılımı</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={catData} margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? "rgba(255,255,255,.06)" : "#d4ece4"} />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: muted }} />
                    <YAxis tick={{ fontSize: 11, fill: muted }} />
                    <Tooltip
                      formatter={(v: unknown) => [`${v} zone`, "Sayı"] as [string, string]}
                      contentStyle={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: text }}
                    />
                    <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                      {catData.map((c, i) => <Cell key={i} fill={c.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  {CI_CATEGORIES.map(c => (
                    <span key={c.label} style={{ fontSize: 11, background: c.color + "18", color: c.color, padding: "2px 8px", borderRadius: 10, fontWeight: 600 }}>
                      {c.label} {c.range}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Top 10 cleanest */}
            {top10Clean.length > 0 && (
              <div style={card}>
                <div style={cardH}>En Temiz 10 Zone</div>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {top10Clean.map((z, i) => (
                    <div key={z.zoneId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div style={{ width: 20, fontSize: 12, color: muted, fontWeight: 700, textAlign: "right", flexShrink: 0 }}>{i + 1}</div>
                      <Link to="/ef-data/zones" style={{ fontSize: 13, fontWeight: 700, color: "#00b87a", textDecoration: "none", width: 40, flexShrink: 0 }}>{z.zoneId}</Link>
                      <div style={{ flex: 1, height: 8, borderRadius: 4, background: isDark ? "#1a3530" : "#eef7f3", overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${Math.min((z.avgCi / 500) * 100, 100)}%`, background: ciColor(z.avgCi), borderRadius: 4, transition: "width .3s" }} />
                      </div>
                      <span style={{ fontSize: 12, color: ciColor(z.avgCi), fontWeight: 700, width: 52, textAlign: "right", flexShrink: 0 }}>
                        {z.avgCi.toFixed(0)} g
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Sub-page quick links */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
            {subPages.map(p => (
              <Link
                key={p.path}
                to={p.path}
                style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: "20px", textDecoration: "none", transition: "border-color .15s, box-shadow .15s", display: "block" }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#00b87a"; (e.currentTarget as HTMLElement).style.boxShadow = "0 4px 16px rgba(0,184,122,.12)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = border; (e.currentTarget as HTMLElement).style.boxShadow = "none"; }}
              >
                <div style={{ fontSize: 28, marginBottom: 10 }}>{p.icon}</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: text, marginBottom: 6 }}>{p.title}</div>
                <div style={{ fontSize: 12, color: muted, lineHeight: 1.6 }}>{p.desc}</div>
                <div style={{ fontSize: 12, color: "#00b87a", marginTop: 10, fontWeight: 600 }}>Aç →</div>
              </Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
