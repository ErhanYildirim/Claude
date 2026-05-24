import { useTheme } from "../contexts/ThemeContext.js";

const EXAMPLE_ZONE = "TR";

export default function EfApiPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg     = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text   = isDark ? "#e2efe9" : "#0a1f1a";
  const muted  = isDark ? "#7dab97" : "#5c7a72";
  const card: React.CSSProperties = { background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "20px", marginBottom: 16 };

  const block = (code: string) => (
    <pre style={{ background: "#0a1f1a", color: "#00b87a", borderRadius: 8, padding: "12px 16px", fontSize: 12, fontFamily: "monospace", overflowX: "auto", lineHeight: 1.6, margin: "8px 0 16px" }}>{code}</pre>
  );
  const heading = (t: string) => (
    <div style={{ fontSize: 11, fontWeight: 700, color: muted, letterSpacing: ".08em", textTransform: "uppercase", marginTop: 20, marginBottom: 8 }}>{t}</div>
  );
  const pill = (t: string, color = "#00b87a") => (
    <span key={t} style={{ background: color + "18", color, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, marginRight: 6 }}>{t}</span>
  );

  const endpoints = [
    { method: "GET", path: "/api/v1/ef/zones", desc: "Tüm mevcut EF zone'larını listeler", response: `{ "count": 63, "zones": [{ "zoneId": "TR", "zoneName": "Turkey", "country": "Turkey", "rowCount": 8784 }] }` },
    { method: "GET", path: `/api/v1/ef/zones/${EXAMPLE_ZONE}`, desc: "Zone yıllık özeti: ortalama, min, max CI + CFE/RE yüzdesi", response: `{ "zoneId": "${EXAMPLE_ZONE}", "ciDirect": { "avg": 380.2, "min": 45.0, "max": 820.5 }, "cfePct": { "avg": 32.1 }, "rowCount": 8784 }` },
    { method: "GET", path: `/api/v1/ef/zones/${EXAMPLE_ZONE}/hourly?start=2024-01-01&end=2024-01-07`, desc: "Saatlik EF verisi — start/end (ISO 8601) ile filtrelenebilir", response: `{ "zoneId": "${EXAMPLE_ZONE}", "count": 168, "data": [{ "hour": "2024-01-01T00:00:00Z", "ciDirect": 412.5, "ciLifecycle": 450.2, "cfePct": 28.3, "rePct": 30.1, "dataEstimated": false }] }` },
    { method: "GET", path: `/api/v1/ef/zones/${EXAMPLE_ZONE}/monthly?year=2024`, desc: "Aylık agregat: ortalama, min, max CI · CFE% · RE% her ay için", response: `{ "zoneId": "${EXAMPLE_ZONE}", "year": 2024, "months": [{ "month": 1, "monthName": "Jan", "avgCiDirect": 398.4, "minCiDirect": 45.0, "maxCiDirect": 820.5, "avgCfePct": 29.2, "dataPoints": 744 }] }` },
    { method: "GET", path: "/api/v1/ef/coverage", desc: "Tüm zone'lar için yıl × tamamlanma durumu matrisi", response: `{ "availableYears": [2023, 2024], "zones": [{ "zoneId": "TR", "country": "Turkey", "years": [{ "year": 2024, "rowCount": 8784, "complete": true }] }] }` },
  ];

  return (
    <div style={{ maxWidth: 900, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>API Dokümantasyonu</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 28 }}>EF Veri Servisi REST API — saatlik granüler emisyon faktörü verisi</div>

      {/* Overview */}
      <div style={card}>
        {heading("Genel Bakış")}
        <p style={{ fontSize: 13, color: muted, margin: "0 0 12px", lineHeight: 1.7 }}>
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

      {/* Auth */}
      <div style={card}>
        {heading("Kimlik Doğrulama")}
        <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>Bearer token (JWT) veya API Key:</div>
        {block(`Authorization: Bearer <jwt_token>
# veya API Key ile:
Authorization: Bearer vf_<api_key>`)}

        {heading("Rate Limiting")}
        <div style={{ fontSize: 13, color: muted, marginBottom: 4 }}>
          100 istek / dakika (IP başına). Aşıldığında <code>429 RATE_LIMIT_EXCEEDED</code> döner.
        </div>
      </div>

      {/* Endpoints */}
      <div style={card}>
        {heading("Endpoint'ler")}
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {endpoints.map((ep, i) => (
            <div key={i} style={{ border: `1px solid ${border}`, borderRadius: 8, overflow: "hidden" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", background: isDark ? "#1a3530" : "#f4fbf8", borderBottom: `1px solid ${border}` }}>
                <span style={{ background: "#00b87a", color: "#fff", padding: "2px 8px", borderRadius: 5, fontSize: 11, fontWeight: 700 }}>{ep.method}</span>
                <code style={{ fontSize: 13, color: text }}>{ep.path}</code>
              </div>
              <div style={{ padding: "10px 14px" }}>
                <div style={{ fontSize: 13, color: muted, marginBottom: 8 }}>{ep.desc}</div>
                {block(ep.response)}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Code examples */}
      <div style={card}>
        {heading("Kod Örnekleri")}

        <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 4 }}>cURL</div>
        {block(`curl -H "Authorization: Bearer $TOKEN" \\
  "https://api.voltfox.io/api/v1/ef/zones/${EXAMPLE_ZONE}/hourly?start=2024-01-01&end=2024-01-31"`)}

        <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 4 }}>JavaScript / TypeScript</div>
        {block(`const res = await fetch(
  "/api/v1/ef/zones/${EXAMPLE_ZONE}/hourly?start=2024-01-01&end=2024-01-31",
  { headers: { Authorization: \`Bearer \${token}\` } }
);
const { data } = await res.json();
// data: EFHourlyPoint[]`)}

        <div style={{ fontSize: 12, fontWeight: 600, color: muted, marginBottom: 4 }}>Python</div>
        {block(`import requests

r = requests.get(
    "/api/v1/ef/zones/${EXAMPLE_ZONE}/hourly",
    params={"start": "2024-01-01", "end": "2024-01-31"},
    headers={"Authorization": f"Bearer {token}"}
)
data = r.json()["data"]  # List[EFHourlyPoint]`)}

        {heading("Veri Yapısı")}
        {block(`interface EFHourlyPoint {
  hour:          string;   // ISO 8601 UTC — "2024-01-01T00:00:00.000Z"
  ciDirect:      number;   // gCO₂eq/kWh — lokasyon bazlı (Scope 2)
  ciLifecycle:   number;   // gCO₂eq/kWh — yaşam döngüsü
  cfePct:        number;   // 0-100 — karbon serbest enerji yüzdesi
  rePct:         number;   // 0-100 — yenilenebilir enerji yüzdesi
  dataEstimated: boolean;  // true ise modelle tahmin edilen
}

interface EFMonthlyPoint {
  month:       number;   // 1-12
  monthName:   string;   // "Jan", "Feb", ...
  avgCiDirect: number;   // Aylık ortalama CI
  minCiDirect: number;   // Aylık minimum CI
  maxCiDirect: number;   // Aylık maksimum CI
  avgCfePct:   number;   // Aylık ortalama CFE %
  avgRePct:    number;   // Aylık ortalama RE %
  dataPoints:  number;   // Veri noktası sayısı
}`)}
      </div>
    </div>
  );
}
