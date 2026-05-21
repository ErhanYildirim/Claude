import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { api } from "../lib/api.js";
import type { ShareViewResult } from "../lib/api.js";

const s: Record<string, React.CSSProperties> = {
  nav:    { background: "#00b87a", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand:  { fontWeight: 700, fontSize: 18 },
  badge:  { background: "rgba(255,255,255,.2)", borderRadius: 5, padding: "3px 10px", fontSize: 12, fontWeight: 600 },
  page:   { maxWidth: 860, margin: "0 auto", padding: "32px 24px" },
  h1:     { fontSize: 20, fontWeight: 700, marginBottom: 4 },
  sub:    { color: "#5c7a72", fontSize: 13, marginBottom: 28 },
  grid:   { display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16, marginBottom: 24 },
  kpi:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "18px 20px" },
  kpiL:   { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  kpiV:   { fontSize: 22, fontWeight: 700, color: "#0a1f1a" },
  kpiG:   { color: "#059669" },
  section:{ fontSize: 12, fontWeight: 600, color: "#5c7a72", marginTop: 24, marginBottom: 10, textTransform: "uppercase" as const, letterSpacing: ".05em" },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 16 },
  row:    { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: "1px solid #eef7f3" },
  rowL:   { fontSize: 13, color: "#5c7a72" },
  rowV:   { fontSize: 14, fontWeight: 600, color: "#0a1f1a" },
  banner: { background: "#e6f9f2", border: "1px solid rgba(0,184,122,.25)", borderRadius: 10, padding: "14px 18px", marginBottom: 24, fontSize: 13, color: "#009966", display: "flex", alignItems: "center", gap: 10 },
  errBox: { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" },
  errCard:{ background: "#fff", borderRadius: 12, padding: "48px 40px", textAlign: "center" as const, maxWidth: 400, boxShadow: "0 4px 24px rgba(0,0,0,.08)" },
  errIcon:{ fontSize: 40, marginBottom: 12 },
  errT:   { fontWeight: 700, fontSize: 18, marginBottom: 8 },
  errS:   { color: "#5c7a72", fontSize: 14 },
  footer: { textAlign: "center" as const, marginTop: 40, fontSize: 12, color: "#5c7a72" },
};

type ErrorCode = "TOKEN_EXPIRED" | "TOKEN_REVOKED" | "INVALID_TOKEN" | "NO_RESULT" | "NETWORK";

function ErrorScreen({ code }: { code: ErrorCode }) {
  const info: Record<ErrorCode, { icon: string; title: string; desc: string }> = {
    TOKEN_EXPIRED: { icon: "⏰", title: "Bağlantı Süresi Doldu", desc: "Bu paylaşım bağlantısı artık geçerli değil. Yeni bir bağlantı isteyin." },
    TOKEN_REVOKED: { icon: "🚫", title: "Bağlantı İptal Edildi", desc: "Bu paylaşım bağlantısı ihracatçı tarafından iptal edilmiş." },
    INVALID_TOKEN: { icon: "🔒", title: "Geçersiz Bağlantı", desc: "Bu bağlantı tanınamadı veya bozulmuş olabilir." },
    NO_RESULT:     { icon: "📄", title: "Sonuç Bulunamadı", desc: "Paylaşılan dönem için hesaplanmış emisyon sonucu yok." },
    NETWORK:       { icon: "📡", title: "Bağlantı Hatası", desc: "Sunucuya ulaşılamadı. Lütfen daha sonra tekrar deneyin." },
  };
  const { icon, title, desc } = info[code] ?? info.INVALID_TOKEN;
  return (
    <div style={s.errBox}>
      <div style={s.errCard}>
        <div style={s.errIcon}>{icon}</div>
        <div style={s.errT}>{title}</div>
        <div style={s.errS}>{desc}</div>
        <div style={{ marginTop: 24, fontSize: 12, color: "#5c7a72" }}>Voltfox GreenLink Platform</div>
      </div>
    </div>
  );
}

export default function SharePage() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<ShareViewResult | null>(null);
  const [errCode, setErrCode] = useState<ErrorCode | null>(null);

  useEffect(() => {
    if (!token) { setErrCode("INVALID_TOKEN"); return; }
    api.share.get(token)
      .then(setData)
      .catch((e: { status?: number; body?: { error?: string } }) => {
        const code = e.body?.error as ErrorCode | undefined;
        if (code === "TOKEN_EXPIRED" || code === "TOKEN_REVOKED") setErrCode(code);
        else if (e.status === 401 || e.status === 410) setErrCode("INVALID_TOKEN");
        else if (e.status === 404) setErrCode("NO_RESULT");
        else setErrCode("NETWORK");
      });
  }, [token]);

  if (errCode) return <ErrorScreen code={errCode} />;

  if (!data) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#5c7a72" }}>
        Yükleniyor...
      </div>
    );
  }

  const { result } = data;
  const { period }  = result;
  const expiresAt   = new Date(data.payload.exp * 1000).toLocaleDateString("tr-TR");

  return (
    <>
      <nav style={s.nav}>
        <span style={s.brand}>Voltfox</span>
        <span style={s.badge}>Salt Okunur Görünüm</span>
      </nav>

      <div style={s.page}>
        <div style={s.banner}>
          <span>📨</span>
          <span>
            Bu belge <strong>{period.installation.facilityName}</strong> tesisi tarafından paylaşılmıştır.
            Bağlantı <strong>{expiresAt}</strong> tarihine kadar geçerlidir.
          </span>
        </div>

        <div style={s.h1}>{period.periodName} — CBAM Gömülü Emisyon Teknik Dosyası</div>
        <div style={s.sub}>
          {new Date(period.startDate).toLocaleDateString("tr-TR")} –{" "}
          {new Date(period.endDate).toLocaleDateString("tr-TR")} ·
          CN: {period.cnCode} · {period.importCountry}
        </div>

        <div style={s.grid}>
          <div style={s.kpi}>
            <div style={s.kpiL}>SEE Baseline</div>
            <div style={s.kpiV}>{result.seeBaseline.toFixed(4)}<span style={{ fontSize: 12, color: "#5c7a72", fontWeight: 400 }}> tCO₂e/t</span></div>
          </div>
          <div style={s.kpi}>
            <div style={s.kpiL}>SEE (24/7 CFE ile)</div>
            <div style={{ ...s.kpiV, ...s.kpiG }}>{result.seeVoltfox.toFixed(4)}<span style={{ fontSize: 12, color: "#059669", fontWeight: 400 }}> tCO₂e/t</span></div>
          </div>
          <div style={s.kpi}>
            <div style={s.kpiL}>Scope 2 Azaltım</div>
            <div style={{ ...s.kpiV, ...s.kpiG }}>{result.reductionPct.toFixed(1)}%</div>
          </div>
        </div>

        <div style={s.section}>Scope 2 Karşılaştırması</div>
        <div style={s.card}>
          <div style={s.row}><span style={s.rowL}>Baseline (şebeke ort.)</span><span style={s.rowV}>{result.scope2BaselineTco2.toFixed(2)} tCO₂</span></div>
          <div style={s.row}><span style={s.rowL}>24/7 CFE Eşleştirme ile</span><span style={{ ...s.rowV, color: "#059669" }}>{result.scope2VoltfoxTco2.toFixed(2)} tCO₂</span></div>
          <div style={{ ...s.row, borderBottom: "none" }}><span style={s.rowL}>Azaltım</span><span style={{ ...s.rowV, color: "#059669" }}>{result.reductionTco2.toFixed(2)} tCO₂ (%{result.reductionPct.toFixed(1)})</span></div>
        </div>

        {result.defaultSee !== null && (
          <>
            <div style={s.section}>AB Default Değer Karşılaştırması</div>
            <div style={s.card}>
              <div style={s.row}><span style={s.rowL}>AB Default SEE (Ek-IV)</span><span style={s.rowV}>{result.defaultSee.toFixed(4)} tCO₂e/t</span></div>
              <div style={s.row}><span style={s.rowL}>Gerçek SEE (Voltfox)</span><span style={{ ...s.rowV, color: "#059669" }}>{result.seeVoltfox.toFixed(4)} tCO₂e/t</span></div>
              {result.savingsVsDefaultEur !== null && (
                <div style={{ ...s.row, borderBottom: "none" }}>
                  <span style={s.rowL}>Yıllık CBAM Tasarruf Potansiyeli</span>
                  <span style={{ ...s.rowV, color: "#059669" }}>€{result.savingsVsDefaultEur.toLocaleString("tr-TR", { maximumFractionDigits: 0 })}</span>
                </div>
              )}
            </div>
          </>
        )}

        <div style={s.section}>Dönem & Tesis Bilgileri</div>
        <div style={s.card}>
          <div style={s.row}><span style={s.rowL}>Tesis</span><span style={s.rowV}>{period.installation.facilityName}</span></div>
          <div style={s.row}><span style={s.rowL}>Operatör</span><span style={s.rowV}>{period.installation.operator}</span></div>
          <div style={s.row}><span style={s.rowL}>Üretim Hacmi</span><span style={s.rowV}>{period.prodVolumeTonne.toLocaleString()} tonne</span></div>
          <div style={s.row}><span style={s.rowL}>Elektrik Tüketimi</span><span style={s.rowV}>{(period.electricityKwh / 1000).toLocaleString()} MWh</span></div>
          <div style={{ ...s.row, borderBottom: "none" }}><span style={s.rowL}>Scope 1 (direkt)</span><span style={s.rowV}>{period.scope1DirectTco2.toFixed(2)} tCO₂</span></div>
        </div>

        <div style={s.section}>Hesap Bilgileri</div>
        <div style={s.card}>
          <div style={s.row}><span style={s.rowL}>Hesap Motoru</span><span style={s.rowV}>Voltfox v{result.calcEngineVersion}</span></div>
          <div style={s.row}><span style={s.rowL}>EF Veri Versiyonu</span><span style={s.rowV}>{result.efDataVersion}</span></div>
          <div style={s.row}><span style={s.rowL}>Metodoloji</span><span style={s.rowV}>EU 2023/1773 Ek-IV Method A</span></div>
          <div style={{ ...s.row, borderBottom: "none" }}><span style={s.rowL}>Hesaplama Tarihi</span><span style={s.rowV}>{new Date(result.calculatedAt).toLocaleDateString("tr-TR")}</span></div>
        </div>

        <div style={s.footer}>
          Voltfox GreenLink Platform · EU 2023/1773 Annex IV uyumlu · voltfox.io
        </div>
      </div>
    </>
  );
}
