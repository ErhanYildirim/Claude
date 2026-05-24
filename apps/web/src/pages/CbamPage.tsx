import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { CbamFacility, CreateCbamFacilityBody } from "../lib/api.js";

const SECTOR_LABELS: Record<string, string> = {
  steel:       "Çelik",
  aluminium:   "Alüminyum",
  cement:      "Çimento",
  fertilizer:  "Gübre",
  electricity: "Elektrik",
  hydrogen:    "Hidrojen",
  other:       "Diğer",
};

const SECTOR_COLORS: Record<string, string> = {
  steel:       "#6366f1",
  aluminium:   "#06b6d4",
  cement:      "#f59e0b",
  fertilizer:  "#10b981",
  electricity: "#3b82f6",
  hydrogen:    "#8b5cf6",
  other:       "#6b7280",
};

const s: Record<string, React.CSSProperties> = {
  page:   { maxWidth: 1020, margin: "0 auto", padding: "32px 28px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:    { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  kpiRow: { display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 14, marginBottom: 24 },
  kpi:    { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "16px 18px" },
  kpiL:   { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  kpiV:   { fontSize: 22, fontWeight: 700, color: "#0a1f1a" },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#00b87a", color: "#fff",
            border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600,
            cursor: "pointer", marginBottom: 20 },
  grid:   { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))", gap: 16 },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px",
            position: "relative" as const },
  cardT:  { fontWeight: 600, fontSize: 15, color: "#0a1f1a", marginBottom: 2 },
  cardS:  { fontSize: 13, color: "#5c7a72", marginBottom: 10 },
  badge:  { display: "inline-block", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600 },
  actRow: { display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap" as const },
  modal:  { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.4)", display: "flex",
            alignItems: "center", justifyContent: "center", zIndex: 100 },
  mCard:  { background: "#fff", borderRadius: 12, padding: "32px", width: 460,
            maxHeight: "90vh", overflowY: "auto" as const, boxShadow: "0 8px 32px rgba(0,0,0,.15)" },
  mTitle: { fontSize: 17, fontWeight: 700, marginBottom: 20 },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#1a3530", marginBottom: 5 },
  input:  { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB",
            fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box" as const, background: "#fff" },
  row:    { display: "flex", gap: 10 },
  btn:    { flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnP:   { background: "#00b87a", color: "#fff" },
  btnS:   { background: "#eef7f3", color: "#1a3530" },
  err:    { color: "#DC2626", fontSize: 13, marginBottom: 12 },
  empty:  { textAlign: "center" as const, padding: "60px 0", color: "#5c7a72" },
};

const EMPTY_FORM: CreateCbamFacilityBody & { unLoCode: string; cbamInstallationId: string } = {
  facilityName: "", operator: "", facilityCountry: "TR", facilityRef: "",
  sector: "steel", unLoCode: "", cbamInstallationId: "",
};

export default function CbamPage() {
  const [facilities,    setFacilities]   = useState<CbamFacility[]>([]);
  const [loading,       setLoading]      = useState(true);
  const [showModal,     setShowModal]    = useState(false);
  const [editingFac,    setEditingFac]   = useState<CbamFacility | null>(null);
  const [form,          setForm]         = useState({ ...EMPTY_FORM });
  const [saving,        setSaving]       = useState(false);
  const [error,         setError]        = useState("");
  const [myRole,        setMyRole]       = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.cbamFacilities.list()
      .then(r => setFacilities(r.facilities))
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    load();
    api.members.me().then(r => setMyRole(r.role)).catch(() => {});
  }, []);

  function openCreate() {
    setEditingFac(null);
    setForm({ ...EMPTY_FORM });
    setError("");
    setShowModal(true);
  }

  function openEdit(e: React.MouseEvent, fac: CbamFacility) {
    e.preventDefault(); e.stopPropagation();
    setEditingFac(fac);
    setForm({
      facilityName:       fac.facilityName,
      operator:           fac.operator,
      facilityCountry:    fac.facilityCountry,
      facilityRef:        fac.facilityRef ?? "",
      sector:             fac.sector,
      unLoCode:           fac.unLoCode ?? "",
      cbamInstallationId: fac.cbamInstallationId ?? "",
    });
    setError("");
    setShowModal(true);
  }

  async function saveFacility(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const body: CreateCbamFacilityBody = {
        facilityName:       form.facilityName,
        operator:           form.operator,
        facilityCountry:    form.facilityCountry,
        facilityRef:        form.facilityRef || undefined,
        sector:             form.sector,
        unLoCode:           form.unLoCode || undefined,
        cbamInstallationId: form.cbamInstallationId || undefined,
      };
      if (editingFac) {
        const r = await api.cbamFacilities.update(editingFac.id, body);
        setFacilities(prev => prev.map(f => f.id === editingFac.id ? { ...f, ...r.facility } : f));
      } else {
        const r = await api.cbamFacilities.create(body);
        setFacilities(prev => [...prev, { ...r.facility, products: [] }]);
      }
      setShowModal(false);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Hata oluştu");
    }
    setSaving(false);
  }

  async function deleteFacility(e: React.MouseEvent, fac: CbamFacility) {
    e.preventDefault(); e.stopPropagation();
    if (fac.products.length > 0) {
      alert(`Bu tesise bağlı ${fac.products.length} ürün var. Önce ürünleri silin.`);
      return;
    }
    if (!confirm(`"${fac.facilityName}" tesisini silmek istediğinizden emin misiniz?`)) return;
    try {
      await api.cbamFacilities.delete(fac.id);
      setFacilities(prev => prev.filter(f => f.id !== fac.id));
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Silme hatası");
    }
  }

  const totalProducts = facilities.reduce((s, f) => s + f.products.length, 0);
  const totalPeriods  = facilities.reduce((s, f) =>
    s + f.products.reduce((ps, p) => ps + p.productPeriods.length, 0), 0);
  const canEdit = ["owner", "admin", "analyst"].includes(myRole ?? "");

  return (
    <>
      <div style={s.page}>
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 4 }}>
          <div style={s.h1}>CBAM Tesisleri</div>
          <Link
            to="/cbam/wizard"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#00b87a",
                     color: "#fff", borderRadius: 8, padding: "9px 18px", fontSize: 14, fontWeight: 700,
                     textDecoration: "none", flexShrink: 0 }}
          >
            🧮 Hesap Sihirbazı
          </Link>
        </div>
        <div style={s.sub}>
          CBAM kapsamındaki üretim tesisleri ve ürün emisyon hesapları — diğer modüllerden tamamen izole
        </div>

        <div style={s.kpiRow}>
          <div style={s.kpi}><div style={s.kpiL}>Toplam CBAM Tesis</div><div style={s.kpiV}>{facilities.length}</div></div>
          <div style={s.kpi}><div style={s.kpiL}>Toplam Ürün</div><div style={s.kpiV}>{totalProducts}</div></div>
          <div style={s.kpi}><div style={s.kpiL}>Toplam Dönem</div><div style={s.kpiV}>{totalPeriods}</div></div>
        </div>

        {canEdit && (
          <button style={s.addBtn} onClick={openCreate}>+ Yeni CBAM Tesis</button>
        )}

        {loading ? (
          <div style={s.empty}>Yükleniyor...</div>
        ) : facilities.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏭</div>
            <div style={{ fontWeight: 600, marginBottom: 6 }}>Henüz CBAM tesisi eklenmemiş</div>
            <div style={{ fontSize: 13 }}>
              CBAM kapsamında ithal edilen ürünlerin üretim tesislerini buraya ekleyin.
            </div>
          </div>
        ) : (
          <div style={s.grid}>
            {facilities.map(fac => {
              const sectorColor = SECTOR_COLORS[fac.sector] ?? "#6b7280";
              const sectorLabel = SECTOR_LABELS[fac.sector] ?? fac.sector;
              const calculatedCount = fac.products.reduce(
                (n, p) => n + p.productPeriods.filter(pp => pp.calculatedAt).length, 0
              );
              return (
                <div key={fac.id} style={s.card}>
                  {/* Header */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                    <div>
                      <div style={s.cardT}>{fac.facilityName}</div>
                      <div style={s.cardS}>{fac.operator || "—"} · {fac.facilityCountry}</div>
                    </div>
                    <span style={{ ...s.badge, background: sectorColor + "20", color: sectorColor }}>
                      {sectorLabel}
                    </span>
                  </div>

                  {/* Meta tags */}
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
                    <span style={{ ...s.badge, background: "#e6f9f2", color: "#009966" }}>
                      {fac.products.length} ürün
                    </span>
                    {calculatedCount > 0 && (
                      <span style={{ ...s.badge, background: "#dbeafe", color: "#1e40af" }}>
                        {calculatedCount} hesaplı dönem
                      </span>
                    )}
                    {fac.unLoCode && (
                      <span style={{ ...s.badge, background: "#f3f4f6", color: "#374151" }}>
                        {fac.unLoCode}
                      </span>
                    )}
                    {fac.cbamInstallationId && (
                      <span style={{ ...s.badge, background: "#fef3c7", color: "#92400e", fontSize: 11 }}>
                        Portal ID: {fac.cbamInstallationId}
                      </span>
                    )}
                  </div>

                  {/* Product list */}
                  {fac.products.length > 0 && (
                    <div style={{ marginBottom: 10 }}>
                      {fac.products.map(p => (
                        <Link
                          key={p.id}
                          to={`/cbam/facilities/${fac.id}/products/${p.id}`}
                          style={{
                            display: "flex", justifyContent: "space-between", alignItems: "center",
                            padding: "6px 10px", borderRadius: 6, marginBottom: 4,
                            background: "#f9fdfb", border: "1px solid #eef7f3",
                            textDecoration: "none", color: "#0a1f1a",
                            fontSize: 13,
                          }}
                        >
                          <span style={{ fontWeight: 500 }}>
                            {p.productName}
                            {p.cnCode && <span style={{ color: "#5c7a72", marginLeft: 6 }}>CN:{p.cnCode}</span>}
                          </span>
                          <span style={{ fontSize: 11, color: "#5c7a72" }}>
                            {p.productPeriods.length} dönem →
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Action buttons */}
                  <div style={s.actRow}>
                    <Link
                      to={`/cbam/facilities/${fac.id}`}
                      style={{
                        flex: 1, padding: "7px 12px", borderRadius: 6, textAlign: "center",
                        background: "#e6f9f2", color: "#009966", fontWeight: 600, fontSize: 13,
                        textDecoration: "none",
                      }}
                    >
                      Ürünleri Yönet
                    </Link>
                    {canEdit && (
                      <>
                        <button
                          style={{ padding: "7px 12px", borderRadius: 6, border: "none",
                                   background: "#f1f5f9", color: "#374151", cursor: "pointer",
                                   fontWeight: 600, fontSize: 12 }}
                          onClick={e => openEdit(e, fac)}
                        >
                          Düzenle
                        </button>
                        <button
                          style={{ padding: "7px 12px", borderRadius: 6, border: "none",
                                   background: "#fee2e2", color: "#dc2626", cursor: "pointer",
                                   fontWeight: 600, fontSize: 12 }}
                          onClick={e => deleteFacility(e, fac)}
                        >
                          Sil
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showModal && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.mCard}>
            <div style={s.mTitle}>{editingFac ? "CBAM Tesis Düzenle" : "Yeni CBAM Tesis"}</div>
            {error && <div style={s.err}>{error}</div>}
            <form onSubmit={saveFacility}>
              <label style={s.label}>Tesis Adı *</label>
              <input style={s.input} value={form.facilityName} required
                onChange={e => setForm(f => ({ ...f, facilityName: e.target.value }))} />

              <label style={s.label}>Operatör</label>
              <input style={s.input} value={form.operator} placeholder="Şirket adı"
                onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} />

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Ülke (ISO-2) *</label>
                  <input style={s.input} value={form.facilityCountry} required maxLength={2}
                    onChange={e => setForm(f => ({ ...f, facilityCountry: e.target.value.toUpperCase() }))} />
                </div>
                <div>
                  <label style={s.label}>CBAM Sektörü *</label>
                  <select style={s.input} value={form.sector} required
                    onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                    <option value="steel">Çelik</option>
                    <option value="aluminium">Alüminyum</option>
                    <option value="cement">Çimento</option>
                    <option value="fertilizer">Gübre</option>
                    <option value="electricity">Elektrik</option>
                    <option value="hydrogen">Hidrojen</option>
                    <option value="other">Diğer</option>
                  </select>
                </div>
              </div>

              <label style={s.label}>Tesis Referans No</label>
              <input style={s.input} value={form.facilityRef ?? ""} placeholder="Opsiyonel"
                onChange={e => setForm(f => ({ ...f, facilityRef: e.target.value }))} />

              <label style={s.label}>UN/LOCODE</label>
              <input style={s.input} value={form.unLoCode ?? ""} placeholder="Örn: TRISK (CBAM teknik dosyası)"
                onChange={e => setForm(f => ({ ...f, unLoCode: e.target.value }))} />

              <label style={s.label}>CBAM Portal Tesis ID'si</label>
              <input style={s.input} value={form.cbamInstallationId ?? ""} placeholder="AB CBAM portal tesis kodu"
                onChange={e => setForm(f => ({ ...f, cbamInstallationId: e.target.value }))} />

              <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 14px",
                            fontSize: 12, color: "#065f46", marginBottom: 16 }}>
                Bu tesis sadece CBAM amaçlıdır. GEC/CFE modülleriyle paylaşılmaz.
              </div>

              <div style={s.row}>
                <button type="button" style={{ ...s.btn, ...s.btnS }} onClick={() => setShowModal(false)}>İptal</button>
                <button type="submit" style={{ ...s.btn, ...s.btnP }} disabled={saving}>
                  {saving ? "Kaydediliyor..." : editingFac ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
