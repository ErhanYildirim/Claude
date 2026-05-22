import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import type { EFZoneEntry, EFZoneSummary, EFMonthlyPoint } from "../lib/api.js";

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
          63+ ülke, 170+ şebeke; 2024 verisi mevcut. GHG Protocol Scope 2 Location-Based metodolojisine uygundur.
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
  const [activeTab,     setActiveTab]     = useState<"data" | "api">("data");

  /* selectZone — önce tanımla, sonra useEffect içinde kullan */
  async function selectZone(zone: EFZoneEntry) {
    setSelected(zone);
    setSummary(null);
    setMonthly([]);
    setDetailLoading(true);
    try {
      const [sum, mon] = await Promise.all([
        api.ef.zone(zone.zoneId),
        api.ef.monthly(zone.zoneId, 2024),
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
    api.ef.zones()
      .then((r) => {
        setLoading(false);
        if (r.count === 0) { setDbEmpty(true); return; }
        setZones(r.zones);
        const tr = r.zones.find((z) => z.zoneId === "TR") ?? r.zones[0];
        selectZone(tr);
      })
      .catch(() => { setLoading(false); setDbEmpty(true); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            : `${zones.length} zone · 2024 · Saatlik granüler EF verisi · Kaynak: Electricity Maps`}
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, marginBottom: 20, borderBottom: "1px solid #d4ece4" }}>
        {(["data", "api"] as const).map(tab => (
          <button key={tab} onClick={() => setActiveTab(tab)} style={{
            padding: "8px 18px", border: "none", cursor: "pointer", fontWeight: 600,
            fontSize: 13, borderRadius: "6px 6px 0 0",
            background: activeTab === tab ? "#fff" : "transparent",
            color: activeTab === tab ? "#0a1f1a" : "#5c7a72",
            borderBottom: activeTab === tab ? "2px solid #00b87a" : "2px solid transparent",
          }}>
            {tab === "data" ? "Veri Servisi" : "API Dokümantasyonu"}
          </button>
        ))}
      </div>

      {activeTab === "api" ? (
        <ApiDocsView zones={zones} />
      ) : dbEmpty ? (
        <div style={{ ...s.card, textAlign: "center", padding: "60px 40px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>EF Verisi Bulunamadı</div>
          <div style={{ fontSize: 14, color: "#5c7a72" }}>
            Import scripti çalıştırın: <code>npx tsx scripts/truncate-and-reimport-ef.ts</code>
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
                    <span style={s.pill}>2024 · Saatlik</span>
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
                          <div style={s.kpiU}>CFE — 2024 ortalaması</div>
                        </div>
                        <div style={s.kpiBox}>
                          <div style={s.kpiL}>Yenilenebilir Enerji</div>
                          <div style={{ ...s.kpiV, color: "#009966" }}>
                            {summary.rePct.avg.toFixed(1)}%
                          </div>
                          <div style={s.kpiU}>RE — 2024 ortalaması</div>
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
                    <div style={s.cardH}>Aylık Ortalama Emisyon Yoğunluğu — 2024</div>
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
                    <div style={s.cardH}>Karbon Serbest & Yenilenebilir Enerji % — 2024</div>
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
