import { useEffect, useState } from "react";
import { api } from "../lib/api.js";

interface BenchmarkRef {
  p25: number; median: number; p75: number; best: number; unit: string;
}

interface BenchmarkRow {
  installationId:  string;
  facilityName:    string;
  facilityCountry: string;
  sector:          string;
  latestYear:      number | null;
  periodName:      string | null;
  seeVoltfox:      number | null;
  seeBaseline:     number | null;
  defaultSee:      number | null;
  benchmark:       BenchmarkRef;
  percentile:      string | null;
  vsMedianPct:     number | null;
}

const PERCENTILE_LABEL: Record<string, { label: string; bg: string; color: string }> = {
  top10:        { label: "Top 10%",   bg: "#d1fae5", color: "#065f46" },
  top25:        { label: "Top 25%",   bg: "#a7f3d0", color: "#047857" },
  median:       { label: "Medyan",    bg: "#dbeafe", color: "#1d4ed8" },
  below_median: { label: "Alt Yarı",  bg: "#fef3c7", color: "#92400e" },
  bottom25:     { label: "Alt 25%",   bg: "#fee2e2", color: "#b91c1c" },
};

const SECTOR_TR: Record<string, string> = {
  steel: "Çelik", aluminium: "Alüminyum", cement: "Çimento",
  fertilizer: "Gübre", electricity: "Elektrik", chemicals: "Kimyasal", hydrogen: "Hidrojen",
};

function GaugeBar({ value, benchmark }: { value: number | null; benchmark: BenchmarkRef }) {
  if (value == null) return <div style={{ color: "#9ca3af", fontSize: 12 }}>Veri yok</div>;

  // Normalize: best=0%, median=50%, p75=75%, worst=(p75+30%)=100%
  const worst = benchmark.p75 * 1.4;
  const clamp = (v: number) => Math.min(100, Math.max(0, v));
  const toX   = (v: number) => clamp(((v - benchmark.best) / (worst - benchmark.best)) * 100);

  const valueX = toX(value);
  const p25X   = toX(benchmark.p25);
  const medX   = toX(benchmark.median);
  const p75X   = toX(benchmark.p75);

  return (
    <div style={{ position: "relative", height: 20, marginTop: 4 }}>
      {/* Track */}
      <div style={{
        position: "absolute", top: 7, left: 0, right: 0, height: 6, borderRadius: 3,
        background: `linear-gradient(to right, #10b981 0%, #10b981 ${p25X}%, #f59e0b ${p25X}%, #f59e0b ${medX}%, #ef4444 ${medX}%, #ef4444 100%)`,
        opacity: 0.25,
      }} />
      {/* P25, median, P75 markers */}
      {[p25X, medX, p75X].map((x, i) => (
        <div key={i} style={{
          position: "absolute", top: 4, left: `${x}%`, width: 2, height: 12,
          background: ["#10b981", "#f59e0b", "#ef4444"][i],
          transform: "translateX(-50%)",
        }} />
      ))}
      {/* Value marker */}
      <div style={{
        position: "absolute", top: 2, left: `${valueX}%`,
        width: 16, height: 16, borderRadius: "50%",
        background: value <= benchmark.p25 ? "#10b981" : value <= benchmark.median ? "#f59e0b" : "#ef4444",
        border: "2px solid #fff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
        transform: "translateX(-50%)",
      }} />
    </div>
  );
}

export default function BenchmarkPage() {
  const [rows,    setRows]    = useState<BenchmarkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter,  setFilter]  = useState("");

  useEffect(() => {
    api.benchmark.list()
      .then(r => setRows(r.results))
      .finally(() => setLoading(false));
  }, []);

  const filtered = rows.filter(r =>
    !filter || r.sector === filter || r.facilityName.toLowerCase().includes(filter.toLowerCase())
  );

  const sectors = [...new Set(rows.map(r => r.sector))];

  return (
    <div style={{ padding: "28px 32px", maxWidth: 1060 }}>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Sektör Benchmark</h1>
        <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
          Tesislerinizin SEE değerini sektör ortalamasıyla karşılaştırın — CBAM Ek IV referans değerleri
        </p>
      </div>

      {/* Filtre */}
      <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
        <button onClick={() => setFilter("")}
          style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid", borderColor: !filter ? "#3b82f6" : "#d1d5db", background: !filter ? "#eff6ff" : "#fff", color: !filter ? "#1d4ed8" : "#374151", fontSize: 13, cursor: "pointer" }}>
          Tümü
        </button>
        {sectors.map(s => (
          <button key={s} onClick={() => setFilter(s === filter ? "" : s)}
            style={{ padding: "5px 12px", borderRadius: 6, border: "1px solid", borderColor: filter === s ? "#3b82f6" : "#d1d5db", background: filter === s ? "#eff6ff" : "#fff", color: filter === s ? "#1d4ed8" : "#374151", fontSize: 13, cursor: "pointer" }}>
            {SECTOR_TR[s] ?? s}
          </button>
        ))}
      </div>

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

      {!loading && (
        <>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {filtered.map(row => {
              const pc = row.percentile ? PERCENTILE_LABEL[row.percentile] : null;
              const vsMedian = row.vsMedianPct;

              return (
                <div key={row.installationId} style={{
                  background: "#fff", borderRadius: 10,
                  padding: "18px 22px", boxShadow: "0 1px 3px rgba(0,0,0,0.07)",
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: "#111827", fontSize: 14 }}>
                        {row.facilityName}
                        {pc && (
                          <span style={{
                            marginLeft: 8, fontSize: 11, padding: "2px 8px", borderRadius: 10,
                            background: pc.bg, color: pc.color,
                          }}>
                            {pc.label}
                          </span>
                        )}
                      </div>
                      <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 2 }}>
                        {SECTOR_TR[row.sector] ?? row.sector} · {row.facilityCountry}
                        {row.latestYear && ` · ${row.periodName ?? row.latestYear}`}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: "#111827" }}>
                        {row.seeVoltfox != null ? row.seeVoltfox.toFixed(4) : "—"}
                        <span style={{ fontSize: 11, color: "#9ca3af", marginLeft: 4 }}>{row.benchmark.unit}</span>
                      </div>
                      {vsMedian != null && (
                        <div style={{ fontSize: 12, color: vsMedian >= 0 ? "#059669" : "#ef4444", marginTop: 2 }}>
                          {vsMedian >= 0 ? "▼" : "▲"} {Math.abs(vsMedian).toFixed(1)}% medyan {vsMedian >= 0 ? "altında" : "üzerinde"}
                        </div>
                      )}
                    </div>
                  </div>

                  <GaugeBar value={row.seeVoltfox} benchmark={row.benchmark} />

                  {/* Referans çizgileri açıklaması */}
                  <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 11, color: "#9ca3af" }}>
                    <span style={{ color: "#10b981" }}>■ P25 {row.benchmark.p25.toFixed(3)}</span>
                    <span style={{ color: "#f59e0b" }}>■ Medyan {row.benchmark.median.toFixed(3)}</span>
                    <span style={{ color: "#ef4444" }}>■ P75 {row.benchmark.p75.toFixed(3)}</span>
                    {row.defaultSee != null && (
                      <span style={{ color: "#6b7280" }}>CBAM Default: {row.defaultSee.toFixed(4)}</span>
                    )}
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div style={{ padding: "40px 0", textAlign: "center", color: "#9ca3af", fontSize: 14 }}>
                Gösterilecek tesis yok. Önce hesaplama yapın.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
