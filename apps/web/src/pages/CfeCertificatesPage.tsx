import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { Installation, CFEResult } from "../lib/api.js";

interface PeriodEntry {
  installationId: string;
  facilityName: string;
  periodId: string;
  periodName: string;
  cfe: CFEResult;
}

function cfeColor(score: number) {
  return score >= 70 ? "#059669" : score >= 40 ? "#D97706" : "#DC2626";
}

export default function CfeCertificatesPage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const [entries,  setEntries]  = useState<PeriodEntry[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [refs,     setRefs]     = useState<Record<string, string>>({});

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1e3830" : "#f4fbf8";
  const stripeBg = isDark ? "#1a3530" : "#f9fdfb";

  useEffect(() => {
    async function load() {
      const list: Installation[] = await api.installations.list();
      const details = await Promise.all(list.map(i => api.installations.get(i.id)));
      const all: PeriodEntry[] = [];
      for (const inst of details) {
        for (const p of inst.periods) {
          try {
            const cfe = await api.cfe.get(inst.id, p.id);
            if (cfe) all.push({ installationId: inst.id, facilityName: inst.facilityName, periodId: p.id, periodName: p.periodName, cfe });
          } catch { /* no CFE data */ }
        }
      }
      setEntries(all);
      setLoading(false);
    }
    load().catch(() => setLoading(false));
  }, []);

  function refKey(e: PeriodEntry) { return `${e.installationId}|${e.periodId}`; }

  function downloadCert(e: PeriodEntry) {
    const ref = refs[refKey(e)] || undefined;
    window.open(api.cfe.certificateUrl(e.installationId, e.periodId, ref), "_blank");
  }

  if (loading) return <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px", color: muted }}>Yükleniyor...</div>;

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>CFE Sertifikaları</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 28 }}>
        EAC / I-REC / GC sertifikası oluştur ve indir
      </div>

      {entries.length === 0 ? (
        <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, padding: "80px 40px", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>📜</div>
          <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 8 }}>Sertifika Bulunamadı</div>
          <div style={{ fontSize: 14, color: muted }}>CFE verisi olan dönem bulunmuyor. Önce veri yükleyin.</div>
        </div>
      ) : (
        <>
          {/* Info card */}
          <div style={{ background: isDark ? "#0d2a20" : "#f0fdf4", border: `1px solid ${isDark ? "#065f46" : "#bbf7d0"}`, borderRadius: 10, padding: "16px 20px", marginBottom: 24 }}>
            <div style={{ fontSize: 13, color: isDark ? "#6ee7b7" : "#065f46", lineHeight: 1.7 }}>
              <strong>Sertifika içeriği:</strong> Tesis bilgileri, dönem, CFE skoru, eşleşen/eşleşmeyen saatler ve metodoloji (EnergyTag GC Standard).
              EAC / I-REC referans numarası sertifikaya dahil edilir.
            </div>
          </div>

          {/* Certificates table */}
          <div style={{ background: bg, borderRadius: 12, border: `1px solid ${border}`, overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: inputBg }}>
                    {["Tesis", "Dönem", "CFE Skoru", "Eşleşen", "EAC / I-REC No", "Sertifika"].map(h => (
                      <th key={h} style={{
                        padding: "12px 16px", textAlign: h === "CFE Skoru" || h === "Eşleşen" || h === "Sertifika" ? "center" : "left",
                        fontSize: 11, color: muted, fontWeight: 700, textTransform: "uppercase",
                        letterSpacing: ".06em", borderBottom: `1px solid ${border}`,
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e, i) => (
                    <tr key={refKey(e)} style={{ background: i % 2 === 0 ? bg : stripeBg }}>
                      <td style={{ padding: "14px 16px", fontSize: 13, fontWeight: 600, color: text, borderBottom: `1px solid ${border}` }}>
                        {e.facilityName}
                      </td>
                      <td style={{ padding: "14px 16px", fontSize: 13, color: muted, borderBottom: `1px solid ${border}` }}>
                        {e.periodName}
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", borderBottom: `1px solid ${border}` }}>
                        <span style={{
                          display: "inline-block", padding: "3px 12px", borderRadius: 20,
                          fontSize: 13, fontWeight: 700, color: cfeColor(e.cfe.cfeScore),
                          background: cfeColor(e.cfe.cfeScore) + "18",
                        }}>
                          {e.cfe.cfeScore.toFixed(1)}%
                        </span>
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", fontSize: 13, color: "#059669", fontWeight: 600, borderBottom: `1px solid ${border}` }}>
                        {e.cfe.matchedHours.toLocaleString()} saat
                      </td>
                      <td style={{ padding: "14px 16px", borderBottom: `1px solid ${border}` }}>
                        <input
                          value={refs[refKey(e)] ?? ""}
                          onChange={ev => setRefs(prev => ({ ...prev, [refKey(e)]: ev.target.value }))}
                          placeholder="I-REC-TR-2024-000123"
                          style={{ width: "100%", padding: "6px 10px", borderRadius: 6, border: `1px solid ${border}`, fontSize: 12, background: inputBg, color: text, boxSizing: "border-box" }}
                        />
                      </td>
                      <td style={{ padding: "14px 16px", textAlign: "center", borderBottom: `1px solid ${border}` }}>
                        <button
                          onClick={() => downloadCert(e)}
                          style={{
                            padding: "7px 16px", borderRadius: 7, border: "none", cursor: "pointer",
                            fontWeight: 600, fontSize: 12, background: "#00b87a", color: "#fff",
                            fontFamily: "inherit",
                          }}
                        >
                          İndir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Batch download */}
          <div style={{ marginTop: 20, padding: "16px 20px", background: bg, borderRadius: 10, border: `1px solid ${border}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 13, color: muted }}>
              {entries.length} dönem için sertifika mevcut
            </div>
            <div style={{ fontSize: 12, color: muted }}>
              Her satırda EAC/I-REC No girerek bireysel indirebilirsiniz
            </div>
          </div>
        </>
      )}
    </div>
  );
}
