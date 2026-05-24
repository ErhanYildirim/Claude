import { useState, useEffect } from "react";
import { api } from "../lib/api.js";
import { useTheme } from "../contexts/ThemeContext.js";
import type { EFCoverageData, EFImportStatus } from "../lib/api.js";

export default function EfCoveragePage() {
  const { theme } = useTheme();
  const isDark = theme === "dark";

  const bg      = isDark ? "var(--bg-card,#162820)" : "#fff";
  const border  = isDark ? "rgba(255,255,255,.08)" : "#d4ece4";
  const text    = isDark ? "#e2efe9" : "#0a1f1a";
  const muted   = isDark ? "#7dab97" : "#5c7a72";
  const inputBg = isDark ? "#1e3830" : "#f4fbf8";
  const card: React.CSSProperties  = { background: bg, borderRadius: 10, border: `1px solid ${border}`, padding: "20px", marginBottom: 16 };
  const cardH: React.CSSProperties = { fontSize: 11, fontWeight: 700, color: muted, marginBottom: 14, textTransform: "uppercase", letterSpacing: ".08em" };

  const [coverage,     setCoverage]     = useState<EFCoverageData | null>(null);
  const [importStatus, setImportStatus] = useState<EFImportStatus | null>(null);
  const [loading,      setLoading]      = useState(true);

  useEffect(() => {
    Promise.all([
      api.ef.coverage().catch((): EFCoverageData | null => null),
      api.ef.importStatus().catch((): EFImportStatus | null => null),
    ]).then(([cov, imp]) => {
      if (cov) setCoverage(cov);
      if (imp) setImportStatus(imp);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px", color: muted }}>Yükleniyor...</div>;

  if (!coverage) return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ ...card, textAlign: "center", padding: "60px 40px" }}>
        <div style={{ fontSize: 13, color: muted }}>Kapsam verisi bulunamadı</div>
      </div>
    </div>
  );

  const years = coverage.availableYears;
  function expectedHours(yr: number) {
    return (yr % 4 === 0 && yr % 100 !== 0) || yr % 400 === 0 ? 8784 : 8760;
  }

  return (
    <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 28px" }}>
      <div style={{ fontSize: 22, fontWeight: 700, color: text, marginBottom: 4 }}>Kapsam Yönetimi</div>
      <div style={{ fontSize: 14, color: muted, marginBottom: 28 }}>
        Zone × yıl veri kapsamı ve import durumu
      </div>

      {/* Available years */}
      <div style={{ ...card, marginBottom: 16 }}>
        <div style={cardH}>Mevcut Yıllar</div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          {years.map(y => (
            <div key={y} style={{ background: isDark ? "#064e3b" : "#e6f9f2", border: `1px solid ${isDark ? "#065f46" : "#a7f3d0"}`, borderRadius: 8, padding: "10px 18px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "#00b87a" }}>{y}</div>
              <div style={{ fontSize: 11, color: muted }}>
                {coverage.zones.filter(z => z.years.some(yr => yr.year === y)).length} zone
              </div>
              <div style={{ fontSize: 10, color: muted }}>{expectedHours(y).toLocaleString()} saat/zone</div>
            </div>
          ))}
          {years.length === 0 && <div style={{ color: muted, fontSize: 13 }}>Veri yok</div>}
        </div>
      </div>

      {/* Zone × Year matrix */}
      <div style={card}>
        <div style={cardH}>Zone × Yıl Kapsam Matrisi</div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left", padding: "6px 10px", color: muted, borderBottom: `1px solid ${border}`, fontWeight: 700 }}>Zone</th>
                <th style={{ textAlign: "left", padding: "6px 10px", color: muted, borderBottom: `1px solid ${border}`, fontWeight: 700 }}>Ülke</th>
                {years.map(y => (
                  <th key={y} style={{ textAlign: "center", padding: "6px 10px", color: muted, borderBottom: `1px solid ${border}`, fontWeight: 700 }}>{y}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {coverage.zones.map(zone => (
                <tr key={zone.zoneId} style={{ borderBottom: `1px solid ${border}` }}>
                  <td style={{ padding: "6px 10px", fontWeight: 700, color: text }}>{zone.zoneId}</td>
                  <td style={{ padding: "6px 10px", color: muted }}>{zone.country}</td>
                  {years.map(y => {
                    const yd = zone.years.find(yr => yr.year === y);
                    return (
                      <td key={y} style={{ textAlign: "center", padding: "6px 10px" }}>
                        {yd ? (
                          <span style={{
                            display: "inline-block", padding: "2px 8px", borderRadius: 5, fontSize: 11,
                            background: yd.complete ? (isDark ? "#064e3b" : "#e6f9f2") : (isDark ? "#451a03" : "#fef3c7"),
                            color: yd.complete ? "#009966" : "#d97706", fontWeight: 600,
                          }}>
                            {yd.complete ? `✓ ${(yd.rowCount / 1000).toFixed(1)}k` : `${(yd.rowCount / 1000).toFixed(1)}k`}
                          </span>
                        ) : (
                          <span style={{ color: isDark ? "#2d5046" : "#d1d5db", fontSize: 11 }}>—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ fontSize: 11, color: muted, marginTop: 12 }}>
          ✓ = Tam veri (%99+) · Sarı = Eksik/kısmi veri · — = Veri yok
        </div>
      </div>

      {/* Import status */}
      <div style={card}>
        <div style={cardH}>Otomatik Güncelleme Durumu</div>
        {importStatus ? (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
            <div style={{ background: inputBg, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Son Çalışma</div>
              {importStatus.lastImport ? (
                <>
                  <div style={{ fontSize: 14, fontWeight: 700, color: importStatus.lastImport.status === "ok" ? "#059669" : "#DC2626" }}>
                    {importStatus.lastImport.status === "ok" ? "✓ Başarılı" : "✗ Hata"}
                  </div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>
                    {new Date(importStatus.lastImport.createdAt).toLocaleString("tr-TR")}
                  </div>
                  {importStatus.lastImport.message && (
                    <div style={{ fontSize: 11, color: muted, marginTop: 4, lineHeight: 1.5 }}>{importStatus.lastImport.message}</div>
                  )}
                </>
              ) : (
                <div style={{ fontSize: 13, color: muted }}>Henüz çalışmadı</div>
              )}
            </div>
            <div style={{ background: inputBg, borderRadius: 8, padding: "12px 14px" }}>
              <div style={{ fontSize: 11, color: muted, fontWeight: 700, marginBottom: 4, textTransform: "uppercase" }}>Sonraki Çalışma</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: text }}>
                {new Date(importStatus.nextScheduledRun).toLocaleString("tr-TR")}
              </div>
              <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Zamanlama: {importStatus.schedule} (UTC)</div>
              <div style={{ fontSize: 11, color: muted, marginTop: 2 }}>Toplam: {importStatus.totalRows.toLocaleString()} satır</div>
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, color: muted, marginBottom: 14 }}>Durum bilgisi bulunamadı</div>
        )}
        <div style={{ fontSize: 13, color: muted, marginBottom: 10, lineHeight: 1.7 }}>Manuel import:</div>
        <pre style={{ background: "#0a1f1a", color: "#00b87a", borderRadius: 8, padding: "12px 16px", fontSize: 12, fontFamily: "monospace", overflowX: "auto", lineHeight: 1.6, margin: 0 }}>
{`npx tsx scripts/import-ef-year.ts --year=2025
# Belirli zone'lar için:
npx tsx scripts/import-ef-year.ts --year=2025 --zone=TR,DE,FR
# Devam etmek için (hata sonrası):
npx tsx scripts/import-ef-year.ts --year=2025 --resume=10
# Dry run (yazma yapmadan test):
npx tsx scripts/import-ef-year.ts --year=2025 --dry-run`}
        </pre>
      </div>
    </div>
  );
}
