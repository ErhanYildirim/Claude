import { useEffect, useState } from "react";
import { api } from "../../lib/api.js";

interface EfZone {
  zoneCode:  string;
  zoneName:  string;
  country:   string;
  updatedAt: string;
}

export default function AdminEfDataPage() {
  const [zones,    setZones]    = useState<EfZone[]>([]);
  const [search,   setSearch]   = useState("");
  const [loading,  setLoading]  = useState(true);
  const [importing, setImporting] = useState(false);
  const [message,  setMessage]  = useState<string | null>(null);

  function load(q = "") {
    setLoading(true);
    api.admin.ef.zones(q)
      .then(r => setZones(r.zones))
      .finally(() => setLoading(false));
  }

  useEffect(() => { load(); }, []);

  async function triggerImport() {
    setImporting(true);
    setMessage(null);
    try {
      await api.admin.ef.triggerImport();
      setMessage("EF import arka planda başlatıldı. Birkaç dakika sürebilir.");
    } catch {
      setMessage("Import başlatılamadı.");
    } finally {
      setImporting(false);
    }
  }

  return (
    <div style={{ padding: "32px 36px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", margin: 0 }}>EF Veri Yönetimi</h1>
        <button
          onClick={triggerImport}
          disabled={importing}
          style={{
            padding: "9px 18px",
            borderRadius: 7,
            border: "none",
            background: importing ? "#d1d5db" : "#3b82f6",
            color: "#fff",
            fontSize: 14,
            fontWeight: 600,
            cursor: importing ? "not-allowed" : "pointer",
          }}
        >
          {importing ? "Başlatılıyor…" : "Manuel Import Tetikle"}
        </button>
      </div>

      {message && (
        <div style={{ marginBottom: 16, padding: "10px 14px", borderRadius: 6, background: "#d1fae5", color: "#065f46", fontSize: 14 }}>
          {message}
        </div>
      )}

      <input
        value={search}
        onChange={e => { setSearch(e.target.value); load(e.target.value); }}
        placeholder="Zone veya ülke ara..."
        style={{ padding: "8px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, width: 280, marginBottom: 20 }}
      />

      {loading && <div style={{ color: "#6b7280" }}>Yükleniyor...</div>}

      {!loading && (
        <div style={{ background: "#fff", borderRadius: 10, boxShadow: "0 1px 3px rgba(0,0,0,0.08)", overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ borderBottom: "1px solid #e5e7eb", background: "#f9fafb" }}>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Zone Kodu</th>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Zone Adı</th>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Ülke</th>
                <th style={{ textAlign: "left", padding: "10px 16px", color: "#374151", fontWeight: 600 }}>Son Güncelleme</th>
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
  );
}
