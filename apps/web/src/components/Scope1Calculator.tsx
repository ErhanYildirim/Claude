import { useState } from "react";

interface FuelEntry {
  fuel: string;
  ncv: number;      // MJ/kg or MJ/m³
  ef: number;       // tCO₂/TJ
  unit: string;     // kg, m³, litre
}

const FUELS: Record<string, FuelEntry> = {
  "natural_gas":  { fuel: "Doğal Gaz",       ncv: 48.0, ef: 56.10, unit: "m³" },
  "diesel":       { fuel: "Motorin",          ncv: 43.0, ef: 74.10, unit: "litre" },
  "lpg":          { fuel: "LPG",             ncv: 47.3, ef: 63.10, unit: "kg" },
  "heavy_oil":    { fuel: "Fuel Oil",         ncv: 40.4, ef: 77.40, unit: "kg" },
  "coal_bitum":   { fuel: "Taş Kömürü",      ncv: 25.8, ef: 94.60, unit: "kg" },
  "coal_lignite": { fuel: "Linyit",           ncv: 11.9, ef: 101.2, unit: "kg" },
  "biomass":      { fuel: "Biyokütle",        ncv: 15.0, ef: 0.0,   unit: "kg" },
  "petcoke":      { fuel: "Petkok",           ncv: 32.5, ef: 97.50, unit: "kg" },
};

const s: Record<string, React.CSSProperties> = {
  overlay: { position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 1000,
             display: "flex", alignItems: "center", justifyContent: "center" },
  modal:   { background: "#fff", borderRadius: 14, padding: 28, width: 520, maxWidth: "95vw",
             boxShadow: "0 20px 60px rgba(0,0,0,.18)", maxHeight: "90vh", overflowY: "auto" },
  h2:      { fontSize: 17, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 12, color: "#5c7a72", marginBottom: 20 },
  label:   { fontSize: 12, fontWeight: 600, color: "#1a3530", marginBottom: 4, display: "block" },
  input:   { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
             fontSize: 14, boxSizing: "border-box" as const },
  select:  { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
             fontSize: 14, background: "#fff", cursor: "pointer" },
  row:     { display: "flex", justifyContent: "space-between", alignItems: "center",
             padding: "8px 0", borderBottom: "1px solid #eef7f3" },
  result:  { background: "#e6f9f2", border: "1px solid rgba(0,184,122,.3)", borderRadius: 10,
             padding: "16px 18px", margin: "16px 0" },
  btnG:    { padding: "10px 20px", background: "#009966", color: "#fff", border: "none",
             borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 },
  btnGh:   { padding: "10px 20px", background: "#fff", color: "#009966",
             border: "1px solid #009966", borderRadius: 8, cursor: "pointer", fontWeight: 700, fontSize: 14 },
};

interface Props {
  onApply: (tco2: number) => void;
  onClose: () => void;
}

export function Scope1Calculator({ onApply, onClose }: Props) {
  const [fuelKey,  setFuelKey]  = useState("natural_gas");
  const [quantity, setQuantity] = useState("");
  const [unit,     setUnit]     = useState<"kg" | "m³" | "litre">("m³");
  const [rows,     setRows]     = useState<Array<{ fuelKey: string; quantity: number; tco2: number }>>([]);

  const fuel = FUELS[fuelKey];

  function addRow() {
    const q = parseFloat(quantity);
    if (!q || q <= 0) return;

    // Convert to kg equivalent for mass-based calculation
    // tCO₂ = quantity × ncv [MJ/unit] × EF [tCO₂/TJ] / 1000
    let ncvFactor = fuel.ncv; // MJ per unit
    if (unit === "litre" && fuelKey === "diesel") ncvFactor = fuel.ncv * 0.84; // density ~0.84 kg/litre
    const energyTj = q * ncvFactor / 1_000_000; // MJ → TJ
    const tco2     = energyTj * fuel.ef;

    setRows(prev => [...prev, { fuelKey, quantity: q, tco2 }]);
    setQuantity("");
  }

  const totalTco2 = rows.reduce((s, r) => s + r.tco2, 0);

  return (
    <div style={s.overlay} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={s.modal}>
        <div style={s.h2}>Scope 1 Hesaplama Yardımcısı</div>
        <div style={s.sub}>
          IPCC 2006 Tier 1 metodolojisi · Kaynak: EU 2019/1716 Ek II
        </div>

        {/* Yakıt seçici */}
        <div style={{ marginBottom: 14 }}>
          <label style={s.label}>Yakıt Türü</label>
          <select style={s.select} value={fuelKey}
            onChange={e => { setFuelKey(e.target.value); setUnit(FUELS[e.target.value].unit as typeof unit); }}>
            {Object.entries(FUELS).map(([k, f]) => (
              <option key={k} value={k}>{f.fuel}</option>
            ))}
          </select>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
          <div>
            <label style={s.label}>Tüketim Miktarı</label>
            <input style={s.input} type="number" placeholder="Miktar" min={0}
              value={quantity} onChange={e => setQuantity(e.target.value)} />
          </div>
          <div>
            <label style={s.label}>Birim</label>
            <select style={s.select} value={unit} onChange={e => setUnit(e.target.value as typeof unit)}>
              <option value={fuel.unit}>{fuel.unit}</option>
            </select>
          </div>
        </div>

        <div style={{ fontSize: 11, color: "#5c7a72", marginBottom: 12, padding: "8px 12px",
                      background: "#f4fbf8", borderRadius: 6 }}>
          NCV: {fuel.ncv} MJ/{fuel.unit} · EF: {fuel.ef} tCO₂/TJ (IPCC Tier 1)
          {fuel.ef === 0 && " · Biyokütle CO₂ kapsam dışı"}
        </div>

        <button style={{ ...s.btnG, width: "100%", marginBottom: 16 }} onClick={addRow}>
          Listeye Ekle
        </button>

        {/* Eklenen yakıtlar */}
        {rows.length > 0 && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 8,
                          textTransform: "uppercase", letterSpacing: ".05em" }}>Eklenen Yakıtlar</div>
            {rows.map((r, i) => (
              <div key={i} style={s.row}>
                <span style={{ fontSize: 13 }}>
                  {FUELS[r.fuelKey].fuel} · {r.quantity.toLocaleString()} {FUELS[r.fuelKey].unit}
                </span>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontWeight: 700, fontSize: 14, color: "#0a1f1a" }}>{r.tco2.toFixed(3)} tCO₂</span>
                  <button onClick={() => setRows(prev => prev.filter((_, j) => j !== i))}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#ef4444", fontSize: 14 }}>✕</button>
                </div>
              </div>
            ))}

            <div style={s.result}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#009966", letterSpacing: ".05em",
                            textTransform: "uppercase", marginBottom: 6 }}>Toplam Scope 1</div>
              <div style={{ fontSize: 28, fontWeight: 800, color: "#0a1f1a" }}>
                {totalTco2.toFixed(3)}
                <span style={{ fontSize: 14, color: "#5c7a72", fontWeight: 400 }}> tCO₂eq</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10 }}>
              <button style={{ ...s.btnG, flex: 1 }} onClick={() => { onApply(Math.round(totalTco2 * 1000) / 1000); onClose(); }}>
                Döneme Uygula
              </button>
              <button style={{ ...s.btnGh }} onClick={() => setRows([])}>Temizle</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
