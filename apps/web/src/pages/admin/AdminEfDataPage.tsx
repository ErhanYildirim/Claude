import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";
import type { EntsoeZone, EntsoeImportLog } from "../../lib/api.js";

interface EfZone {
  zoneCode:  string;
  zoneName:  string;
  country:   string;
  updatedAt: string;
}

function badgeStyle(status: string): React.CSSProperties {
  return {
    display: "inline-block", padding: "2px 8px", borderRadius: 10, fontSize: 11, fontWeight: 700,
    background: status === "ok" ? "#d1fae5" : status === "error" ? "#fee2e2" : "#fef3c7",
    color:      status === "ok" ? "#065f46" : status === "error" ? "#991b1b" : "#92400e",
  };
}

const S: Record<string, React.CSSProperties> = {
  page:  { padding: "32px 36px" },
  h1:    { fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 },
  card:  { background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden", marginBottom: 24 },
  cardH: { padding: "14px 20px", borderBottom: "1px solid #e5e7eb", background: "#f9fafb",
           display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardT: { fontSize: 15, fontWeight: 700, color: "#111827" },
  cardB: { padding: "20px" },
  btn:   { padding: "9px 18px", borderRadius: 7, border: "none", background: "#3b82f6",
           color: "#fff", fontSize: 14, fontWeight: 600, cursor: "pointer" },
  btnSm: { padding: "6px 12px", borderRadius: 6, border: "none", background: "#10b981",
           color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" },
  btnDis:{ opacity: 0.55, cursor: "not-allowed" },
  inp:   { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14,
           fontFamily: "inherit", width: "100%", boxSizing: "border-box" as const },
  sel:   { padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14,
           fontFamily: "inherit", width: "100%", boxSizing: "border-box" as const, background: "#fff" },
  lbl:   { fontSize: 12, color: "#6b7280", marginBottom: 4, display: "block" as const },
  grid2: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 },
  grid4: { display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: 12 },
  msg:   { padding: "10px 14px", borderRadius: 6, fontSize: 14, marginBottom: 16 },
};

export default function AdminEfDataPage() {
  const [tab, setTab] = useState<"zones" | "entso-e">("zones");

  // Zone list
  const [zones,     setZones]    = useState<EfZone[]>([]);
  const [search,    setSearch]   = useState("");
  const [loading,   setLoading]  = useState(true);
  const [importing, setImporting] = useState(false);
  const [zoneMsg,   setZoneMsg]  = useState<string | null>(null);

  // ENTSO-E
  const [entsoZones, setEntsoZones] = useState<EntsoeZone[]>([]);
  const [importLogs, setImportLogs] = useState<EntsoeImportLog[]>([]);
  const [entsoToken, setEntsoToken] = useState("");
  const [entsoZone,  setEntsoZone]  = useState("");
  const [entsoStart, setEntsoStart] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [entsoEnd,   setEntsoEnd]   = useState(() => new Date().toISOString().slice(0, 10));
  const [entsoStatus,setEntsoStatus]= useState<string | null>(null);
  const [entsoRunning,setEntsoRunning] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);

  function loadZones(q = "") {
    setLoading(true);
    api.admin.ef.zones(q).then(r => setZones(r.zones)).finally(() => setLoading(false));
  }

  async function deleteZone(zoneCode: string) {
    if (!confirm(`"${zoneCode}" zone'u ve tüm EF verilerini silmek istediğinizden emin misiniz? Bu işlem geri alınamaz.`)) return;
    try {
      await api.admin.ef.deleteZone(zoneCode);
      setZones(prev => prev.filter(z => z.zoneCode !== zoneCode));
    } catch (e: unknown) {
      alert(`Silme başarısız: ${(e as Error)?.message ?? "Bilinmeyen hata"}`);
    }
  }

  function loadEntsoData() {
    api.admin.entso_e.zones().then(r => setEntsoZones(r.zones)).catch(() => {});
    setLogsLoading(true);
    api.admin.entso_e.importLogs().then(r => setImportLogs(r.logs)).finally(() => setLogsLoading(false));
  }

  useEffect(() => { loadZones(); }, []);
  useEffect(() => { if (tab === "entso-e") loadEntsoData(); }, [tab]);

  async function triggerLegacyImport() {
    setImporting(true); setZoneMsg(null);
    try {
      await api.admin.ef.triggerImport();
      setZoneMsg("EF import arka planda başlatıldı. Birkaç dakika sürebilir.");
    } catch { setZoneMsg("Import başlatılamadı."); }
    finally { setImporting(false); }
  }

  async function triggerEntsoeImport() {
    if (!entsoToken.trim()) { setEntsoStatus("ENTSO-E API token gerekli."); return; }
    if (!entsoZone)         { setEntsoStatus("Zone seçin."); return; }
    setEntsoRunning(true); setEntsoStatus(null);
    try {
      const r = await api.admin.entso_e.import({
        token:     entsoToken.trim(),
        zoneCode:  entsoZone,
        startDate: entsoStart + "T00:00:00Z",
        endDate:   entsoEnd   + "T23:59:59Z",
      });
      setEntsoStatus(`${r.message} (Zone: ${r.zoneCode})`);
      setTimeout(() => {
        setLogsLoading(true);
        api.admin.entso_e.importLogs().then(r => setImportLogs(r.logs)).finally(() => setLogsLoading(false));
      }, 3000);
    } catch (e: unknown) {
      setEntsoStatus(`Hata: ${(e as Error)?.message ?? "Bilinmeyen hata"}`);
    } finally {
      setEntsoRunning(false);
    }
  }

  const tabStyle = (t: string): React.CSSProperties => ({
    padding: "8px 18px", borderRadius: "6px 6px 0 0", border: "none", cursor: "pointer",
    fontSize: 14, fontWeight: 600, fontFamily: "inherit",
    background: tab === t ? "#fff" : "#f3f4f6",
    color:      tab === t ? "#111827" : "#6b7280",
    borderBottom: tab === t ? "2px solid #3b82f6" : "2px solid transparent",
  });

  return (
    <div style={S.page}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={S.h1}>EF Veri Yönetimi</h1>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: 4, marginBottom: 0, borderBottom: "1px solid #e5e7eb" }}>
        <button style={tabStyle("zones")}    onClick={() => setTab("zones")}>Zone Listesi</button>
        <button style={tabStyle("entso-e")}  onClick={() => setTab("entso-e")}>ENTSO-E Import</button>
      </div>

      {/* ── Zone List Tab ──────────────────────────────────────────────── */}
      {tab === "zones" && (
        <div style={{ paddingTop: 20 }}>
          <div style={{ display: "flex", gap: 12, marginBottom: 16, alignItems: "center" }}>
            <input
              value={search}
              onChange={e => { setSearch(e.target.value); loadZones(e.target.value); }}
              placeholder="Zone veya ülke ara..."
              style={{ ...S.inp, width: 280 }}
            />
            <button onClick={triggerLegacyImport} disabled={importing}
              style={{ ...S.btn, ...(importing ? S.btnDis : {}) }}>
              {importing ? "Başlatılıyor…" : "Manuel Import Tetikle"}
            </button>
          </div>

          {zoneMsg && (
            <div style={{ ...S.msg, background: "#d1fae5", color: "#065f46" }}>{zoneMsg}</div>
          )}

          {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

          {!loading && (
            <div style={S.card}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Zone Kodu</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Zone Adı</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Ülke</th>
                    <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Son Güncelleme</th>
                    <th style={{ padding: "10px 16px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {zones.map(z => (
                    <tr key={z.zoneCode} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "11px 16px", fontFamily: "monospace", fontWeight: 600, color: "#1d4ed8" }}>{z.zoneCode}</td>
                      <td style={{ padding: "11px 16px", color: "#111827" }}>{z.zoneName}</td>
                      <td style={{ padding: "11px 16px", color: "#374151" }}>{z.country}</td>
                      <td style={{ padding: "11px 16px", fontSize: 12, color: "#6b7280" }}>
                        {z.updatedAt ? new Date(z.updatedAt).toLocaleString("tr-TR") : "—"}
                      </td>
                      <td style={{ padding: "11px 16px" }}>
                        <button
                          onClick={() => deleteZone(z.zoneCode)}
                          style={{ padding: "4px 10px", borderRadius: 5, border: "1px solid #fca5a5",
                                   background: "#fee2e2", color: "#991b1b", fontSize: 12,
                                   fontWeight: 600, cursor: "pointer" }}
                        >
                          Sil
                        </button>
                      </td>
                    </tr>
                  ))}
                  {zones.length === 0 && (
                    <tr><td colSpan={4} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Zone bulunamadı.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── ENTSO-E Import Tab ─────────────────────────────────────────── */}
      {tab === "entso-e" && (
        <div style={{ paddingTop: 20 }}>
          <div style={S.card}>
            <div style={S.cardH}>
              <span style={S.cardT}>ENTSO-E Transparency Platform — Gerçek Üretim Verisi</span>
            </div>
            <div style={S.cardB}>
              <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 16, marginTop: 0 }}>
                ENTSO-E A75 (Actual Generation Per Production Type) verisi çekerek saatlik karbon yoğunluğu hesaplar
                ve <code>emission_factors</code> tablosuna yazar. API token için{" "}
                <strong>transparency.entsoe.eu</strong> adresinde kayıt olunuz.
              </p>

              <div style={{ ...S.grid2, marginBottom: 14 }}>
                <div>
                  <label style={S.lbl}>ENTSO-E API Token <span style={{ color: "#ef4444" }}>*</span></label>
                  <input
                    type="password"
                    style={S.inp}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                    value={entsoToken}
                    onChange={e => setEntsoToken(e.target.value)}
                  />
                </div>
                <div>
                  <label style={S.lbl}>Bidding Zone <span style={{ color: "#ef4444" }}>*</span></label>
                  <select style={S.sel} value={entsoZone} onChange={e => setEntsoZone(e.target.value)}>
                    <option value="">— Seçin —</option>
                    {entsoZones.map(z => (
                      <option key={z.code} value={z.code}>{z.code} — {z.name} ({z.country})</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ ...S.grid2, marginBottom: 16 }}>
                <div>
                  <label style={S.lbl}>Başlangıç Tarihi</label>
                  <input type="date" style={S.inp} value={entsoStart} onChange={e => setEntsoStart(e.target.value)} />
                </div>
                <div>
                  <label style={S.lbl}>Bitiş Tarihi (maks. 31 gün)</label>
                  <input type="date" style={S.inp} value={entsoEnd}   onChange={e => setEntsoEnd(e.target.value)} />
                </div>
              </div>

              <button
                style={{ ...S.btn, ...(entsoRunning ? S.btnDis : {}) }}
                disabled={entsoRunning}
                onClick={triggerEntsoeImport}
              >
                {entsoRunning ? "Import başlatılıyor…" : "ENTSO-E Import Başlat"}
              </button>

              {entsoStatus && (
                <div style={{ ...S.msg, marginTop: 12,
                  background: entsoStatus.startsWith("Hata") ? "#fee2e2" : "#d1fae5",
                  color:      entsoStatus.startsWith("Hata") ? "#991b1b" : "#065f46" }}>
                  {entsoStatus}
                </div>
              )}

              <div style={{ marginTop: 16, padding: "10px 14px", background: "#fffbeb", borderRadius: 8,
                            border: "1px solid #fde68a", fontSize: 12, color: "#92400e" }}>
                <strong>PSR Karbon Yoğunluğu Kaynakları:</strong> IPCC 2022 medyan değerleri — Rüzgar: 11–12, Güneş: 45,
                Nükleer: 12, Hidrolik: 24, Gaz: 490, Kömür: 820–1150 gCO₂eq/kWh
              </div>
            </div>
          </div>

          {/* Import Logs */}
          <div style={S.card}>
            <div style={S.cardH}>
              <span style={S.cardT}>Son Import Logları</span>
              <button style={{ ...S.btnSm }} onClick={loadEntsoData} disabled={logsLoading}>
                {logsLoading ? "Yükleniyor…" : "Yenile"}
              </button>
            </div>
            <div style={{ overflowX: "auto" as const }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                    <th style={{ textAlign: "left", padding: "9px 14px", color: "#374151", fontWeight: 600 }}>Zone</th>
                    <th style={{ textAlign: "left", padding: "9px 14px", color: "#374151", fontWeight: 600 }}>Yıl</th>
                    <th style={{ textAlign: "left", padding: "9px 14px", color: "#374151", fontWeight: 600 }}>Durum</th>
                    <th style={{ textAlign: "right", padding: "9px 14px", color: "#374151", fontWeight: 600 }}>Eklenen</th>
                    <th style={{ textAlign: "left", padding: "9px 14px", color: "#374151", fontWeight: 600 }}>Mesaj</th>
                    <th style={{ textAlign: "left", padding: "9px 14px", color: "#374151", fontWeight: 600 }}>Tarih</th>
                  </tr>
                </thead>
                <tbody>
                  {importLogs.map(l => (
                    <tr key={l.id} style={{ borderBottom: "1px solid #f3f4f6" }}>
                      <td style={{ padding: "9px 14px", fontFamily: "monospace", fontWeight: 600, color: "#1d4ed8" }}>{l.zoneId ?? "—"}</td>
                      <td style={{ padding: "9px 14px", color: "#374151" }}>{l.year}</td>
                      <td style={{ padding: "9px 14px" }}>
                        <span style={badgeStyle(l.status)}>{l.status}</span>
                      </td>
                      <td style={{ padding: "9px 14px", textAlign: "right", color: "#111827", fontWeight: 600 }}>{l.rowsAdded}</td>
                      <td style={{ padding: "9px 14px", color: "#6b7280", maxWidth: 260,
                                   overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{l.message ?? "—"}</td>
                      <td style={{ padding: "9px 14px", fontSize: 11, color: "#9ca3af" }}>
                        {new Date(l.createdAt).toLocaleString("tr-TR")}
                      </td>
                    </tr>
                  ))}
                  {importLogs.length === 0 && !logsLoading && (
                    <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#9ca3af" }}>Henüz import logu yok.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
