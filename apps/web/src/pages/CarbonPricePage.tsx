import { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { useSuperAdmin } from "../hooks/useSuperAdmin.js";

interface CarbonPrice {
  id:          string;
  date:        string;
  etsPriceEur: number;
  cbamEstEur:  number | null;
  source:      string;
  notes:       string | null;
}

function PriceCard({ label, value, unit = "€/tCO₂", sub }: { label: string; value: string | number | null; unit?: string; sub?: string }) {
  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      padding: "24px 28px",
      boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
      minWidth: 200,
    }}>
      <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 8 }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
        <span style={{ fontSize: 32, fontWeight: 700, color: "#111827" }}>
          {value != null ? Number(value).toFixed(2) : "—"}
        </span>
        <span style={{ fontSize: 14, color: "#9ca3af" }}>{unit}</span>
      </div>
      {sub && <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 6 }}>{sub}</div>}
    </div>
  );
}

function MiniChart({ prices }: { prices: CarbonPrice[] }) {
  if (prices.length < 2) return null;
  const reversed = [...prices].reverse();
  const values   = reversed.map(p => Number(p.etsPriceEur));
  const min      = Math.min(...values);
  const max      = Math.max(...values);
  const range    = max - min || 1;
  const W = 640, H = 120, PAD = 8;

  const points = values.map((v, i) => {
    const x = PAD + (i / (values.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v - min) / range) * (H - PAD * 2);
    return `${x},${y}`;
  }).join(" ");

  const current = values[values.length - 1];
  const prev    = values[values.length - 2];
  const change  = ((current - prev) / prev) * 100;
  const color   = change >= 0 ? "#10b981" : "#ef4444";

  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: "20px 24px", boxShadow: "0 1px 4px rgba(0,0,0,0.08)" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: "#374151" }}>90 Günlük EU ETS Fiyat Trendi</div>
        <div style={{ fontSize: 13, color }}>
          {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(1)}% (günlük)
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: H }}>
        <polyline points={points} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinejoin="round" />
        {/* Min/max labels */}
        <text x={PAD} y={PAD + 4} fontSize="10" fill="#9ca3af">{max.toFixed(0)}€</text>
        <text x={PAD} y={H - 2}   fontSize="10" fill="#9ca3af">{min.toFixed(0)}€</text>
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
        <span>{reversed[0]?.date.slice(0, 10)}</span>
        <span>{reversed[reversed.length - 1]?.date.slice(0, 10)}</span>
      </div>
    </div>
  );
}

export default function CarbonPricePage() {
  const [prices,   setPrices]   = useState<CarbonPrice[]>([]);
  const [latest,   setLatest]   = useState<CarbonPrice | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newDate,  setNewDate]  = useState(new Date().toISOString().slice(0, 10));
  const [newEts,   setNewEts]   = useState("");
  const [newCbam,  setNewCbam]  = useState("");
  const [saving,   setSaving]   = useState(false);
  const { isSuperAdmin } = useSuperAdmin();

  function load() {
    setLoading(true);
    Promise.all([
      api.carbonPrices.list(),
      api.carbonPrices.latest(),
    ]).then(([list, lat]) => {
      setPrices(list.prices);
      setLatest(lat.price);
    }).finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function save() {
    if (!newEts) return;
    setSaving(true);
    try {
      await api.carbonPrices.create({
        date:        newDate,
        etsPriceEur: parseFloat(newEts),
        cbamEstEur:  newCbam ? parseFloat(newCbam) : undefined,
      });
      setShowForm(false); setNewEts(""); setNewCbam("");
      load();
    } finally {
      setSaving(false);
    }
  }

  const latestDate = latest ? new Date(latest.date).toLocaleDateString("tr-TR") : "—";

  return (
    <div style={{ padding: "28px 32px", maxWidth: 900 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>Karbon Fiyat Takibi</h1>
          <p style={{ fontSize: 14, color: "#6b7280", marginTop: 4 }}>
            EU ETS ve CBAM sertifika piyasa fiyatları
          </p>
        </div>
        {isSuperAdmin && (
          <button
            onClick={() => setShowForm(v => !v)}
            style={{
              padding: "8px 16px", borderRadius: 7, border: "none",
              background: "#3b82f6", color: "#fff", fontSize: 14, fontWeight: 500, cursor: "pointer",
            }}
          >
            + Fiyat Ekle
          </button>
        )}
      </div>

      {showForm && (
        <div style={{
          background: "#f9fafb", border: "1px solid #e5e7eb",
          borderRadius: 10, padding: "20px 24px", marginBottom: 24,
          display: "flex", gap: 12, flexWrap: "wrap", alignItems: "flex-end",
        }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" }}>
            Tarih
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" }}>
            ETS Fiyatı (€/tCO₂)
            <input type="number" step="0.01" value={newEts} onChange={e => setNewEts(e.target.value)}
              placeholder="85.50"
              style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 140 }} />
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 13, color: "#374151" }}>
            CBAM Tahmini (€/tCO₂, opsiyonel)
            <input type="number" step="0.01" value={newCbam} onChange={e => setNewCbam(e.target.value)}
              placeholder="85.50"
              style={{ padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 140 }} />
          </label>
          <button onClick={save} disabled={saving || !newEts}
            style={{
              padding: "7px 18px", borderRadius: 6, border: "none",
              background: saving || !newEts ? "#d1d5db" : "#1d4ed8",
              color: "#fff", fontSize: 14, cursor: saving || !newEts ? "not-allowed" : "pointer",
            }}>
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      )}

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

      {!loading && (
        <>
          <div style={{ display: "flex", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
            <PriceCard
              label="Güncel EU ETS Fiyatı"
              value={latest?.etsPriceEur ?? null}
              sub={`Son güncelleme: ${latestDate} · Kaynak: ${latest?.source ?? "—"}`}
            />
            <PriceCard
              label="CBAM Sertifika Tahmini"
              value={latest?.cbamEstEur ?? null}
              sub="ETS fiyatı referanslı haftalık ortalama"
            />
            {latest?.etsPriceEur && (
              <PriceCard
                label="1.000 tCO₂ Maliyeti"
                value={(Number(latest.etsPriceEur) * 1000).toLocaleString("tr-TR")}
                unit="€"
                sub="Örnek: 1.000 ton emisyon"
              />
            )}
          </div>

          <MiniChart prices={prices} />

          {/* Fiyat tablosu */}
          <div style={{ marginTop: 24, background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", borderBottom: "1px solid #e5e7eb", fontSize: 14, fontWeight: 600, color: "#374151" }}>
              Fiyat Geçmişi
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
              <thead>
                <tr style={{ background: "#f9fafb", borderBottom: "1px solid #e5e7eb" }}>
                  <th style={{ textAlign: "left", padding: "9px 16px", color: "#6b7280", fontWeight: 500 }}>Tarih</th>
                  <th style={{ textAlign: "right", padding: "9px 16px", color: "#6b7280", fontWeight: 500 }}>ETS (€/tCO₂)</th>
                  <th style={{ textAlign: "right", padding: "9px 16px", color: "#6b7280", fontWeight: 500 }}>CBAM Tahmini</th>
                  <th style={{ textAlign: "left", padding: "9px 16px", color: "#6b7280", fontWeight: 500 }}>Kaynak</th>
                </tr>
              </thead>
              <tbody>
                {prices.map((p, i) => (
                  <tr key={p.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                    <td style={{ padding: "10px 16px", color: "#374151" }}>
                      {new Date(p.date).toLocaleDateString("tr-TR")}
                      {i === 0 && <span style={{ marginLeft: 6, fontSize: 11, background: "#dbeafe", color: "#1d4ed8", padding: "1px 6px", borderRadius: 8 }}>Güncel</span>}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", fontWeight: 600, color: "#111827" }}>
                      {Number(p.etsPriceEur).toFixed(2)}
                    </td>
                    <td style={{ padding: "10px 16px", textAlign: "right", color: "#374151" }}>
                      {p.cbamEstEur != null ? Number(p.cbamEstEur).toFixed(2) : "—"}
                    </td>
                    <td style={{ padding: "10px 16px", fontSize: 12, color: "#9ca3af" }}>{p.source}</td>
                  </tr>
                ))}
                {prices.length === 0 && (
                  <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>
                    Henüz fiyat verisi yok. Admin panel üzerinden ekleyin.
                  </td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
