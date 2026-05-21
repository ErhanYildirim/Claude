import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import type { EFZoneEntry, EFZoneSummary, EFMonthlyPoint } from "../lib/api.js";

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1200, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  grid:    { display: "grid", gridTemplateColumns: "320px 1fr", gap: 20, alignItems: "start" },
  card:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 16 },
  cardH:   { fontSize: 13, fontWeight: 700, color: "#0a1f1a", marginBottom: 12, textTransform: "uppercase" as const, letterSpacing: ".05em" },
  zoneRow: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 2 },
  kpiGrid: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 16 },
  kpiBox:  { background: "#eef7f3", borderRadius: 9, padding: "14px 16px" },
  kpiL:    { fontSize: 11, color: "#5c7a72", fontWeight: 600, marginBottom: 4, textTransform: "uppercase" as const, letterSpacing: ".06em" },
  kpiV:    { fontSize: 22, fontWeight: 800, color: "#0a1f1a" },
  kpiU:    { fontSize: 11, color: "#5c7a72", marginTop: 2 },
  badge:   { padding: "2px 8px", borderRadius: 20, fontSize: 11, fontWeight: 700, display: "inline-block" },
  input:   { width: "100%", padding: "8px 10px", borderRadius: 7, border: "1px solid #d4ece4", fontSize: 13, outline: "none" },
  searchWrap: { position: "relative" as const, marginBottom: 10 },
  empty:   { textAlign: "center" as const, color: "#5c7a72", padding: "40px 20px", fontSize: 14 },
  pill:    { padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#e6f9f2", color: "#00b87a", display: "inline-block" },
};

function ciColor(ci: number): string {
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
    <span style={{ ...s.badge, background: color + "20", color }}>
      {ci.toFixed(0)} g · {label}
    </span>
  );
}

export default function EfDataPage() {
  const [zones, setZones]             = useState<EFZoneEntry[]>([]);
  const [loading, setLoading]         = useState(true);
  const [search, setSearch]           = useState("");
  const [selected, setSelected]       = useState<EFZoneEntry | null>(null);
  const [summary, setSummary]         = useState<EFZoneSummary | null>(null);
  const [monthly, setMonthly]         = useState<EFMonthlyPoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dbEmpty, setDbEmpty]         = useState(false);

  useEffect(() => {
    api.ef.zones()
      .then((r) => {
        setZones(r.zones);
        setLoading(false);
        if (r.count === 0) setDbEmpty(true);
        else if (r.zones.length > 0) selectZone(r.zones.find(z => z.zoneId === "TR") ?? r.zones[0]);
      })
      .catch(() => { setLoading(false); setDbEmpty(true); });
  }, []);

  const selectZone = useCallback(async (zone: EFZoneEntry) => {
    setSelected(zone);
    setDetailLoading(true);
    setSummary(null);
    setMonthly([]);
    try {
      const [sum, mon] = await Promise.all([
        api.ef.zone(zone.zoneId),
        api.ef.monthly(zone.zoneId, 2024),
      ]);
      setSummary(sum);
      setMonthly(mon.months);
    } catch { /* zone data might not be ready */ }
    setDetailLoading(false);
  }, []);

  const filtered = zones.filter((z) =>
    z.country.toLowerCase().includes(search.toLowerCase()) ||
    z.zoneId.toLowerCase().includes(search.toLowerCase()) ||
    z.zoneName.toLowerCase().includes(search.toLowerCase())
  );

  // Group by country
  const countryGroups: Record<string, EFZoneEntry[]> = {};
  for (const z of filtered) {
    (countryGroups[z.country] ??= []).push(z);
  }

  return (
    <div style={s.page}>
      <div style={s.h1}>EF Veri Servisi</div>
      <div style={s.sub}>
        {loading ? "Yükleniyor..." : dbEmpty
          ? "Emisyon faktörü verisi henüz yüklenmemiş"
          : `${zones.length} zone · 2024 · Saatlik granüler EF verisi · Kaynak: Electricity Maps`
        }
      </div>

      {dbEmpty ? (
        <div style={{ ...s.card, textAlign: "center", padding: "60px 40px" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "#0a1f1a", marginBottom: 8 }}>
            EF Verisi İçe Aktarılıyor
          </div>
          <div style={{ fontSize: 14, color: "#5c7a72", maxWidth: 480, margin: "0 auto" }}>
            347 zone için 2024 saatlik emisyon faktörü verisi import ediliyor.
            Supabase Dashboard → SQL Editor'den <code>TRUNCATE TABLE emission_factors RESTART IDENTITY;</code> çalıştırın, ardından import scripti yeniden başlatın.
          </div>
        </div>
      ) : (
        <div style={s.grid}>
          {/* Sol: Zone Listesi */}
          <div>
            <div style={s.card}>
              <div style={s.searchWrap}>
                <input
                  style={s.input}
                  placeholder="Zone, ülke ara..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div style={{ maxHeight: 640, overflowY: "auto" }}>
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} style={{ background: "#eef7f3", borderRadius: 7, height: 38, marginBottom: 4, opacity: 0.6 - i * 0.05 }} />
                  ))
                ) : Object.entries(countryGroups).map(([country, czones]) => (
                  <div key={country}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "#5c7a72", textTransform: "uppercase", letterSpacing: ".08em", padding: "10px 10px 4px" }}>
                      {country}
                    </div>
                    {czones.map((z) => {
                      const active = selected?.zoneId === z.zoneId;
                      return (
                        <div
                          key={z.zoneId}
                          style={{
                            ...s.zoneRow,
                            background: active ? "#00b87a" : "transparent",
                            color: active ? "#fff" : "#0a1f1a",
                          }}
                          onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "#eef7f3"; }}
                          onMouseLeave={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                          onClick={() => selectZone(z)}
                        >
                          <div>
                            <span style={{ fontWeight: 700, fontSize: 13 }}>{z.zoneId}</span>
                            {z.zoneId !== z.zoneName && (
                              <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.7 }}>{z.zoneName}</span>
                            )}
                          </div>
                          <span style={{ fontSize: 11, opacity: 0.7 }}>
                            {(z.rowCount / 1000).toFixed(1)}k
                          </span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Sağ: Zone Detayı */}
          <div>
            {!selected ? (
              <div style={{ ...s.card, ...s.empty }}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                Sol listeden bir zone seçin
              </div>
            ) : detailLoading ? (
              <div style={{ ...s.card, ...s.empty }}>
                <div style={{ color: "#5c7a72" }}>Yükleniyor...</div>
              </div>
            ) : (
              <>
                {/* Header */}
                <div style={{ ...s.card, marginBottom: 16 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 800, color: "#0a1f1a" }}>
                        {selected.zoneId}
                        <span style={{ fontSize: 14, fontWeight: 500, color: "#5c7a72", marginLeft: 8 }}>
                          {selected.zoneName}
                        </span>
                      </div>
                      <div style={{ fontSize: 13, color: "#5c7a72", marginTop: 2 }}>{selected.country}</div>
                    </div>
                    <span style={s.pill}>2024 · Saatlik</span>
                  </div>

                  {summary && (
                    <div style={{ ...s.kpiGrid, marginTop: 16 }}>
                      <div style={s.kpiBox}>
                        <div style={s.kpiL}>Yıllık Ort. CI (Direkt)</div>
                        <div style={{ ...s.kpiV, color: ciColor(summary.ciDirect.avg) }}>
                          {summary.ciDirect.avg.toFixed(0)}
                        </div>
                        <div style={s.kpiU}>gCO₂eq/kWh</div>
                      </div>
                      <div style={s.kpiBox}>
                        <div style={s.kpiL}>Karbon Serbest Enerji %</div>
                        <div style={{ ...s.kpiV, color: "#00b87a" }}>
                          {summary.cfePct.avg.toFixed(1)}%
                        </div>
                        <div style={s.kpiU}>CFE — 2024 ortalaması</div>
                      </div>
                      <div style={s.kpiBox}>
                        <div style={s.kpiL}>Yenilenebilir Enerji %</div>
                        <div style={{ ...s.kpiV, color: "#009966" }}>
                          {summary.rePct.avg.toFixed(1)}%
                        </div>
                        <div style={s.kpiU}>RE — 2024 ortalaması</div>
                      </div>
                    </div>
                  )}

                  {summary && (
                    <div style={{ display: "flex", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
                      <CIBadge ci={summary.ciDirect.avg} />
                      <span style={{ fontSize: 12, color: "#5c7a72", alignSelf: "center" }}>
                        Min: {summary.ciDirect.min.toFixed(0)} · Max: {summary.ciDirect.max.toFixed(0)} gCO₂/kWh
                      </span>
                      <span style={{ fontSize: 12, color: "#5c7a72", alignSelf: "center" }}>
                        {summary.rowCount.toLocaleString()} saatlik veri
                      </span>
                    </div>
                  )}
                </div>

                {/* Aylık CI Grafiği */}
                {monthly.length > 0 && (
                  <div style={s.card}>
                    <div style={s.cardH}>Aylık Ortalama Emisyon Yoğunluğu — 2024</div>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={monthly} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
                        <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: "#5c7a72" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit=" g" />
                        <Tooltip
                          // eslint-disable-next-line @typescript-eslint/no-explicit-any
                          formatter={(v: any) => [`${Number(v).toFixed(1)} gCO₂/kWh`] as any}
                          labelStyle={{ fontWeight: 600, color: "#0a1f1a" }}
                        />
                        <Bar dataKey="avgCiDirect" name="CI Direkt" fill="#0a1f1a" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* CFE & RE Aylık */}
                {monthly.length > 0 && (
                  <div style={s.card}>
                    <div style={s.cardH}>Karbon Serbest & Yenilenebilir Enerji % — 2024</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={monthly} margin={{ top: 4, right: 16, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
                        <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: "#5c7a72" }} />
                        <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit="%" domain={[0, 100]} />
                        <Tooltip formatter={(v: any) => [`${Number(v).toFixed(1)}%`] as any} />
                        <Legend wrapperStyle={{ fontSize: 12 }} />
                        <Line dataKey="avgCfePct" name="CFE %" stroke="#00b87a" strokeWidth={2} dot={false} />
                        <Line dataKey="avgRePct"  name="RE %"  stroke="#009966" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}

                {/* API Erişim Bilgisi */}
                <div style={s.card}>
                  <div style={s.cardH}>API Erişimi</div>
                  <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 8 }}>
                    Bu zone için saatlik EF verisi API üzerinden erişilebilir:
                  </div>
                  <code style={{ display: "block", background: "#0a1f1a", color: "#00b87a", borderRadius: 7, padding: "12px 14px", fontSize: 12, fontFamily: "monospace", overflowX: "auto" }}>
                    GET /api/v1/ef/zones/{selected.zoneId}/hourly?start=2024-01-01&end=2024-01-31
                  </code>
                  <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                    <span style={{ ...s.pill, fontSize: 11 }}>JSON</span>
                    <span style={{ ...s.pill, fontSize: 11 }}>8784 veri noktası/yıl</span>
                    <span style={{ ...s.pill, fontSize: 11 }}>gCO₂eq/kWh</span>
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
