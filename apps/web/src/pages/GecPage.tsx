import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Installation, InstallationDetail, Period } from "../lib/api.js";

const s: Record<string, React.CSSProperties> = {
  page:    { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:     { fontSize: 14, color: "#5c7a72", marginBottom: 28 },
  kpiRow:  { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, marginBottom: 28 },
  kpi:     { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:    { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  kpiV:    { fontSize: 24, fontWeight: 700, color: "#0a1f1a" },
  kpiSub:  { fontSize: 11, color: "#5c7a72", marginTop: 2 },
  card:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 20 },
  cardH:   { fontSize: 14, fontWeight: 600, color: "#0a1f1a", marginBottom: 16 },
  infoBox: { background: "#e6f9f2", border: "1px solid rgba(0,184,122,.25)", borderRadius: 8, padding: "14px 16px", marginBottom: 24, fontSize: 13, color: "#009966" },
  table:   { width: "100%", borderCollapse: "collapse" as const },
  th:      { textAlign: "left" as const, fontSize: 11, color: "#5c7a72", fontWeight: 600, textTransform: "uppercase" as const, letterSpacing: ".05em", padding: "10px 14px", borderBottom: "1px solid #d4ece4" },
  td:      { padding: "14px", fontSize: 13, color: "#1a3530", borderBottom: "1px solid #eef7f3", verticalAlign: "middle" as const },
  badge:   { display: "inline-flex", alignItems: "center", gap: 5, padding: "3px 10px", borderRadius: 20, fontSize: 12, fontWeight: 600 },
  badgeG:  { background: "#DCFCE7", color: "#15803D" },
  badgeY:  { background: "#FEF9C3", color: "#854D0E" },
  badgeR:  { background: "#FEE2E2", color: "#B91C1C" },
  btn:     { padding: "7px 14px", borderRadius: 7, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "#00b87a", color: "#fff" },
  btnSm:   { padding: "5px 12px", borderRadius: 6, border: "1px solid #D1D5DB", cursor: "pointer", fontSize: 12, background: "#fff", color: "#1a3530" },
  emptyBox:{ textAlign: "center" as const, padding: "48px 20px", color: "#5c7a72" },
  modal:   { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  mCard:   { background: "#fff", borderRadius: 12, padding: "28px", width: 480, boxShadow: "0 8px 32px rgba(0,0,0,.15)" },
  dzone:   { border: "2px dashed #D1D5DB", borderRadius: 8, padding: "24px", textAlign: "center" as const, cursor: "pointer", marginBottom: 14 },
  dzA:     { borderColor: "#00b87a", background: "#e6f9f2" },
  err:     { color: "#DC2626", fontSize: 13, marginBottom: 10 },
  ok:      { color: "#15803D", fontSize: 13, marginBottom: 10 },
  how:     { background: "#f4fbf8", borderRadius: 8, padding: "14px 16px", fontSize: 12, color: "#475569", marginBottom: 16 },
};

interface PeriodRow {
  installation: Installation;
  period: Period;
}

function GecBadge({ connected, matchRate }: { connected: boolean; matchRate: number }) {
  if (connected && matchRate > 0)
    return <span style={{ ...s.badge, ...s.badgeG }}>● Bağlı ({matchRate.toFixed(0)}%)</span>;
  if (connected)
    return <span style={{ ...s.badge, ...s.badgeY }}>● Bağlı (hesaplanmadı)</span>;
  return <span style={{ ...s.badge, ...s.badgeR }}>● GEC Yok</span>;
}

function CsvUploadModal({
  row,
  onClose,
  onSuccess,
}: {
  row: PeriodRow;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [file, setFile]     = useState<File | null>(null);
  const [drag, setDrag]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState("");
  const [result, setResult] = useState<{ rowCount: number; cfeScore: number } | null>(null);

  async function upload() {
    if (!file) return;
    setLoading(true);
    setErr("");
    try {
      const res = await api.cfe.importCsv(row.installation.id, row.period.id, file);
      setResult({ rowCount: res.rowCount, cfeScore: res.result.cfeScore * 100 });
      onSuccess();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }

  function pick(f: File) {
    if (!f.name.endsWith(".csv")) { setErr("Yalnızca CSV dosyası kabul edilir."); return; }
    setFile(f);
    setErr("");
  }

  return (
    <div style={s.modal} onClick={onClose}>
      <div style={s.mCard} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 16, fontWeight: 700, marginBottom: 6 }}>Saatlik Tüketim & Üretim Verisi</div>
        <div style={{ fontSize: 13, color: "#5c7a72", marginBottom: 16 }}>
          {row.installation.facilityName} — {row.period.periodName}
        </div>

        <div style={s.how}>
          <strong>CSV formatı:</strong> <code>hour,consumptionKwh,productionKwh</code><br />
          <span style={{ color: "#94A3B8" }}>Örnek: 2025-01-01T00:00:00Z,450.5,380.2</span><br />
          Saat başı UTC ISO 8601 formatında, virgülle ayrılmış.
        </div>

        {result ? (
          <div style={{ textAlign: "center", padding: "16px 0" }}>
            <div style={{ fontSize: 32, marginBottom: 8 }}>✅</div>
            <div style={{ fontWeight: 600, marginBottom: 4 }}>{result.rowCount} saat yüklendi</div>
            <div style={{ fontSize: 13, color: "#5c7a72" }}>
              CFE Skoru: <strong style={{ color: "#15803D" }}>{result.cfeScore.toFixed(1)}%</strong>
            </div>
            <button style={{ ...s.btn, marginTop: 16 }} onClick={onClose}>Kapat</button>
          </div>
        ) : (
          <>
            <div
              style={{ ...s.dzone, ...(drag ? s.dzA : {}) }}
              onDragOver={e => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={e => { e.preventDefault(); setDrag(false); const f = e.dataTransfer.files[0]; if (f) pick(f); }}
              onClick={() => document.getElementById("gec-file-input")?.click()}
            >
              <div style={{ fontSize: 24, marginBottom: 8 }}>📂</div>
              <div style={{ fontSize: 13, color: "#5c7a72" }}>
                {file ? file.name : "CSV dosyasını sürükle veya tıkla"}
              </div>
              <input id="gec-file-input" type="file" accept=".csv" style={{ display: "none" }}
                onChange={e => { const f = e.target.files?.[0]; if (f) pick(f); }} />
            </div>

            {err && <div style={s.err}>{err}</div>}

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button style={s.btnSm} onClick={onClose}>İptal</button>
              <button style={{ ...s.btn, opacity: !file || loading ? .5 : 1 }}
                disabled={!file || loading} onClick={upload}>
                {loading ? "Yükleniyor…" : "Yükle ve Hesapla"}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function GecPage() {
  const [rows, setRows]       = useState<PeriodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [upload, setUpload]   = useState<PeriodRow | null>(null);

  async function load() {
    setLoading(true);
    try {
      const installations = await api.installations.list();
      const details: InstallationDetail[] = await Promise.all(
        installations.map(i => api.installations.get(i.id))
      );
      const result: PeriodRow[] = [];
      for (const d of details) {
        for (const p of d.periods) {
          result.push({ installation: d, period: p });
        }
      }
      setRows(result);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  const connected    = rows.filter(r => r.period.gecConnected).length;
  const avgMatch     = connected > 0
    ? rows.filter(r => r.period.gecConnected).reduce((s, r) => s + r.period.matchingRatePct, 0) / connected
    : 0;
  const totalKwh     = rows.reduce((s, r) => s + r.period.electricityKwh, 0);

  return (
    <div style={s.page}>
      <div style={s.h1}>🔬 Granüler Emisyon Hesaplama</div>
      <div style={s.sub}>
        Saatlik tüketim × saatlik lokasyon bazlı emisyon faktörü → hassas Scope 2 hesaplama.
        GEC bağlı dönemler ülke ortalaması yerine gerçek saatlik EF kullanır.
      </div>

      <div style={s.infoBox}>
        <strong>Nasıl çalışır?</strong> Her dönem için saatlik tüketim + yenilenebilir üretim CSV'si yükleyin.
        Voltfox, eşleşen saatleri hesaplayarak <strong>effectiveEF = matchRate × renewableEF + (1−matchRate) × baselineEF</strong> formülünü uygular.
        Bu, CBAM Scope 2 yükümlülüğünü azaltır.
      </div>

      <div style={s.kpiRow}>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Dönem</div>
          <div style={s.kpiV}>{rows.length}</div>
          <div style={s.kpiSub}>{rows.map(r => r.installation.id).filter((v, i, a) => a.indexOf(v) === i).length} tesis</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>GEC Bağlı</div>
          <div style={{ ...s.kpiV, color: connected > 0 ? "#15803D" : "#0a1f1a" }}>{connected}</div>
          <div style={s.kpiSub}>{rows.length > 0 ? ((connected / rows.length) * 100).toFixed(0) : 0}% kapsam</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Ort. Eşleştirme Oranı</div>
          <div style={{ ...s.kpiV, color: avgMatch >= 70 ? "#15803D" : avgMatch >= 40 ? "#D97706" : "#DC2626" }}>
            {connected > 0 ? `${avgMatch.toFixed(1)}%` : "—"}
          </div>
          <div style={s.kpiSub}>GEC bağlı dönemler</div>
        </div>
        <div style={s.kpi}>
          <div style={s.kpiL}>Toplam Elektrik Tüketimi</div>
          <div style={s.kpiV}>{totalKwh > 0 ? `${(totalKwh / 1000).toFixed(0)} MWh` : "—"}</div>
          <div style={s.kpiSub}>tüm dönemler</div>
        </div>
      </div>

      <div style={s.card}>
        <div style={s.cardH}>Dönem Bazında GEC Durumu</div>
        {loading ? (
          <div style={s.emptyBox}>Yükleniyor…</div>
        ) : rows.length === 0 ? (
          <div style={s.emptyBox}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏭</div>
            <div>Henüz tesis veya dönem eklenmemiş.</div>
            <Link to="/cbam" style={{ color: "#00b87a", fontSize: 13 }}>
              CBAM sayfasından tesis ekleyin →
            </Link>
          </div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Tesis</th>
                <th style={s.th}>Dönem</th>
                <th style={s.th}>Elektrik (MWh)</th>
                <th style={s.th}>Eşleştirme</th>
                <th style={s.th}>GEC Durumu</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={row.period.id}>
                  <td style={s.td}>
                    <Link
                      to={`/installations/${row.installation.id}`}
                      style={{ color: "#00b87a", textDecoration: "none", fontWeight: 500 }}
                    >
                      {row.installation.facilityName}
                    </Link>
                    <div style={{ fontSize: 11, color: "#5c7a72" }}>{row.installation.facilityCountry}</div>
                  </td>
                  <td style={s.td}>
                    <div style={{ fontWeight: 500 }}>{row.period.periodName}</div>
                    <div style={{ fontSize: 11, color: "#5c7a72" }}>{row.period.reportYear}</div>
                  </td>
                  <td style={s.td}>{(row.period.electricityKwh / 1000).toFixed(1)} MWh</td>
                  <td style={s.td}>
                    {row.period.gecConnected
                      ? <span style={{ color: "#15803D", fontWeight: 600 }}>{row.period.matchingRatePct.toFixed(1)}%</span>
                      : <span style={{ color: "#5c7a72" }}>—</span>
                    }
                  </td>
                  <td style={s.td}>
                    <GecBadge connected={row.period.gecConnected} matchRate={row.period.matchingRatePct} />
                  </td>
                  <td style={{ ...s.td, textAlign: "right" }}>
                    <button
                      style={s.btn}
                      onClick={() => setUpload(row)}
                    >
                      {row.period.gecConnected ? "Güncelle" : "CSV Yükle"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Bilgi kartı — GEC değer önerisi */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <div style={{ ...s.card, marginBottom: 0 }}>
          <div style={s.cardH}>GEC Olmadan (Ülke Ortalaması)</div>
          <ul style={{ fontSize: 13, color: "#5c7a72", paddingLeft: 18, margin: 0, lineHeight: 2 }}>
            <li>Yıllık ortalama EF kullanılır (düşük hassasiyet)</li>
            <li>Yenilenebilir enerji avantajı hesaba katılmaz</li>
            <li>CBAM Scope 2 yükü daha yüksek kalır</li>
          </ul>
        </div>
        <div style={{ ...s.card, marginBottom: 0, borderColor: "#86EFAC" }}>
          <div style={{ ...s.cardH, color: "#15803D" }}>GEC ile (Saatlik Granüler)</div>
          <ul style={{ fontSize: 13, color: "#15803D", paddingLeft: 18, margin: 0, lineHeight: 2 }}>
            <li>Saat bazında tüketim × EF eşleştirmesi</li>
            <li>PPA / I-REC avantajı somut veriye dönüşür</li>
            <li>CBAM Scope 2 yükü azalır → tasarruf belgeli</li>
          </ul>
        </div>
      </div>

      {upload && (
        <CsvUploadModal
          row={upload}
          onClose={() => setUpload(null)}
          onSuccess={() => { load(); }}
        />
      )}
    </div>
  );
}
