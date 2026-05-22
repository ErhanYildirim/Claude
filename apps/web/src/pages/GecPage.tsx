import { useState, useRef, useEffect } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Cell,
} from "recharts";
import { api } from "../lib/api.js";
import type { GecResult, GecMonthlyPoint, EFZoneEntry, Installation, Period } from "../lib/api.js";

/* ── Styles ──────────────────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:    { fontSize: 14, color: "#5c7a72", marginBottom: 28 },

  kpiRow: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 24 },
  kpi:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:   { fontSize: 11, color: "#5c7a72", fontWeight: 700, marginBottom: 6,
            textTransform: "uppercase" as const, letterSpacing: ".06em" },
  kpiV:   { fontSize: 26, fontWeight: 800, color: "#0a1f1a", lineHeight: 1 },
  kpiU:   { fontSize: 11, color: "#5c7a72", marginTop: 4 },

  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4",
            padding: "20px", marginBottom: 20 },
  cardH:  { fontSize: 11, fontWeight: 700, color: "#5c7a72", marginBottom: 16,
            textTransform: "uppercase" as const, letterSpacing: ".08em" },

  table:  { width: "100%", borderCollapse: "collapse" as const },
  th:     { textAlign: "left" as const, fontSize: 11, color: "#5c7a72", fontWeight: 700,
            textTransform: "uppercase" as const, letterSpacing: ".05em",
            padding: "10px 14px", borderBottom: "1px solid #d4ece4" },
  td:     { padding: "12px 14px", fontSize: 13, color: "#1a3530",
            borderBottom: "1px solid #eef7f3" },
  tdR:    { padding: "12px 14px", fontSize: 13, color: "#1a3530",
            borderBottom: "1px solid #eef7f3", textAlign: "right" as const },

  btn:    { padding: "10px 20px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 14, background: "#00b87a", color: "#fff" },
  btnSm:  { padding: "7px 16px", borderRadius: 7, border: "1px solid #d4ece4",
            cursor: "pointer", fontSize: 13, background: "#fff", color: "#1a3530" },

  dzone:  { border: "2px dashed #d4ece4", borderRadius: 12, padding: "48px 32px",
            textAlign: "center" as const, cursor: "pointer", transition: "all .15s" },
  dzA:    { borderColor: "#00b87a", background: "#e6f9f2" },

  how:    { background: "#f4fbf8", borderRadius: 8, padding: "14px 16px",
            fontSize: 12, color: "#5c7a72", marginTop: 16, lineHeight: 1.7 },
  err:    { color: "#DC2626", fontSize: 13, marginTop: 12, textAlign: "center" as const },

  infoRow:{ display: "flex", gap: 10, alignItems: "center", marginBottom: 24,
            background: "#e6f9f2", border: "1px solid rgba(0,184,122,.25)",
            borderRadius: 8, padding: "12px 16px", fontSize: 13, color: "#009966" },
};

function co2Color(tco2: number, max: number) {
  const r = max > 0 ? tco2 / max : 0;
  if (r > 0.8) return "#ef4444";
  if (r > 0.5) return "#f59e0b";
  return "#00b87a";
}

/* ── Upload view ─────────────────────────────────────────────────────────── */
function UploadView({
  onResult,
}: {
  onResult: (r: GecResult) => void;
}) {
  const [file, setFile]                   = useState<File | null>(null);
  const [drag, setDrag]                   = useState(false);
  const [loading, setLoading]             = useState(false);
  const [err, setErr]                     = useState("");
  const [zoneId, setZoneId]               = useState("TR");
  const [zones, setZones]                 = useState<EFZoneEntry[]>([]);
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [instId, setInstId]               = useState("");
  const [periods, setPeriods]             = useState<Period[]>([]);
  const [periodId, setPeriodId]           = useState("");
  const inputRef                          = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.ef.zones().then(r => setZones(r.zones)).catch(() => {});
    api.installations.list().then(r => setInstallations(r)).catch(() => {});
  }, []);

  useEffect(() => {
    if (!instId) { setPeriods([]); setPeriodId(""); return; }
    api.installations.get(instId).then(r => {
      setPeriods(r.periods ?? []);
      setPeriodId("");
    }).catch(() => {});
  }, [instId]);

  function pick(f: File) {
    if (!f.name.endsWith(".csv")) { setErr("Yalnızca CSV dosyası kabul edilir."); return; }
    setFile(f);
    setErr("");
  }

  async function calculate() {
    if (!file) return;
    setLoading(true);
    setErr("");
    try {
      const result = await api.gec.calculate(file, zoneId, periodId || undefined);
      onResult(result);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Hesaplama hatası oluştu.");
    } finally {
      setLoading(false);
    }
  }

  const selectedZone = zones.find(z => z.zoneId === zoneId);

  return (
    <div style={{ maxWidth: 640, margin: "0 auto" }}>
      {/* Zone seçici */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a3530", marginBottom: 6 }}>
          EF Zone (Emisyon Faktörü Bölgesi)
        </div>
        <select
          style={{ width: "100%", padding: "10px 12px", borderRadius: 8, border: "1px solid #d4ece4",
                   fontSize: 14, background: "#fff", cursor: "pointer", color: "#0a1f1a" }}
          value={zoneId}
          onChange={e => setZoneId(e.target.value)}
        >
          {zones.length === 0 && <option value="TR">TR — Türkiye (yükleniyor…)</option>}
          {zones.map(z => (
            <option key={z.zoneId} value={z.zoneId}>
              {z.zoneId} — {z.zoneName || z.country}
            </option>
          ))}
        </select>
        {selectedZone && (
          <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 4 }}>
            {selectedZone.rowCount.toLocaleString()} saatlik kayıt · 2024
          </div>
        )}
      </div>

      {/* Opsiyonel: döneme bağla */}
      <div style={{ marginBottom: 20, padding: "14px 16px", background: "#f4fbf8",
                    borderRadius: 8, border: "1px solid #d4ece4" }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: "#5c7a72", marginBottom: 10,
                      textTransform: "uppercase", letterSpacing: ".05em" }}>
          Döneme Bağla (opsiyonel)
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <select
            style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid #d4ece4",
                     fontSize: 13, background: "#fff", color: "#0a1f1a" }}
            value={instId}
            onChange={e => setInstId(e.target.value)}
          >
            <option value="">— Tesis seç —</option>
            {installations.map(i => (
              <option key={i.id} value={i.id}>{i.facilityName}</option>
            ))}
          </select>
          <select
            style={{ padding: "8px 10px", borderRadius: 7, border: "1px solid #d4ece4",
                     fontSize: 13, background: "#fff", color: "#0a1f1a" }}
            value={periodId}
            onChange={e => setPeriodId(e.target.value)}
            disabled={!instId || periods.length === 0}
          >
            <option value="">— Dönem seç —</option>
            {periods.map(p => (
              <option key={p.id} value={p.id}>{p.periodName}</option>
            ))}
          </select>
        </div>
        {periodId && (
          <div style={{ fontSize: 11, color: "#009966", marginTop: 6 }}>
            Saatlik veriler hesaplama ile birlikte bu döneme kaydedilecek.
          </div>
        )}
      </div>

      <div
        style={{ ...s.dzone, ...(drag ? s.dzA : {}) }}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => {
          e.preventDefault(); setDrag(false);
          const f = e.dataTransfer.files[0]; if (f) pick(f);
        }}
        onClick={() => inputRef.current?.click()}
      >
        <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: "#0a1f1a", marginBottom: 6 }}>
          {file ? file.name : "Saatlik tüketim CSV'sini yükle"}
        </div>
        <div style={{ fontSize: 13, color: "#5c7a72" }}>
          {file
            ? `${(file.size / 1024).toFixed(1)} KB — değiştirmek için tekrar tıkla`
            : "Dosyayı buraya sürükle veya tıklayarak seç"}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          style={{ display: "none" }}
          onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }}
        />
      </div>

      <div style={s.how}>
        <strong>CSV formatı (başlık satırı zorunlu):</strong><br />
        <code>hour,consumptionKwh</code><br />
        <code style={{ color: "#94A3B8" }}>2024-01-01T00:00:00Z,450.5</code><br />
        <code style={{ color: "#94A3B8" }}>2024-01-01T01:00:00Z,423.0</code><br />
        <br />
        <strong>Alternatif başlıklar:</strong> <code>timestamp</code>, <code>consumption_kwh</code> da kabul edilir.<br />
        Saat dilimi: UTC · Granülerlik: saat başı · Seçilen zone: <strong>{zoneId}</strong> (2024)
      </div>

      {err && <div style={s.err}>{err}</div>}

      <div style={{ textAlign: "center", marginTop: 20 }}>
        <button
          style={{ ...s.btn, opacity: !file || loading ? 0.5 : 1, minWidth: 180 }}
          disabled={!file || loading}
          onClick={calculate}
        >
          {loading ? "Hesaplanıyor…" : "Granüler Emisyon Hesapla"}
        </button>
      </div>
    </div>
  );
}

/* ── Result view ─────────────────────────────────────────────────────────── */
function ResultView({
  result,
  onReset,
}: {
  result: GecResult;
  onReset: () => void;
}) {
  const maxTco2 = Math.max(...result.monthly.map(m => m.tco2));

  return (
    <>
      {/* Info banner */}
      <div style={s.infoRow}>
        <span style={{ fontSize: 18 }}>✅</span>
        <span>
          <strong>{result.matchedHours.toLocaleString()}</strong> saatlik EF eşleştirmesi tamamlandı —
          zone: <strong>{result.zoneId}</strong> · metodoloji: saatlik tüketim × lokasyon bazlı EF
          {result.savedToPeriod && (
            <span style={{ marginLeft: 8, color: "#009966", fontWeight: 700 }}>
              · Döneme kaydedildi
            </span>
          )}
        </span>
        <button style={{ ...s.btnSm, marginLeft: "auto", whiteSpace: "nowrap" }} onClick={onReset}>
          Yeni Hesap
        </button>
      </div>

      {/* KPI row */}
      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Emisyon</div>
          <div style={{ ...s.kpiV, color: "#0a1f1a" }}>{result.totalTco2.toFixed(2)}</div>
          <div style={s.kpiU}>tCO₂eq · Scope 2</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Tüketim</div>
          <div style={s.kpiV}>{(result.totalConsumptionKwh / 1000).toFixed(1)}</div>
          <div style={s.kpiU}>MWh</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Ort. Emisyon Faktörü</div>
          <div style={{ ...s.kpiV, color: result.avgEfGco2Kwh < 200 ? "#059669" : result.avgEfGco2Kwh < 400 ? "#d97706" : "#ef4444" }}>
            {result.avgEfGco2Kwh.toFixed(0)}
          </div>
          <div style={s.kpiU}>gCO₂/kWh · ağırlıklı ort.</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Eşleşen Saat</div>
          <div style={s.kpiV}>{result.matchedHours.toLocaleString()}</div>
          <div style={s.kpiU}>
            {result.totalRows > 0
              ? `${((result.matchedHours / result.totalRows) * 100).toFixed(0)}% kapsam`
              : "saat"}
          </div>
        </div>
      </div>

      {/* Monthly bar chart */}
      <div style={s.card}>
        <div style={s.cardH}>Aylık Emisyon Dağılımı — tCO₂eq</div>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={result.monthly} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
            <XAxis dataKey="monthName" tick={{ fontSize: 11, fill: "#5c7a72" }} />
            <YAxis tick={{ fontSize: 11, fill: "#5c7a72" }} unit=" t" width={56} />
            <Tooltip
              formatter={(v: unknown) => [`${Number(v).toFixed(3)} tCO₂eq`, "Emisyon"] as [string, string]}
              labelStyle={{ fontWeight: 600, color: "#0a1f1a" }}
              contentStyle={{ borderRadius: 8, border: "1px solid #d4ece4", fontSize: 12 }}
            />
            <Bar dataKey="tco2" radius={[4, 4, 0, 0]}>
              {result.monthly.map((m) => (
                <Cell key={m.month} fill={co2Color(m.tco2, maxTco2)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly table */}
      <div style={s.card}>
        <div style={s.cardH}>Aylık Detay</div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Ay</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Tüketim (MWh)</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Ort. EF (gCO₂/kWh)</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Emisyon (tCO₂eq)</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Saat</th>
            </tr>
          </thead>
          <tbody>
            {result.monthly.map((m: GecMonthlyPoint) => (
              <tr key={m.month}>
                <td style={s.td}>{m.monthName}</td>
                <td style={s.tdR}>{(m.consumptionKwh / 1000).toFixed(2)}</td>
                <td style={s.tdR}>
                  <span style={{
                    color: m.avgEfGco2Kwh < 200 ? "#059669" : m.avgEfGco2Kwh < 400 ? "#d97706" : "#ef4444",
                    fontWeight: 600,
                  }}>
                    {m.avgEfGco2Kwh.toFixed(1)}
                  </span>
                </td>
                <td style={{ ...s.tdR, fontWeight: 600 }}>{m.tco2.toFixed(3)}</td>
                <td style={{ ...s.tdR, color: "#5c7a72" }}>{m.hours}</td>
              </tr>
            ))}
            <tr style={{ background: "#f4fbf8" }}>
              <td style={{ ...s.td, fontWeight: 700 }}>Toplam</td>
              <td style={{ ...s.tdR, fontWeight: 700 }}>
                {(result.totalConsumptionKwh / 1000).toFixed(2)}
              </td>
              <td style={{ ...s.tdR, fontWeight: 700 }}>{result.avgEfGco2Kwh.toFixed(1)}</td>
              <td style={{ ...s.tdR, fontWeight: 700, color: "#0a1f1a" }}>
                {result.totalTco2.toFixed(3)}
              </td>
              <td style={{ ...s.tdR, fontWeight: 700, color: "#5c7a72" }}>
                {result.matchedHours}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Metodoloji notu */}
      <div style={{ ...s.card, marginBottom: 0, fontSize: 12, color: "#5c7a72" }}>
        <div style={s.cardH}>Metodoloji</div>
        <div>
          <strong>Hesaplama:</strong> Σ(tüketimKwh × ci_direct_gCO₂/kWh) ÷ 1.000.000 = tCO₂eq<br />
          <strong>EF Kaynağı:</strong> Electricity Maps · {result.zoneId} · 2024 saatlik · lokasyon bazlı<br />
          <strong>Kapsam:</strong> GHG Protocol Scope 2 — market-based (saatlik granüler)<br />
          <strong>Referans:</strong> EU 2023/1773 Ek IV · ISO 14064-1:2018
        </div>
      </div>
    </>
  );
}

/* ── Page ─────────────────────────────────────────────────────────────────── */
export default function GecPage() {
  const [result, setResult] = useState<GecResult | null>(null);

  return (
    <div style={s.page}>
      <div style={s.h1}>Granüler Emisyon Hesaplama</div>
      <div style={s.sub}>
        Saatlik tüketim × saatlik lokasyon bazlı EF → hassas Scope 2 tCO₂
        {result && (
          <span style={{ color: "#00b87a", marginLeft: 8 }}>
            · {result.zoneId} · {result.matchedHours} saat
          </span>
        )}
      </div>

      {result
        ? <ResultView result={result} onReset={() => setResult(null)} />
        : <UploadView onResult={setResult} />
      }
    </div>
  );
}
