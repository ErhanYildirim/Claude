import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line, Legend,
} from "recharts";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { EFZoneEntry, EFZoneSummary, EFMonthlyPoint, EFCoverageData } from "../lib/api.js";

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
    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 700, background: color + "18", color, display: "inline-block" }}>
      {ci.toFixed(0)} gCO₂ · {label}
    </span>
  );
}

export default function EfZonesPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1e3830" : "#f4fbf8";
  const stripeBg = isDark ? "#1a3530" : "#f9fdfb";
  const gridLine = isDark ? "rgba(255,255,255,.06)" : "#d4ece4";
  const card: React.CSSProperties  = { background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "20px", marginBottom: 16 };
  const cardH: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".08em" };
  const tooltipStyle = { background: bg, border: `1px solid ${border}`, borderRadius: 8, fontSize: 12 };

  const [zones,         setZones]         = useState<EFZoneEntry[]>([]);
  const [loading,       setLoading]       = useState(true);
  const [search,        setSearch]        = useState("");
  const [selected,      setSelected]      = useState<EFZoneEntry | null>(null);
  const [summary,       setSummary]       = useState<EFZoneSummary | null>(null);
  const [monthly,       setMonthly]       = useState<EFMonthlyPoint[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);
  const [dbEmpty,       setDbEmpty]       = useState(false);
  const [hourlyData,    setHourlyData]    = useState<{ hour: string; ciDirect: number; cfePct: number }[]>([]);
  const [hourlyStart,   setHourlyStart]   = useState(`${new Date().getFullYear()}-01-01`);
  const [hourlyEnd,     setHourlyEnd]     = useState(`${new Date().getFullYear()}-01-07`);
  const [hourlyLoading, setHourlyLoading] = useState(false);
  const [selectedYear,  setSelectedYear]  = useState(new Date().getFullYear());
  const [availableYears, setAvailableYears] = useState<number[]>([new Date().getFullYear()]);

  async function selectZone(zone: EFZoneEntry, year = selectedYear) {
    setSelected(zone);
    setSummary(null);
    setMonthly([]);
    setDetailLoading(true);
    try {
      const [sum, mon] = await Promise.all([api.ef.zone(zone.zoneId), api.ef.monthly(zone.zoneId, year)]);
      setSummary(sum);
      setMonthly(mon.months);
    } catch { /* no data */ }
    finally { setDetailLoading(false); }
  }

  useEffect(() => {
    Promise.all([
      api.ef.zones(),
      api.ef.coverage().catch((): EFCoverageData | null => null),
    ]).then(([zonesRes, cov]) => {
      setLoading(false);
      if (cov && cov.availableYears.length > 0) {
        const latest = Math.max(...cov.availableYears);
        setAvailableYears(cov.availableYears);
        setSelectedYear(latest);
        setHourlyStart(`${latest}-01-01`);
        setHourlyEnd(`${latest}-01-07`);
      }
      if (zonesRes.count === 0) { setDbEmpty(true); return; }
      setZones(zonesRes.zones);
      const tr = zonesRes.zones.find(z => z.zoneId === "TR") ?? zonesRes.zones[0];
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
        ciDirect: d.ciDirect, cfePct: d.cfePct,
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
      try { const mon = await api.ef.monthly(selected.zoneId, yr); setMonthly(mon.months); } catch { /* no data */ }
      finally { setDetailLoading(false); }
    }
  }

  const filtered = zones.filter(z =>
    z.country.toLowerCase().includes(search.toLowerCase()) ||
    z.zoneId.toLowerCase().includes(search.toLowerCase())
  );
  const byCountry: Record<string, EFZoneEntry[]> = {};
  for (const z of filtered) (byCountry[z.country] ??= []).push(z);

  if (loading) return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px", color: muted }}>Yükleniyor...</div>;

  if (dbEmpty) return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ ...card, textAlign: "center", padding: "80px 40px" }}>
        <div style={{ fontSize: 40, marginBottom: 16 }}>📡</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>EF Verisi Bulunamadı</div>
        <div style={{ fontSize: 14, color: muted }}>Import scripti çalıştırın: <code>npx tsx scripts/import-ef-year.ts --year=2025</code></div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>Zone Tarayıcı</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 24 }}>
        {zones.length} zone · Saatlik granüler EF verisi · Kaynak: Electricity Maps
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "300px 1fr", gap: 20, alignItems: "start" }}>
        {/* Zone list */}
        <div style={card}>
          <input
            style={{ width: "100%", padding: "9px 12px", borderRadius: 7, border: `1px solid ${border}`, fontSize: 13, outline: "none", background: inputBg, color: text, boxSizing: "border-box" }}
            placeholder="Zone veya ülke ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div style={{ marginTop: 8, maxHeight: 680, overflowY: "auto" }}>
            {Object.entries(byCountry).map(([country, czones]) => (
              <div key={country}>
                <div style={{ fontSize: 10, fontWeight: 700, color: muted, textTransform: "uppercase", letterSpacing: ".08em", padding: "10px 12px 4px" }}>{country}</div>
                {czones.map(z => {
                  const active = selected?.zoneId === z.zoneId;
                  return (
                    <div
                      key={z.zoneId}
                      onClick={() => selectZone(z)}
                      style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", borderRadius: 7, cursor: "pointer", marginBottom: 2, transition: "background .12s", background: active ? "#00b87a" : "transparent", color: active ? "#fff" : text }}
                      onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = isDark ? "#1a3530" : "#eef7f3"; }}
                      onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
                    >
                      <div>
                        <span style={{ fontWeight: 700, fontSize: 13 }}>{z.zoneId}</span>
                        {z.zoneId !== z.zoneName && <span style={{ fontSize: 11, marginLeft: 6, opacity: 0.65 }}>{z.zoneName}</span>}
                      </div>
                      <span style={{ fontSize: 11, opacity: 0.6 }}>{(z.rowCount / 1000).toFixed(1)}k</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {/* Zone detail */}
        <div>
          {!selected ? (
            <div style={{ ...card, textAlign: "center", padding: "60px 20px", color: muted }}>Sol listeden bir zone seçin</div>
          ) : detailLoading ? (
            <div style={{ ...card, textAlign: "center", padding: "60px 20px", color: muted }}>Yükleniyor...</div>
          ) : (
            <>
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: text }}>
                      {selected.zoneId}
                      <span style={{ fontSize: 14, fontWeight: 500, color: muted, marginLeft: 8 }}>{selected.zoneName}</span>
                    </div>
                    <div style={{ fontSize: 13, color: muted, marginTop: 2 }}>{selected.country}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 600, background: "#e6f9f2", color: "#00b87a" }}>Saatlik</span>
                    <select value={selectedYear} onChange={e => changeYear(Number(e.target.value))}
                      style={{ padding: "3px 8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 12, background: inputBg, color: text, cursor: "pointer" }}>
                      {availableYears.map(y => <option key={y} value={y}>{y}</option>)}
                    </select>
                  </div>
                </div>
                {summary && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 12, margin: "16px 0 12px" }}>
                      {[
                        { label: "Yıllık Ort. CI", value: summary.ciDirect.avg.toFixed(0), unit: "gCO₂eq/kWh", color: ciColor(summary.ciDirect.avg) },
                        { label: "Karbon Serbest", value: `${summary.cfePct.avg.toFixed(1)}%`, unit: `CFE — ${selectedYear}`, color: "#00b87a" },
                        { label: "Yenilenebilir",  value: `${summary.rePct.avg.toFixed(1)}%`, unit: `RE — ${selectedYear}`, color: "#009966" },
                      ].map(k => (
                        <div key={k.label} style={{ background: inputBg, borderRadius: 9, padding: "14px 16px" }}>
                          <div style={{ fontSize: 10, color: muted, fontWeight: 700, marginBottom: 6, textTransform: "uppercase", letterSpacing: ".06em" }}>{k.label}</div>
                          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1, color: k.color }}>{k.value}</div>
                          <div style={{ fontSize: 11, color: muted, marginTop: 4 }}>{k.unit}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                      <CIBadge ci={summary.ciDirect.avg} />
                      <span style={{ fontSize: 12, color: muted }}>Min {summary.ciDirect.min.toFixed(0)} · Max {summary.ciDirect.max.toFixed(0)} gCO₂/kWh</span>
                      <span style={{ fontSize: 12, color: muted }}>{summary.rowCount.toLocaleString()} veri noktası</span>
                    </div>
                  </>
                )}
              </div>

              {monthly.length > 0 && (
                <>
                  <div style={card}>
                    <div style={cardH}>Aylık Ortalama CI — {selectedYear}</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={monthly} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridLine} />
                        <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: muted }} />
                        <YAxis tick={{ fontSize: 11, fill: muted }} unit=" g" />
                        <Tooltip formatter={(v: unknown) => [`${Number(v).toFixed(1)} gCO₂/kWh`, "CI Direkt"] as [string, string]} labelStyle={{ fontWeight: 600, color: text }} contentStyle={tooltipStyle} />
                        <Bar dataKey="avgCiDirect" fill={isDark ? "#4ade80" : "#0a1f1a"} radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div style={card}>
                    <div style={cardH}>CFE & RE % — {selectedYear}</div>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={monthly} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridLine} />
                        <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: muted }} />
                        <YAxis tick={{ fontSize: 11, fill: muted }} unit="%" domain={[0, 100]} />
                        <Tooltip formatter={(v: unknown, name: unknown) => [`${Number(v).toFixed(1)}%`, String(name ?? "")] as [string, string]} contentStyle={tooltipStyle} labelStyle={{ color: text }} />
                        <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                        <Line dataKey="avgCfePct" name="CFE %" stroke="#00b87a" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                        <Line dataKey="avgRePct"  name="RE %"  stroke="#009966" strokeWidth={2} dot={false} strokeDasharray="4 3" activeDot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Monthly table */}
                  <div style={card}>
                    <div style={cardH}>Aylık Detay — {selectedYear}</div>
                    <div style={{ overflowX: "auto" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                        <thead>
                          <tr>
                            {["Ay", "Ort. CI (gCO₂/kWh)", "Min CI", "Max CI", "CFE %", "RE %", "Veri"].map(h => (
                              <th key={h} style={{ textAlign: h === "Ay" ? "left" : "right", padding: "8px 12px", color: muted, fontWeight: 700, fontSize: 11, textTransform: "uppercase", letterSpacing: ".05em", borderBottom: `1px solid ${border}` }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {monthly.map((m, i) => (
                            <tr key={i} style={{ background: i % 2 === 0 ? bg : stripeBg }}>
                              <td style={{ padding: "8px 12px", fontWeight: 600, color: text, borderBottom: `1px solid ${border}` }}>{m.monthName}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${border}` }}>
                                <span style={{ color: ciColor(m.avgCiDirect), fontWeight: 700 }}>{m.avgCiDirect.toFixed(0)}</span>
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: muted, borderBottom: `1px solid ${border}` }}>{m.minCiDirect?.toFixed(0) ?? "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: muted, borderBottom: `1px solid ${border}` }}>{m.maxCiDirect?.toFixed(0) ?? "—"}</td>
                              <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${border}` }}>
                                <span style={{ color: "#00b87a", fontWeight: 600 }}>{m.avgCfePct.toFixed(1)}%</span>
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right", borderBottom: `1px solid ${border}` }}>
                                <span style={{ color: "#009966", fontWeight: 600 }}>{m.avgRePct.toFixed(1)}%</span>
                              </td>
                              <td style={{ padding: "8px 12px", textAlign: "right", color: muted, borderBottom: `1px solid ${border}` }}>{m.dataPoints.toLocaleString()} saat</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </>
              )}

              {/* Hourly */}
              <div style={card}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={cardH}>Saatlik Emisyon Yoğunluğu</div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <input type="date" value={hourlyStart} min={`${selectedYear}-01-01`} max={`${selectedYear}-12-25`}
                      onChange={e => setHourlyStart(e.target.value)}
                      style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 12, background: inputBg, color: text }} />
                    <span style={{ fontSize: 12, color: muted }}>→</span>
                    <input type="date" value={hourlyEnd} min={`${selectedYear}-01-07`} max={`${selectedYear}-12-31`}
                      onChange={e => setHourlyEnd(e.target.value)}
                      style={{ padding: "5px 8px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 12, background: inputBg, color: text }} />
                  </div>
                </div>
                {hourlyLoading ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: muted, fontSize: 13 }}>Yükleniyor…</div>
                ) : hourlyData.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "40px 0", color: muted, fontSize: 13 }}>Veri bulunamadı</div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <LineChart data={hourlyData} margin={{ top: 4, right: 12, bottom: 0, left: -10 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={gridLine} />
                        <XAxis dataKey="hour" tick={{ fontSize: 9, fill: muted }} interval={Math.floor(hourlyData.length / 8)} />
                        <YAxis tick={{ fontSize: 11, fill: muted }} unit=" g" width={52} />
                        <Tooltip formatter={(v: unknown) => [`${Number(v).toFixed(1)} gCO₂/kWh`, "CI Direkt"] as [string, string]} contentStyle={tooltipStyle} labelStyle={{ color: text }} />
                        <Line dataKey="ciDirect" name="CI Direkt" stroke="#ef4444" strokeWidth={1.5} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                    <div style={{ fontSize: 11, color: muted, marginTop: 8 }}>{hourlyData.length} saatlik veri noktası</div>
                  </>
                )}
              </div>

              {/* API access */}
              <div style={card}>
                <div style={cardH}>API Erişimi</div>
                <code style={{ display: "block", background: "#0a1f1a", color: "#00b87a", borderRadius: 8, padding: "12px 16px", fontSize: 12, fontFamily: "monospace", overflowX: "auto", lineHeight: 1.6 }}>
                  GET /api/v1/ef/zones/{selected.zoneId}/hourly<br />
                  &nbsp;&nbsp;?start=2024-01-01&end=2024-12-31
                </code>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
