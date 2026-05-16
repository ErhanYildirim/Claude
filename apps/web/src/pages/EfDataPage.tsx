import { useState, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell,
} from "recharts";
import { api } from "../lib/api.js";
import type { EFEntry, DefaultResult } from "../lib/api.js";
import { fmt } from "../lib/chart-utils.js";

const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 4 },
  sub:    { fontSize: 14, color: "#6B7280", marginBottom: 24 },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "20px", marginBottom: 20 },
  cardH:  { fontSize: 14, fontWeight: 600, color: "#111827", marginBottom: 14 },
  row2:   { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 20 },
  input:  { padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", width: "100%", boxSizing: "border-box" as const },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 },
  btn:    { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#0066CC", color: "#fff" },
  badge:  { display: "inline-block", padding: "2px 8px", borderRadius: 4, fontSize: 11, fontWeight: 600 },
  detailBox: { background: "#F0F9FF", border: "1px solid #BAE6FD", borderRadius: 8, padding: 14, marginTop: 12, fontSize: 13 },
  row:    { display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #F3F4F6" },
  err:    { color: "#DC2626", fontSize: 13, marginBottom: 10 },
};

function efColor(ef: number): string {
  return ef < 0.3 ? "#059669" : ef < 0.5 ? "#D97706" : "#DC2626";
}

interface CountryEF { iso2: string; name: string; ef: number; }

export default function EfDataPage() {
  const [countries, setCountries] = useState<CountryEF[]>([]);
  const [dataVersion, setDataVersion] = useState("");
  const [search, setSearch]         = useState("");
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState<EFEntry | null>(null);
  const [compare, setCompare]       = useState<string[]>([]);
  const [detail, setDetail]         = useState<EFEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // CBAM default lookup
  const [cnCode, setCnCode]       = useState("");
  const [country, setCountry]     = useState("TR");
  const [lookupResult, setLookupResult] = useState<DefaultResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupErr, setLookupErr] = useState("");

  useEffect(() => {
    api.defaults.efList().then(r => {
      setCountries(r.countries.sort((a, b) => b.ef - a.ef));
      setDataVersion(r.dataVersion);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = countries.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.iso2.toLowerCase().includes(search.toLowerCase())
  );

  async function showDetail(iso2: string) {
    setDetailLoading(true); setDetail(null);
    try { setDetail(await api.defaults.efLookup(iso2)); } catch { /* skip */ }
    setDetailLoading(false);
  }

  function toggleCompare(iso2: string) {
    setCompare(prev =>
      prev.includes(iso2) ? prev.filter(c => c !== iso2) : prev.length < 8 ? [...prev, iso2] : prev
    );
  }

  async function lookup() {
    if (!cnCode.trim() || !country.trim()) return;
    setLookupErr(""); setLookupLoading(true); setLookupResult(null);
    try { setLookupResult(await api.defaults.lookup(country.toUpperCase(), cnCode.trim())); }
    catch (e: unknown) { setLookupErr(e instanceof Error ? e.message : "Bulunamadı"); }
    setLookupLoading(false);
  }

  const compareData = countries.filter(c => compare.includes(c.iso2));

  return (
    <div style={s.page}>
      <div style={s.h1}>EF Veri Görselleştirme</div>
      <div style={s.sub}>
        {loading ? "Yükleniyor..." : `${countries.length} ülke · Veri versiyonu: ${dataVersion}`}
      </div>

      {/* Arama */}
      <div style={{ marginBottom: 16 }}>
        <input style={{ ...s.input, maxWidth: 360 }} placeholder="Ülke adı veya ISO-2 ile ara..." value={search}
          onChange={e => setSearch(e.target.value)} />
      </div>

      <div style={s.row2}>
        {/* EF Ranking Chart */}
        <div style={s.card}>
          <div style={s.cardH}>EF Sıralaması (tCO₂/MWh) — Yüksekten Düşüğe</div>
          {loading ? (
            <div style={{ background: "#F3F4F6", borderRadius: 8, height: 400 }} />
          ) : (
            <div style={{ maxHeight: 500, overflowY: "auto" }}>
              <ResponsiveContainer width="100%" height={Math.max(filtered.length * 26 + 40, 100)}>
                <BarChart layout="vertical" data={filtered} margin={{ left: 10, right: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="iso2" tick={{ fontSize: 11 }} width={32}
                    tickFormatter={(v: string) => v} />
                  <Tooltip formatter={(v: number, _n: string, props: { payload?: CountryEF }) =>
                    [`${fmt(v, 3)} tCO₂/MWh`, props.payload?.name ?? ""]
                  } />
                  <Bar dataKey="ef" name="EF (tCO₂/MWh)">
                    {filtered.map((c, i) => (
                      <Cell key={i}
                        fill={efColor(c.ef)}
                        stroke={c.iso2 === "TR" ? "#111827" : "transparent"}
                        strokeWidth={c.iso2 === "TR" ? 2 : 0}
                        cursor="pointer"
                        onClick={() => { setSelected(c as unknown as EFEntry); showDetail(c.iso2); }}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Sağ panel: detay + karşılaştırma + CBAM lookup */}
        <div>
          {/* Ülke detayı */}
          <div style={s.card}>
            <div style={s.cardH}>Ülke Detayı</div>
            {selected ? (
              detailLoading ? <div style={{ color: "#6B7280", fontSize: 13 }}>Yükleniyor...</div> :
              detail ? (
                <div>
                  <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>{detail.name} ({detail.iso2})</div>
                  <div style={s.row}><span style={{ color: "#6B7280", fontSize: 13 }}>EF Değeri</span><span style={{ fontWeight: 700, fontSize: 14, color: efColor(detail.ef) }}>{fmt(detail.ef, 3)} tCO₂/MWh</span></div>
                  <div style={s.row}><span style={{ color: "#6B7280", fontSize: 13 }}>Kaynak</span><span style={{ fontSize: 13 }}>{detail.source}</span></div>
                  <div style={s.row}><span style={{ color: "#6B7280", fontSize: 13 }}>Yıl</span><span style={{ fontSize: 13 }}>{detail.year}</span></div>
                  <div style={s.row}><span style={{ color: "#6B7280", fontSize: 13 }}>Veri Versiyonu</span><span style={{ fontSize: 12, fontFamily: "monospace" }}>{detail.dataVersion}</span></div>
                  {detail.notes && <div style={{ fontSize: 12, color: "#6B7280", marginTop: 8 }}>{detail.notes}</div>}
                </div>
              ) : <div style={{ color: "#9CA3AF", fontSize: 13 }}>Detay yüklenemedi</div>
            ) : <div style={{ color: "#9CA3AF", fontSize: 13 }}>Grafikten bir ülke seçin</div>}
          </div>

          {/* Karşılaştırma */}
          <div style={s.card}>
            <div style={s.cardH}>Ülke Karşılaştırması (max 8)</div>
            <div style={{ display: "flex", flexWrap: "wrap" as const, gap: 6, marginBottom: 12 }}>
              {countries.slice(0, 20).map(c => (
                <label key={c.iso2} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, cursor: "pointer" }}>
                  <input type="checkbox" checked={compare.includes(c.iso2)}
                    onChange={() => toggleCompare(c.iso2)}
                    disabled={!compare.includes(c.iso2) && compare.length >= 8} />
                  {c.iso2}
                </label>
              ))}
            </div>
            {compareData.length > 0 && (
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={compareData} margin={{ bottom: 20 }}>
                  <XAxis dataKey="iso2" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(v: number) => [`${fmt(v, 3)} tCO₂/MWh`, "EF"]} />
                  <Bar dataKey="ef">
                    {compareData.map((c, i) => <Cell key={i} fill={efColor(c.ef)} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* CBAM Default Arama */}
          <div style={s.card}>
            <div style={s.cardH}>CBAM Default Değeri Ara</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
              <div>
                <label style={s.label}>CN Kodu</label>
                <input style={s.input} value={cnCode} onChange={e => setCnCode(e.target.value)} placeholder="7208" />
              </div>
              <div>
                <label style={s.label}>İthalat Ülkesi (ISO-2)</label>
                <input style={s.input} value={country} onChange={e => setCountry(e.target.value)} maxLength={2} />
              </div>
            </div>
            {lookupErr && <div style={s.err}>{lookupErr}</div>}
            <button style={s.btn} disabled={lookupLoading || !cnCode.trim()} onClick={lookup}>
              {lookupLoading ? "Aranıyor..." : "Ara"}
            </button>
            {lookupResult && (
              <div style={s.detailBox}>
                <div style={{ fontWeight: 700, marginBottom: 6 }}>CN {lookupResult.cnCode} — {lookupResult.country}</div>
                <div style={s.row}><span style={{ color: "#0369A1" }}>AB Default</span><span style={{ fontWeight: 700 }}>{fmt(lookupResult.totalDefault, 4)} tCO₂e/t</span></div>
                {lookupResult.directDefault !== null && <div style={s.row}><span style={{ color: "#0369A1" }}>Direkt</span><span>{fmt(lookupResult.directDefault, 4)} tCO₂e/t</span></div>}
                {lookupResult.indirectDefault !== null && <div style={s.row}><span style={{ color: "#0369A1" }}>Dolaylı</span><span>{fmt(lookupResult.indirectDefault, 4)} tCO₂e/t</span></div>}
                <div style={{ marginTop: 8, fontSize: 12, color: "#0369A1" }}>Veri: {lookupResult.dataVersion}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
