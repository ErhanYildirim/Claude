import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import type { EFZoneEntry, EFZoneSummary, EFMonthlyPoint, EFCoverageData, EFImportStatus } from "../lib/api.js";

/* ── Styles ──────────────────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1200, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  grid:    { display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" },
  card:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 16 },
  cardH:   { fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 14,
             textTransform: "uppercase" as const, letterSpacing: ".08em" },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, margin: "16px 0 12px" },
  kpiBox:  { background: "#eef7f3", borderRadius: 9, padding: "14px 16px" },
  kpiL:    { fontSize: 10, color: "#5c7a72", fontWeight: 700, marginBottom: 6,
             textTransform: "uppercase" as const, letterSpacing: ".06em" },
  kpiV:    { fontSize: 24, fontWeight: 800, lineHeight: 1 },
  kpiU:    { fontSize: 11, color: "#5c7a72", marginTop: 4 },
  pill:    { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600,
             background: "#e6f9f2", color: "#00b87a", display: "inline-block" },
  input:   { width: "100%", padding: "9px 12px", borderRadius: 7,
             border: "1px solid #d4ece4", fontSize: 13, outline: "none",
             background: "#f4fbf8" },
  zoneRow: { display: "flex", justifyContent: "space-between", alignItems: "center",
             padding: "8px 12px", borderRadius: 7, cursor: "pointer", marginBottom: 2,
             transition: "background .12s" },
  groupLabel: { fontSize: 10, fontWeight: 700, color: "#5c7a72",
                textTransform: "uppercase" as const, letterSpacing: ".08em",
                padding: "10px 12px 4px" },
};

function ciColor(ci: number) {
  if (ci < 100) return "#059669";
  if (ci < 200) return "#10b981";
  if (ci < 350) return "#d97706";
  if (ci < 500) return "#ef4444";
  return "#991b1b";
}

function CIBadge({ ci }: { ci: number }) {
  const color = ciColor(ci);
  const label = ci < 100 ? "Çok Temiz" : ci < 200 ? "Temiz" : ci < 350 ? "Orta" : ci < 500 ? "Yoğun" : "Çok Yoğun";
  return (
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700,
                   background: color + "18", color, display: "inline-block" }}>
      {ci.toFixed(0)} gCO₂ · {label}
    </span>
  );
}

/* ── API Docs ─────────────────────────────────────────────────────────────── */
function ApiDocsView({ zones }: { zones: EFZoneEntry[] }) {
  const exampleZone = zones[0]?.zoneId ?? "TR";
  const block = (code: string) => (
    <pre style={{
      background: "#0a1f1a", color: "#00b87a", borderRadius: 8,
      padding: "12px 16px", fontSize: 12, fontFamily: "monospace",
      overflowX: "auto", lineHeight: 1.6, margin: "8px 0 16px",
    }}>{code}</pre>
  );
  const heading = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", letterSpacing: ".08em",
                  textTransform: "uppercase", marginTop: 20, marginBottom: 8 }}>{t}</div>
  );
  const pill = (t: string, color = "#00b87a") => (
    <span key={t} style={{ background: color + "18", color, padding: "3px 10px",
                            borderRadius: 20, fontSize: 11, fontWeight: 600, marginRight: 6 }}>{t}</span>
  );

  const endpoints = [
    {
      method: "GET", path: "/api/v1/ef/zones",
      desc: "Tüm mevcut EF zone'larını listeler",
      response: `{ "count": 1, "zones": [{ "zoneId": "TR", "zoneName": "Turkey", "country": "Turkey", "rowCount": 8784 }] }`,
    },
    {
      method: "GET", path: `/api/v1/ef/zones/${exampleZone}`,
      desc: "Zone yıllık özeti: ortalama, min, max CI + CFE/RE yüzdesi",
      response: `{ "zoneId": "${exampleZone}", "ciDirect": { "avg": 380.2, "min": 45.0, "max": 820.5 }, "cfePct": { "avg": 32.1 }, "rowCount": 8784 }`,
    },
    {
      method: "GET", path: `/api/v1/ef/zones/${exampleZone}/hourly?start=2024-01-01&end=2024-01-07`,
      desc: "Saatlik EF verisi — start/end (ISO 8601) ile filtrelenebilir",
      response: `{ "zoneId": "${exampleZone}", "count": 168, "data": [{ "hour": "2024-01-01T00:00:00Z", "ciDirect": 412.5, "ciLifecycle": 450.2, "cfePct": 28.3, "rePct": 30.1, "dataEstimated": false }] }`,
    },
    {
      method: "GET", path: `/api/v1/ef/zones/${exampleZone}/monthly?year=2024`,
      desc: "Aylık agregat: ortalama CI, CFE%, RE% her ay için",
      response: `{ "zoneId": "${exampleZone}", "year": 2024, "months": [{ "month": 1, "monthName": "Jan", "avgCiDirect": 398.4, "avgCfePct": 29.2, "dataPoints": 744 }] }`,
    },
  ];

  return (
    <div style={{ maxWidth: 860 }}>
      <div style={{ ...s.card, marginBottom: 16 }}>
        {heading("Genel Bakış")}
        <p style={{ fontSize: 13, color: "#5c7a72", margin: "0 0 12px", lineHeight: 1.7 }}>
          EF Veri Servisi REST API'si, saatlik granüler emisyon faktörü verisine programatik erişim sağlar.
          63+ ülke, 170+ şebeke; saatlik verisi mevcut. GHG Protocol Scope 2 Location-Based metodolojisine uygundur.
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {pill("REST JSON")}
          {pill("Saatlik Granüler")}
          {pill("63+ Ülke", "#0284c7")}
          {pill("gCO₂eq/kWh", "#7c3aed")}
          {pill("UTC Saatlik", "#d97706")}
        </div>
      </div>

      <div style={s.card}>
        {heading("Kimlik Doğrulama")}
        <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 8 }}>
          Bearer token (JWT) veya API Key ile:
        </div>
        {block(`Authorization: Bearer <jwt_token>
# veya API Key ile:
Authorization: Bearer vf_<api_key>`)}

        {heading("Rate Limiting")}
        <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 4 }}>
          100 istek / dakika (IP başına). Aşıldığında <code>429 RATE_LIMIT_EXCEEDED</code> döner.
        </div>

        {heading("Endpoint'ler")}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {endpoints.map((ep, i) => (
            <div key={i} style={{ border: "1px solid #d4ece4", borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px",
                            background: "#f4fbf8", borderBottom: "1px solid #d4ece4" }}>
                <span style={{ background: "#00b87a", color: "#fff", padding: "2px 8px",
                               borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{ep.method}</span>
                <code style={{ fontSize: 13, color: "#0a1f1a" }}>{ep.path}</code>
              </div>
              <div style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 8 }}>{ep.desc}</div>
                {block(ep.response)}
              </div>
            </div>
          ))}
        </div>

        {heading("Kod Örnekleri")}
        <div style={{ fontSize: 12, fontWeight: 600, color: "#5c7a72", marginBottom: 4 }}>cURL</div>
        {block(`curl -H "Authorization: Bearer $TOKEN" \\
  "https://api.voltfox.io/api/v1/ef/zones/${exampleZone}/hourly?start=2024-01-01&end=2024-01-31"`)}

        <div style={{ fontSize: 12, fontWeight: 600, color: "#5c7a72", marginBottom: 4 }}>JavaScript</div>
        {block(`const res = await fetch(
  "/api/v1/ef/zones/${exampleZone}/hourly?start=2024-01-01&end=2024-01-31",
  { headers: { Authorization: \`Bearer \${token}\` } }
);
const { data } = await res.json();
// data: [{ hour, ciDirect, cfePct, rePct, dataEstimated }]`)}

        <div style={{ fontSize: 12, fontWeight: 600, color: "#5c7a72", marginBottom: 4 }}>Python</div>
        {block(`import requests

r = requests.get(
    "/api/v1/ef/zones/${exampleZone}/hourly",
    params={"start": "2024-01-01", "end": "2024-01-31"},
    headers={"Authorization": f"Bearer {token}"}
)
data = r.json()["data"]  # list of hourly EF points`)}

        {heading("Veri Yapısı")}
        {block(`interface EFHourlyPoint {
  hour:          string;   // ISO 8601 UTC "2024-01-01T00:00:00.000Z"
  ciDirect:      number;   // gCO₂eq/kWh — lokasyon bazlı (Scope 2)
  ciLifecycle:   number;   // gCO₂eq/kWh — yaşam döngüsü
  cfePct:        number;   // 0-100 — karbon serbest enerji yüzdesi
  rePct:         number;   // 0-100 — yenilenebilir enerji yüzdesi
  dataEstimated: boolean;  // true ise modelle tahmin edilen
}`)}
      </div>
    </div>
  );
}

/* ── Coverage View ──────────────────────────────────────────────────────── */
function CoverageView({ coverage, importStatus }: { coverage: EFCoverageData | null; importStatus: EFImportStatus | null }) {
  if (!coverage) {
    return (
      <div style={{ ...s.card, textAlign: "center", padding: "60px 40px" }}>
        <div style={{ fontSize: 13, color: "#5c7a72" }}>Kapsam verisi yükleniyor…</div>
      </div>
    );
  }

  const years = coverage.availableYears;
  function expectedHours(yr: number) {
    return (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0 ? 8784 : 8760;
  }

  return (
    <div>
      <div style={{ ...s.card, marginBottom: 16 }}>
        <div style={s.cardH}>Mevcut Yıllar</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {years.map(y => (
            <div key={y} style={{ background: "#e6f9f2", border: "1px solid #a7f3d0",
                                   borderRadius: 8, padding: "10px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#00b87a" }}>{y}</div>
              <div style={{ fontSize: 11, color: "#5c7a72" }}>
                {coverage.zones.filter(z => z.years.some(yr => yr.year === y)).length} zone
              </div>
              <div style={{ fontSize: 10, color: "#5c7a72" }}>{expectedHours(y).toLocaleString()} saat/zone</div>
            </div>
          ))}
          {years.length === 0 && <div style={{ color: "#5c7a72", fontSize: 13 }}>Veri yok</div>}
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardH}>Zone × Yıl Kapsam Matrisi</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 10px", color: "#5c7a72",
                             borderBottom: "1px solid #d4ece4", fontWeight: 700 }}>Zone</th>
                <th style={{ textAlign: "left", padding: "6px 10px", color: "#5c7a72",
                             borderBottom: "1px solid #d4ece4", fontWeight: 700 }}>Ülke</th>
                {years.map(y => (
                  <th key={y} style={{ textAlign: "center", padding: "6px 10px", color: "#5c7a72",
                                       borderBottom: "1px solid #d4ece4", fontWeight: 700 }}>{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverage.zones.map(zone => (
                <tr key={zone.zoneId} style={{ borderBottom: "1px solid #eef7f3" }}>
                  <td style={{ padding: "6px 10px", fontWeight: 700, color: "#0a1f1a" }}>{zone.zoneId}</td>
                  <td style={{ padding: "6px 10px", color: "#5c7a72" }}>{zone.country}</td>
                  {years.map(y => {
                    const yd = zone.years.find(yr => yr.year === y);
                    return (
                      <td key={y} style={{ textAlign: "center", padding: "6px 10px" }}>
                        {yd ? (
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 11,
                            background: yd.complete ? "#e6f9f2" : "#fef3c7",
                            color: yd.complete ? "#009966" : "#d97706", fontWeight: 600,
                          }}>
                            {yd.complete ? `✓ ${(yd.rowCount / 1000).toFixed(1)}k` : `${(yd.rowCount / 1000).toFixed(1)}k`}
                          </span>
                        ) : (
                          <span style={{ color: "#d1d5db", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 12 }}>
          ✓ = Tam veri (%99+) · Sarı = Eksik/kısmi veri · — = Veri yok
        </div>
      </div>

      <div style={{ ...s.card, marginTop: 16 }}>
        <div style={s.cardH}>Otomatik Güncelleme Durumu</div>
        {importStatus ? (
          <div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
              <div style={{ background: "#f4fbf8", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Son Çalışma</div>
                {importStatus.lastImport ? (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 700, color: importStatus.lastImport.status === "ok" ? "#059669" : "#DC2626" }}>
                      {importStatus.lastImport.status === "ok" ? "✓ Başarılı" : "✗ Hata"}
                    </div>
                    <div style={{ fontSize: 12, color: "#5c7a72", marginTop: 2 }}>
                      {new Date(importStatus.lastImport.createdAt).toLocaleString("tr-TR")}
                    </div>
                    {importStatus.lastImport.message && (
                      <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 4, lineHeight: 1.5 }}>
                        {importStatus.lastImport.message}
                      </div>
                    )}
                  </>
                ) : (
                  <div style={{ fontSize: 13, color: "#94a3b8" }}>Henüz çalışmadı</div>
                )}
              </div>
              <div style={{ background: "#f4fbf8", borderRadius: 8, padding: "12px 14px" }}>
                <div style={{ fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Sonraki Çalışma</div>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#0a1f1a" }}>
                  {new Date(importStatus.nextScheduledRun).toLocaleString("tr-TR")}
                </div>
                <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 2 }}>
                  Zamanlama: {importStatus.schedule} (UTC)
                </div>
                <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 2 }}>
                  Toplam: {importStatus.totalRows.toLocaleString()} satır
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: "#5c7a72" }}>Durum bilgisi yükleniyor…</div>
        )}
        <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 10, lineHeight: 1.7, marginTop: 12 }}>
          Manuel import için CLI komutu:
        </div>
        <pre style={{ background: "#0a1f1a", color: "#00b87a", borderRadius: 8,
                      padding: "12px 16px", fontSize: 12, fontFamily: "monospace",
                      overflowX: "auto", lineHeight: 1.6, margin: 0 }}>
{`npx tsx scripts/import-ef-year.ts --year=2025
# Belirli zone'lar için:
npx tsx scripts/import-ef-year.ts --year=2025 --zone=TR,DE,FR
# Devam etmek için (hata sonrası):
npx tsx scripts/import-ef-year.ts --year=2025 --resume=10
# Dry run (yazma yapmadan test):
npx tsx scripts/import-ef-year.ts --year=2025 --dry-run`}
        </pre>
      </div>
    </div>
  );
}

/* ── Component ───────────────────────────────────────────────────────────── */
export default function EfDataPage() {
  const [zones,         setZones]         = useState<EFZoneEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [selected,      setSelected]      = useState<EFZoneEntry | null>(null);
  const [summary,       setSummary]       = useState<EFZoneSummary | null>(null);
  const [monthly,       setMonthly]       = useState<EFMonthlyPoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dbEmpty,       setDbEmpty]       = useState(false);
  const [activeTab,     setActiveTab]     = useState<"data" | "api" | "coverage">("data");
  const [hourlyData,    setHourlyData]    = useState<{ hour: string; ciDirect: number; cfePct: number }[]>([]);
  const [hourlyStart,   setHourlyStart]   = useState(`${new Date().getFullYear()}-01-01`);
  const [hourlyEnd,     setHourlyEnd]     = useState(`${new Date().getFullYear()}-01-07`);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear());
  const [availableYears,setAvailableYears]= useState<number[]>([new Date().getFullYear()]);
  const [coverage,      setCoverage]      = useState<EFCoverageData | null>(null);
  const [importStatus,  setImportStatus]  = useState<EFImportStatus | null>(null);

  /* selectZone — önce tanımla, sonra useEffect içinde kullan */
  async function selectZone(zone: EFZoneEntry, year = selectedYear) {
    setSelected(zone);
    setSummary(null);
    setMonthly([]);
    setDetailLoading(true);
    try {
      const [sum, mon] = await Promise.all([
        api.ef.zone(zone.zoneId),
        api.ef.monthly(zone.zoneId, year),
      ]);
      setSummary(sum);
      setMonthly(mon.months);
    } catch {
      /* veri henüz yok */
    } finally {
      setDetailLoading(false);
    }
  }

  useEffect(() => {
    Promise.all([
      api.ef.zones(),
      api.ef.coverage().catch(() => null),
      api.ef.importStatus().catch(() => null),
    ]).then(([zonesRes, cov, imp]) => {
      if (imp) setImportStatus(imp);
      setLoading(false);
      if (cov) {
        setCoverage(cov);
        if (cov.availableYears.length > 0) {
          const latest = Math.max(...cov.availableYears);
          setAvailableYears(cov.availableYears);
          setSelectedYear(latest);
          setHourlyStart(`${latest}-01-01`);
          setHourlyEnd(`${latest}-01-07`);
        }
      }
      if (zonesRes.count === 0) { setDbEmpty(true); return; }
      setZones(zonesRes.zones);
      const tr = zonesRes.zones.find((z) => z.zoneId === "TR") ?? zonesRes.zones[0];
      const yr = cov && cov.availableYears.length > 0 ? Math.max(...cov.availableYears) : new Date().getFullYear();
      selectZone(tr, yr);
    }).catch(() => { setLoading(false); setDbEmpty(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selected) return;
    setHourlyLoading(true);
    api.ef.hourly(selected.zoneId, hourlyStart, hourlyEnd)
      .then(r => setHourlyData(r.data.map(d => ({
        hour: new Date(d.hour).toISOString().slice(5, 13).replace("T", " "),
        ciDirect: d.ciDirect,
        cfePct: d.cfePct,
      }))))
      .catch(() => setHourlyData([]))
      .finally(() => setHourlyLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, hourlyStart, hourlyEnd]);

  async function changeYear(yr: number) {
    setSelectedYear(yr);
    if (selected) {
      setMonthly([]);
      setDetailLoading(true);
      try {
        const mon = await api.ef.monthly(selected.zoneId, yr);
        setMonthly(mon.months);
      } catch { /* no data for this year */ }
      finally { setDetailLoading(false); }
    }
  }

  /* Zone listesi filtrelemesi */
  const filtered = zones.filter((z) =>
    z.country.toLowerCase().includes(search.toLowerCase()) ||
    z.zoneId.toLowerCase().includes(search.toLowerCase())
  );

  const byCountry: Record<string, EFZoneEntry[]> = {};
  for (const z of filtered) (byCountry[z.country] ??= []).push(z);

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <div style={s.page}>
      <div style={s.h1}>EF Veri Servisi</div>
      <div style={s.sub}>
        {loading
          ? "Yükleniyor..."
          : dbEmpty
            ? "Emisyon faktörü verisi henüz yüklenmemiş"
            : `${zones.length} zone · ${availableYears.join(", ")} · Saatlik granüler EF verisi · Kaynak: Electricity Maps`}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #d4ece4" }}>
        {(["data", "coverage", "api"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "8px 18px", border: "none", cursor: "pointer", fontWeight: 600,
            fontSize: 13, borderRadius: "6px 6px 0 0",
            background: activeTab === tab ? "#fff" : "transparent",
            color: activeTab === tab ? "#0a1f1a" : "#5c7a72",
            borderBottom: activeTab === tab ? "2px solid #00b87a" : "2px solid transparent",
          }}>
            {tab === "data" ? "Veri Servisi" : tab === "coverage" ? "Veri Kapsamı" : "API Dokümantasyonu"}
          </button>
        ))}
      </div>

      {activeTab === "api" ? (
        <ApiDocsView zones={zones} />
      ) : activeTab === "coverage" ? (
        <CoverageView coverage={coverage} importStatus={importStatus} />
      ) : dbEmpty ? (
        <div style={{ ...s.card, textAlign: "center", padding: "60px 40px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>EF Verisi Bulunamadı</div>
          <div style={{ fontSize: 14, color: "#5c7a72" }}>
            Import scripti çalıştırın: <code>npx tsx scripts/import-ef-year.ts --year=2025</code>
          </div>
        </div>
      ) : (
        <div style={s.grid}>

          {/* ── Sol: Zone Listesi ───────────────────────────────────────── */}
          <div style={s.card}>
            <input
              style={s.input}
              placeholder="Zone veya ülke ara..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <div style={{ marginTop: 8, maxHeight: 680, overflowY: "auto" }}>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ background: "#eef7f3", borderRadius: 7,
                                          height: 36, marginBottom: 4, opacity: 0.7 - i * 0.08 }} />
                  ))
                : Object.entries(byCountry).map(([country, czones]) => (
                    <div key={country}>
                      <div style={s.groupLabel}>{country}</div>
                      {czones.map((z) => {
                        const active = selected?.zoneId === z.zoneId;
                        return (
                          <div
                            key={z.zoneId}
                            onClick={() => selectZone(z)}
                            style={{
                              ...s.zoneRow,
                              background: active ? "#00b87a" : "transparent",
                              color: active ? "#fff" : "#0a1f1a",
                            }}
                            onMouseEnter={(e) => {
                              if (!active)
                                (e.currentTarget as HTMLElement).style.background = "#eef7f3";
                            }}
                            onMouseLeave={(e) => {
                              if (!active)
                                (e.currentTarget as HTMLElement).style.background = "transparent";
                            }}
                          >
                            <div>
                              <span style={{ fontWeight: 700, fontSize: 13 }}>{z.zoneId}</span>
                              {z.zoneId !== z.zoneName && (
                                <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.65 }}>
                                  {z.zoneName}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: 11, opacity: 0.6 }}>
                              {(z.rowCount / 1000).toFixed(1)}k
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))
              }
            </div>
          </div>

          {/* ── Sağ: Zone Detayı ────────────────────────────────────────── */}
          <div>
            {!selected ? (
              <div style={{ ...s.card, textAlign: "center", padding: "60px 20px", color: "#5c7a72" }}>
                Sol listeden bir zone seçin
              </div>
            ) : detailLoading ? (
              <div style={{ ...s.card, textAlign: "center", padding: "60px 20px", color: "#5c7a72" }}>
                Yükleniyor...
              </div>
            ) : (
              <>
                {/* Header kartı */}
                <div style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0a1f1a" }}>
                        {selected.zoneId}
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#5c7a72", marginLeft: 8 }}>
                          {selected.zoneName}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#5c7a72", marginTop: 2 }}>
                        {selected.country}
                      </div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={s.pill}>Saatlik</span>
                      <select value={selectedYear} onChange={e => changeYear(Number(e.target.value))}
                        style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #d4ece4",
                                 fontSize: 12, background: "#fff", cursor: "pointer" }}>
                        {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                      </select>
                    </div>
                  </div>

                  {summary && (
                    <>
                      <div style={s.kpiGrid}>
                        <div style={s.kpiBox}>
                          <div style={s.kpiL}>Yıllık Ort. CI (Direkt)</div>
                          <div style={{ ...s.kpiV, color: ciColor(summary.ciDirect.avg) }}>
                            {summary.ciDirect.avg.toFixed(0)}
                          </div>
                          <div style={s.kpiU}>gCO₂eq/kWh</div>
                        </div>
                        <div style={s.kpiBox}>
                          <div style={s.kpiL}>Karbon Serbest Enerji</div>
                          <div style={{ ...s.kpiV, color: "#00b87a" }}>
                            {summary.cfePct.avg.toFixed(1)}%
                          </div>
                          <div style={s.kpiU}>CFE — {selectedYear} ortalaması</div>
                        </div>
                        <div style={s.kpiBox}>
                          <div style={s.kpiL}>Yenilenebilir Enerji</div>
                          <div style={{ ...s.kpiV, color: "#009966" }}>
                            {summary.rePct.avg.toFixed(1)}%
                          </div>
                          <div style={s.kpiU}>RE — {selectedYear} ortalaması</div>
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                        <CIBadge ci={summary.ciDirect.avg} />
                        <span style={{ fontSize: 12, color: "#5c7a72" }}>
                          Min {summary.ciDirect.min.toFixed(0)} · Max {summary.ciDirect.max.toFixed(0)} gCO₂/kWh
                        </span>
                        <span style={{ fontSize: 12, color: "#5c7a72" }}>
                          {summary.rowCount.toLocaleString()} saatlik veri noktası
                        </span>
                      </div>
                    </>
                  )}
                </div>

                {/* Aylık CI Bar Chart */}
                {monthly.length > 0 && (
                  <div style={s.card}>
                    <div style={s.cardH}>Aylık Ortalama Emisyon Yoğunluğu — {selectedYear}</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthly} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
                        <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: "#5c7a72" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit=" g" />
                        <Tooltip
                          formatter={(v: unknown) =>
                            [`${Number(v).toFixed(1)} gCO₂/kWh`, "CI Direkt"] as [string, string]
                          }
                          labelStyle={{ fontWeight: 600, color: "#0a1f1a" }}
                          contentStyle={{ borderRadius: 8, border: "1px solid #d4ece4", fontSize: 12 }}
                        />
                        <Bar dataKey="avgCiDirect" fill="#0a1f1a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* CFE & RE Line Chart */}
                {monthly.length > 0 && (
                  <div style={s.card}>
                    <div style={s.cardH}>Karbon Serbest & Yenilenebilir Enerji % — {selectedYear}</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={monthly} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
                        <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: "#5c7a72" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit="%" domain={[0, 100]} />
                        <Tooltip
                          formatter={(v: unknown, name: unknown) =>
                            [`${Number(v).toFixed(1)}%`, String(name ?? "")] as [string, string]
                          }
                          contentStyle={{ borderRadius: 8, border: "1px solid #d4ece4", fontSize: 12 }}
                        />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Line
                          dataKey="avgCfePct" name="CFE %"
                          stroke="#00b87a" strokeWidth={2} dot={false} activeDot={{ r: 4 }}
                        />
                        <Line
                          dataKey="avgRePct" name="RE %"
                          stroke="#009966" strokeWidth={2} dot={false}
                          strokeDasharray="4 3" activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* Saatlik Zaman Serisi */}
                <div style={s.card}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={s.cardH}>Saatlik Emisyon Yoğunluğu</div>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      <input type="date" value={hourlyStart} min={`${selectedYear}-01-01`} max={`${selectedYear}-12-25`}
                        onChange={e => setHourlyStart(e.target.value)}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d4ece4", fontSize: 12 }} />
                      <span style={{ fontSize: 12, color: "#5c7a72" }}>→</span>
                      <input type="date" value={hourlyEnd} min={`${selectedYear}-01-07`} max={`${selectedYear}-12-31`}
                        onChange={e => setHourlyEnd(e.target.value)}
                        style={{ padding: "5px 8px", borderRadius: 6, border: "1px solid #d4ece4", fontSize: 12 }} />
                    </div>
                  </div>
                  {hourlyLoading ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#5c7a72", fontSize: 13 }}>Yükleniyor…</div>
                  ) : hourlyData.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "40px 0", color: "#5c7a72", fontSize: 13 }}>Veri bulunamadı</div>
                  ) : (
                    <>
                      <ResponsiveContainer width="100%" height={200}>
                        <LineChart data={hourlyData} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
                          <XAxis dataKey="hour" tick={{ fontSize: 9, fill: "#5c7a72" }}
                            interval={Math.floor(hourlyData.length / 8)} />
                          <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit=" g" width={52} />
                          <Tooltip
                            formatter={(v: unknown) => [`${Number(v).toFixed(1)} gCO₂/kWh`, "CI Direkt"] as [string, string]}
                            contentStyle={{ borderRadius: 8, border: "1px solid #d4ece4", fontSize: 12 }}
                          />
                          <Line dataKey="ciDirect" name="CI Direkt" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                      <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 8 }}>
                        {hourlyData.length} saatlik veri noktası
                      </div>
                    </>
                  )}
                </div>

                {/* API Erişimi */}
                <div style={s.card}>
                  <div style={s.cardH}>API Erişimi</div>
                  <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 10 }}>
                    Bu zone için saatlik EF verisi REST API üzerinden erişilebilir:
                  </div>
                  <code style={{
                    display: "block", background: "#0a1f1a", color: "#00b87a",
                    borderRadius: 8, padding: "12px 16px", fontSize: 12,
                    fontFamily: "monospace", overflowX: "auto", lineHeight: 1.6,
                  }}>
                    GET /api/v1/ef/zones/{selected.zoneId}/hourly
                    <br />
                    &nbsp;&nbsp;?start=2024-01-01&end=2024-12-31
                  </code>
                  <div style={{ marginTop: 10, display: "flex", gap: 8, flexWrap: "wrap" }}>
                    {["JSON", "8 784 veri noktası/yıl", "gCO₂eq/kWh", "UTC saatlik"].map((t) => (
                      <span key={t} style={{ ...s.pill, fontSize: 11 }}>{t}</span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>

        </div>
      )}
    </div>
  );
}
