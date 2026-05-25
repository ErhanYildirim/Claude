import { useState } from "react";

/* ── Types ──────────────────────────────────────────────────────────────── */
type CertType = "I-REC" | "EAC" | "GO" | "T-REC" | "IREC-E";
type Technology = "Güneş" | "Rüzgar (Kara)" | "Rüzgar (Deniz)" | "Hidroelektrik" | "Biyokütle" | "Jeotermal" | "Diğer";

interface GreenCertificate {
  id: string;
  certType: CertType;
  certId: string;
  issuer: string;
  technology: Technology;
  country: string;
  volumeMwh: number;
  validFrom: string;
  validTo: string;
  status: "Aktif" | "İptal" | "Kullanıldı";
  addedAt: string;
}

type ReSource = "EPIAŞ" | "Manuel";
interface ReProductionRecord {
  id: string;
  source: ReSource;
  plantName: string;
  technology: Technology;
  date: string;
  volumeMwh: number;
  country: string;
  addedAt: string;
}

/* ── Styles ─────────────────────────────────────────────────────────────── */
const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:    { fontSize: 14, color: "#5c7a72", marginBottom: 0 },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 20 },
  table:  { width: "100%", borderCollapse: "collapse" as const },
  th:     { textAlign: "left" as const, fontSize: 11, color: "#5c7a72", fontWeight: 700,
            textTransform: "uppercase" as const, letterSpacing: ".05em",
            padding: "10px 14px", borderBottom: "1px solid #d4ece4" },
  td:     { padding: "12px 14px", fontSize: 13, color: "#1a3530", borderBottom: "1px solid #eef7f3" },
  btn:    { padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 14, background: "#00b87a", color: "#fff" },
  btnSm:  { padding: "6px 14px", borderRadius: 7, border: "1px solid #d4ece4",
            cursor: "pointer", fontSize: 12, background: "#fff", color: "#1a3530" },
  btnDanger: { padding: "6px 14px", borderRadius: 7, border: "1px solid #fca5a5",
               cursor: "pointer", fontSize: 12, background: "#fff", color: "#dc2626" },
  label:  { display: "block", fontSize: 12, fontWeight: 600, color: "#5c7a72",
            textTransform: "uppercase" as const, letterSpacing: ".05em", marginBottom: 6 },
  input:  { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
            fontSize: 13, color: "#0a1f1a", background: "#fff", boxSizing: "border-box" as const },
  select: { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
            fontSize: 13, color: "#0a1f1a", background: "#fff", boxSizing: "border-box" as const },
};

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
  display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
};

const modal: React.CSSProperties = {
  background: "#fff", borderRadius: 14, padding: "28px 32px",
  width: 520, boxShadow: "0 20px 60px rgba(0,0,0,.2)", maxHeight: "90vh", overflowY: "auto",
};

const CERT_TYPES: CertType[]   = ["I-REC", "EAC", "GO", "T-REC", "IREC-E"];
const TECHNOLOGIES: Technology[] = ["Güneş", "Rüzgar (Kara)", "Rüzgar (Deniz)", "Hidroelektrik", "Biyokütle", "Jeotermal", "Diğer"];

function certTypeBadge(t: CertType) {
  const colors: Record<CertType, { bg: string; fg: string }> = {
    "I-REC":   { bg: "#dcfce7", fg: "#15803d" },
    "EAC":     { bg: "#dbeafe", fg: "#1d4ed8" },
    "GO":      { bg: "#fef9c3", fg: "#a16207" },
    "T-REC":   { bg: "#f3e8ff", fg: "#7c3aed" },
    "IREC-E":  { bg: "#e0f2fe", fg: "#0369a1" },
  };
  const c = colors[t] ?? { bg: "#f4fbf8", fg: "#009966" };
  return (
    <span style={{ background: c.bg, color: c.fg, borderRadius: 4, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>
      {t}
    </span>
  );
}

function statusBadge(s: GreenCertificate["status"]) {
  const map = {
    "Aktif":     { bg: "#dcfce7", fg: "#15803d" },
    "İptal":     { bg: "#fee2e2", fg: "#dc2626" },
    "Kullanıldı":{ bg: "#f1f5f9", fg: "#64748b" },
  };
  const c = map[s];
  return <span style={{ background: c.bg, color: c.fg, borderRadius: 4, padding: "2px 9px", fontSize: 11, fontWeight: 700 }}>{s}</span>;
}

/* ── KPI helper ─────────────────────────────────────────────────────────── */
function Kpi({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid #d4ece4", borderRadius: 10, padding: "16px 20px" }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 800, color: "#0a1f1a", lineHeight: 1 }}>{value}</div>
      {unit && <div style={{ fontSize: 11, color: "#5c7a72", marginTop: 4 }}>{unit}</div>}
    </div>
  );
}

/* ── Sertifikalar Tab ───────────────────────────────────────────────────── */
function CertificatesTab() {
  const [certs,    setCerts]    = useState<GreenCertificate[]>([]);
  const [showAdd,  setShowAdd]  = useState(false);
  const [form, setForm] = useState({
    certType: "I-REC" as CertType,
    certId: "", issuer: "", technology: "Rüzgar (Kara)" as Technology,
    country: "Türkiye", volumeMwh: "", validFrom: "", validTo: "",
  });

  function handleAdd() {
    if (!form.certId.trim() || !form.volumeMwh) return;
    const cert: GreenCertificate = {
      id: Date.now().toString(),
      certType: form.certType,
      certId: form.certId.trim(),
      issuer: form.issuer.trim() || "-",
      technology: form.technology,
      country: form.country.trim() || "Türkiye",
      volumeMwh: parseFloat(form.volumeMwh) || 0,
      validFrom: form.validFrom,
      validTo: form.validTo,
      status: "Aktif",
      addedAt: new Date().toISOString(),
    };
    setCerts(prev => [...prev, cert]);
    setShowAdd(false);
    setForm({ certType: "I-REC", certId: "", issuer: "", technology: "Rüzgar (Kara)", country: "Türkiye", volumeMwh: "", validFrom: "", validTo: "" });
  }

  function handleDelete(id: string) {
    if (!window.confirm("Bu sertifikayı kaldırmak istediğinize emin misiniz?")) return;
    setCerts(prev => prev.filter(c => c.id !== id));
  }

  const totalMwh    = certs.filter(c => c.status === "Aktif").reduce((s, c) => s + c.volumeMwh, 0);
  const byTech      = certs.reduce<Record<string, number>>((acc, c) => {
    acc[c.technology] = (acc[c.technology] ?? 0) + c.volumeMwh; return acc;
  }, {});
  const topTech     = Object.entries(byTech).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "-";

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <Kpi label="Aktif Sertifika" value={certs.filter(c => c.status === "Aktif").length} unit="adet" />
        <Kpi label="Toplam Hacim" value={totalMwh.toLocaleString("tr-TR")} unit="MWh" />
        <Kpi label="Önde Gelen Teknoloji" value={topTech} />
      </div>

      {/* Header row */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 14 }}>
        <button style={s.btn} onClick={() => setShowAdd(true)}>+ Sertifika Ekle</button>
      </div>

      <div style={s.card}>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Tür</th>
              <th style={s.th}>Sertifika No</th>
              <th style={s.th}>İhraçcı</th>
              <th style={s.th}>Teknoloji</th>
              <th style={s.th}>Ülke</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Hacim (MWh)</th>
              <th style={s.th}>Geçerlilik</th>
              <th style={s.th}>Durum</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {certs.length === 0 ? (
              <tr>
                <td colSpan={9} style={{ ...s.td, textAlign: "center", color: "#5c7a72", padding: "48px" }}>
                  Henüz sertifika eklenmemiş. I-REC, EAC veya GO sertifikanızı kayıt edin.
                </td>
              </tr>
            ) : certs.map(cert => (
              <tr key={cert.id}>
                <td style={s.td}>{certTypeBadge(cert.certType)}</td>
                <td style={{ ...s.td, fontFamily: "monospace", fontSize: 12 }}>{cert.certId}</td>
                <td style={s.td}>{cert.issuer}</td>
                <td style={s.td}>{cert.technology}</td>
                <td style={s.td}>{cert.country}</td>
                <td style={{ ...s.td, textAlign: "right" as const, fontWeight: 600 }}>
                  {cert.volumeMwh.toLocaleString("tr-TR")}
                </td>
                <td style={{ ...s.td, fontSize: 12, color: "#5c7a72" }}>
                  {cert.validFrom} → {cert.validTo}
                </td>
                <td style={s.td}>{statusBadge(cert.status)}</td>
                <td style={s.td}>
                  <button style={s.btnDanger} onClick={() => handleDelete(cert.id)}>Kaldır</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={modal}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0a1f1a", marginBottom: 24 }}>Sertifika Ekle</h2>
            <div style={{ display: "grid", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Sertifika Türü</label>
                  <select style={s.select} value={form.certType}
                    onChange={e => setForm(f => ({ ...f, certType: e.target.value as CertType }))}>
                    {CERT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Sertifika No / Ref *</label>
                  <input style={s.input} value={form.certId}
                    onChange={e => setForm(f => ({ ...f, certId: e.target.value }))}
                    placeholder="örn. IREC-TR-2024-00001" />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>İhraçcı Kurum</label>
                  <input style={s.input} value={form.issuer}
                    onChange={e => setForm(f => ({ ...f, issuer: e.target.value }))}
                    placeholder="örn. APX Group, RECS Int'l" />
                </div>
                <div>
                  <label style={s.label}>Ülke</label>
                  <input style={s.input} value={form.country}
                    onChange={e => setForm(f => ({ ...f, country: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Teknoloji</label>
                  <select style={s.select} value={form.technology}
                    onChange={e => setForm(f => ({ ...f, technology: e.target.value as Technology }))}>
                    {TECHNOLOGIES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label style={s.label}>Hacim (MWh) *</label>
                  <input style={s.input} type="number" min="0" step="any" value={form.volumeMwh}
                    onChange={e => setForm(f => ({ ...f, volumeMwh: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Geçerlilik Başlangıç</label>
                  <input style={s.input} type="date" value={form.validFrom}
                    onChange={e => setForm(f => ({ ...f, validFrom: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>Geçerlilik Bitiş</label>
                  <input style={s.input} type="date" value={form.validTo}
                    onChange={e => setForm(f => ({ ...f, validTo: e.target.value }))} />
                </div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "flex-end" }}>
              <button style={{ ...s.btnSm, padding: "10px 20px" }} onClick={() => setShowAdd(false)}>İptal</button>
              <button
                style={{ ...s.btn, opacity: !form.certId.trim() || !form.volumeMwh ? 0.6 : 1 }}
                disabled={!form.certId.trim() || !form.volumeMwh}
                onClick={handleAdd}
              >
                Sertifika Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Üretim Verileri Tab ─────────────────────────────────────────────────── */
function ProductionTab() {
  const [records,     setRecords]     = useState<ReProductionRecord[]>([]);
  const [sourceTab,   setSourceTab]   = useState<"epias" | "manuel">("epias");
  const [epias, setEpias] = useState({
    token: "", plantCode: "", startDate: "", endDate: "",
  });
  const [fetching,    setFetching]    = useState(false);
  const [epiasMsg,    setEpiasMsg]    = useState("");
  const [manualForm, setManualForm]   = useState({
    plantName: "", technology: "Rüzgar (Kara)" as Technology,
    country: "Türkiye", date: "", volumeMwh: "",
  });

  async function handleEpiasFetch() {
    if (!epias.startDate || !epias.endDate || !epias.plantCode.trim()) {
      setEpiasMsg("Santral kodu ve tarih aralığı zorunludur.");
      return;
    }
    setFetching(true);
    setEpiasMsg("");
    try {
      // Proxy endpoint — backend henüz geliştirilme aşamasında
      const res = await fetch("/api/v1/cfe/epias/generation", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plantCode: epias.plantCode, startDate: epias.startDate, endDate: epias.endDate, token: epias.token }),
      });
      if (!res.ok) throw new Error("API Hatası");
      const data = await res.json() as { records: Array<{ date: string; volumeMwh: number; technology: string }> };
      const newRecords: ReProductionRecord[] = data.records.map(r => ({
        id: Date.now().toString() + Math.random(),
        source: "EPIAŞ",
        plantName: epias.plantCode,
        technology: (r.technology as Technology) ?? "Diğer",
        date: r.date,
        volumeMwh: r.volumeMwh,
        country: "Türkiye",
        addedAt: new Date().toISOString(),
      }));
      setRecords(prev => [...prev, ...newRecords]);
      setEpiasMsg(`${newRecords.length} kayıt başarıyla içe aktarıldı.`);
    } catch {
      setEpiasMsg("EPIAŞ entegrasyonu geliştirme aşamasındadır. Manuel giriş sekmesini kullanabilirsiniz.");
    } finally {
      setFetching(false);
    }
  }

  function handleManualAdd() {
    if (!manualForm.plantName.trim() || !manualForm.date || !manualForm.volumeMwh) return;
    const rec: ReProductionRecord = {
      id: Date.now().toString(),
      source: "Manuel",
      plantName: manualForm.plantName.trim(),
      technology: manualForm.technology,
      date: manualForm.date,
      volumeMwh: parseFloat(manualForm.volumeMwh) || 0,
      country: manualForm.country.trim() || "Türkiye",
      addedAt: new Date().toISOString(),
    };
    setRecords(prev => [...prev, rec]);
    setManualForm(f => ({ ...f, plantName: "", date: "", volumeMwh: "" }));
  }

  const totalMwh = records.reduce((s, r) => s + r.volumeMwh, 0);

  return (
    <div>
      {/* KPI row */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 }}>
        <Kpi label="Toplam Kayıt" value={records.length} unit="adet" />
        <Kpi label="Toplam Üretim" value={totalMwh.toLocaleString("tr-TR")} unit="MWh" />
        <Kpi label="Kaynak Dağılımı" value={
          [
            records.filter(r => r.source === "EPIAŞ").length > 0 ? "EPIAŞ" : null,
            records.filter(r => r.source === "Manuel").length > 0 ? "Manuel" : null,
          ].filter(Boolean).join(" + ") || "-"
        } />
      </div>

      {/* Source sub-tabs */}
      <div style={{
        display: "flex", borderBottom: "2px solid #d4ece4", marginBottom: 24, gap: 0,
      }}>
        {(["epias", "manuel"] as const).map(tab => (
          <button key={tab}
            onClick={() => setSourceTab(tab)}
            style={{
              padding: "10px 22px", border: "none", cursor: "pointer", fontWeight: 600,
              fontSize: 13, background: "transparent",
              color: sourceTab === tab ? "#00b87a" : "#5c7a72",
              borderBottom: sourceTab === tab ? "2px solid #00b87a" : "2px solid transparent",
              marginBottom: -2,
            }}
          >
            {tab === "epias" ? "EPIAŞ Şeffaflık Platformu" : "Manuel Giriş"}
          </button>
        ))}
      </div>

      {/* EPIAŞ source */}
      {sourceTab === "epias" && (
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 }}>
            EPIAŞ Şeffaflık Platformu Entegrasyonu
          </div>
          <div style={{ fontSize: 12, color: "#5c7a72", marginBottom: 20 }}>
            Santral kodunuzu girin, tarih aralığını seçin. Veriler EPİAŞ API'sinden proxy üzerinden çekilir.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={s.label}>Santral Kodu / ETKB No</label>
              <input style={s.input} value={epias.plantCode}
                onChange={e => setEpias(f => ({ ...f, plantCode: e.target.value }))}
                placeholder="örn. TR-2024-001" />
            </div>
            <div>
              <label style={s.label}>Başlangıç</label>
              <input style={s.input} type="date" value={epias.startDate}
                onChange={e => setEpias(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Bitiş</label>
              <input style={s.input} type="date" value={epias.endDate}
                onChange={e => setEpias(f => ({ ...f, endDate: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>API Token (opsiyonel)</label>
              <input style={s.input} type="password" value={epias.token}
                onChange={e => setEpias(f => ({ ...f, token: e.target.value }))}
                placeholder="EPIAŞ hesap token" />
            </div>
            <div>
              <button
                style={{ ...s.btn, opacity: fetching ? 0.7 : 1 }}
                disabled={fetching}
                onClick={handleEpiasFetch}
              >
                {fetching ? "Çekiliyor..." : "Veri Çek"}
              </button>
            </div>
          </div>
          {epiasMsg && (
            <div style={{
              marginTop: 16, padding: "10px 16px", borderRadius: 8, fontSize: 13,
              background: epiasMsg.includes("aşamasında") ? "#fef9c3" : "#dcfce7",
              color: epiasMsg.includes("aşamasında") ? "#92400e" : "#15803d",
              border: `1px solid ${epiasMsg.includes("aşamasında") ? "#fde68a" : "#86efac"}`,
            }}>
              {epiasMsg}
            </div>
          )}
          <div style={{
            marginTop: 16, background: "#f4fbf8", borderRadius: 8, padding: "12px 16px",
            fontSize: 12, color: "#5c7a72", lineHeight: 1.7,
          }}>
            <strong>Not:</strong> EPIAŞ Şeffaflık Platformu entegrasyonu gerçek zamanlı üretim verilerini doğrudan çekmenizi sağlar.
            Entegrasyon geliştirme aşamasındadır — aktif olduğunda tarihsel saatlik üretim verileri otomatik olarak senkronize edilecektir.
            Şimdilik <strong>Manuel Giriş</strong> sekmesinden verileri ekleyebilirsiniz.
          </div>
        </div>
      )}

      {/* Manuel source */}
      {sourceTab === "manuel" && (
        <div style={s.card}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "#0a1f1a", marginBottom: 16 }}>
            Manuel Üretim Verisi Girişi
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr 1fr 1fr 1fr auto", gap: 12, alignItems: "flex-end" }}>
            <div>
              <label style={s.label}>Santral / Kaynak Adı *</label>
              <input style={s.input} value={manualForm.plantName}
                onChange={e => setManualForm(f => ({ ...f, plantName: e.target.value }))}
                placeholder="örn. Ankara RES-1" />
            </div>
            <div>
              <label style={s.label}>Teknoloji</label>
              <select style={s.select} value={manualForm.technology}
                onChange={e => setManualForm(f => ({ ...f, technology: e.target.value as Technology }))}>
                {TECHNOLOGIES.map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={s.label}>Ülke</label>
              <input style={s.input} value={manualForm.country}
                onChange={e => setManualForm(f => ({ ...f, country: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Tarih *</label>
              <input style={s.input} type="date" value={manualForm.date}
                onChange={e => setManualForm(f => ({ ...f, date: e.target.value }))} />
            </div>
            <div>
              <label style={s.label}>Hacim (MWh) *</label>
              <input style={s.input} type="number" min="0" step="any" value={manualForm.volumeMwh}
                onChange={e => setManualForm(f => ({ ...f, volumeMwh: e.target.value }))} />
            </div>
            <div>
              <button
                style={{ ...s.btn, opacity: !manualForm.plantName.trim() || !manualForm.date || !manualForm.volumeMwh ? 0.6 : 1 }}
                disabled={!manualForm.plantName.trim() || !manualForm.date || !manualForm.volumeMwh}
                onClick={handleManualAdd}
              >
                Ekle
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Records table */}
      <div style={s.card}>
        <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 14 }}>
          Üretim Kayıtları
        </div>
        <table style={s.table}>
          <thead>
            <tr>
              <th style={s.th}>Santral</th>
              <th style={s.th}>Teknoloji</th>
              <th style={s.th}>Ülke</th>
              <th style={s.th}>Tarih</th>
              <th style={{ ...s.th, textAlign: "right" as const }}>Üretim (MWh)</th>
              <th style={s.th}>Kaynak</th>
              <th style={s.th}></th>
            </tr>
          </thead>
          <tbody>
            {records.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ ...s.td, textAlign: "center", color: "#5c7a72", padding: "48px" }}>
                  Henüz üretim verisi eklenmemiş.
                </td>
              </tr>
            ) : [...records].reverse().map(rec => (
              <tr key={rec.id}>
                <td style={{ ...s.td, fontWeight: 600 }}>{rec.plantName}</td>
                <td style={s.td}>{rec.technology}</td>
                <td style={s.td}>{rec.country}</td>
                <td style={{ ...s.td, fontSize: 12 }}>{rec.date}</td>
                <td style={{ ...s.td, textAlign: "right" as const, fontWeight: 600 }}>
                  {rec.volumeMwh.toLocaleString("tr-TR")}
                </td>
                <td style={s.td}>
                  <span style={{
                    background: rec.source === "EPIAŞ" ? "#dbeafe" : "#f3e8ff",
                    color: rec.source === "EPIAŞ" ? "#1d4ed8" : "#7c3aed",
                    borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700,
                  }}>
                    {rec.source}
                  </span>
                </td>
                <td style={s.td}>
                  <button style={s.btnDanger}
                    onClick={() => setRecords(prev => prev.filter(r => r.id !== rec.id))}>
                    Kaldır
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Main Page ───────────────────────────────────────────────────────────── */
export default function CfeGreenAssetsPage() {
  const [tab, setTab] = useState<"certificates" | "production">("certificates");

  return (
    <div style={s.page}>
      <div style={{ marginBottom: 28 }}>
        <h1 style={s.h1}>Green Assets</h1>
        <p style={s.sub}>Yenilenebilir enerji sertifikaları ve üretim verisi yönetimi</p>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", borderBottom: "2px solid #d4ece4", marginBottom: 28, gap: 0,
      }}>
        {([
          { id: "certificates", label: "🏅 Sertifikalar" },
          { id: "production",   label: "⚡ Üretim Verileri" },
        ] as const).map(t => (
          <button key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "11px 24px", border: "none", cursor: "pointer", fontWeight: 600,
              fontSize: 13, background: "transparent",
              color: tab === t.id ? "#00b87a" : "#5c7a72",
              borderBottom: tab === t.id ? "2px solid #00b87a" : "2px solid transparent",
              marginBottom: -2, transition: "color .15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "certificates" && <CertificatesTab />}
      {tab === "production"   && <ProductionTab />}
    </div>
  );
}
