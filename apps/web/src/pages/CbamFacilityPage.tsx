import { useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { CbamFacility, CbamProduct } from "../lib/api.js";

const SECTOR_LABELS: Record<string, string> = {
  steel: "Çelik", aluminium: "Alüminyum", cement: "Çimento",
  fertilizer: "Gübre", electricity: "Elektrik", hydrogen: "Hidrojen", other: "Diğer",
};

const s: Record<string, React.CSSProperties> = {
  page:  { maxWidth: 980, margin: "0 auto", padding: "32px 28px" },
  back:  { fontSize: 13, color: "#059669", textDecoration: "none", display: "flex", alignItems: "center", gap: 4, marginBottom: 16 },
  h1:    { fontSize: 21, fontWeight: 700, color: "#0a1f1a", marginBottom: 2 },
  sub:   { fontSize: 13, color: "#5c7a72", marginBottom: 24 },
  card:  { background: "#fff", border: "1px solid #d4ece4", borderRadius: 10, marginBottom: 16 },
  cardH: { padding: "13px 20px", borderBottom: "1px solid #d4ece4", display: "flex", justifyContent: "space-between", alignItems: "center" },
  cardB: { padding: "18px 20px" },
  btn:   { padding: "9px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14, background: "#059669", color: "#fff" },
  btnSm: { padding: "6px 12px", borderRadius: 6, border: "1px solid #059669", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "#fff", color: "#059669" },
  btnDng:{ padding: "6px 12px", borderRadius: 6, border: "1px solid #dc2626", cursor: "pointer", fontWeight: 600, fontSize: 13, background: "#fff", color: "#dc2626" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#1a3530", marginBottom: 5 },
  input: { width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #D1D5DB", fontSize: 13, fontFamily: "inherit", boxSizing: "border-box" as const, background: "#fff" },
  err:   { color: "#dc2626", fontSize: 13, marginBottom: 10 },
  empty: { textAlign: "center" as const, padding: "40px 0", color: "#5c7a72" },
  badge: { display: "inline-block", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 },
};

const EMPTY_PROD = { productName: "", cnCode: "", description: "", unit: "tonne", isCbamScope: true, energyAllocationMode: "facility" };

export default function CbamFacilityPage() {
  const { facilityId } = useParams<{ facilityId: string }>();
  const [facility,  setFacility]  = useState<CbamFacility | null>(null);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [editProd,  setEditProd]  = useState<CbamProduct | null>(null);
  const [form,      setForm]      = useState({ ...EMPTY_PROD });
  const [saving,    setSaving]    = useState(false);
  const [error,     setError]     = useState("");
  const [myRole,    setMyRole]    = useState<string | null>(null);

  const load = useCallback(() => {
    if (!facilityId) return;
    setLoading(true);
    api.cbamFacilities.get(facilityId)
      .then(r => setFacility(r.facility))
      .catch(() => setFacility(null))
      .finally(() => setLoading(false));
  }, [facilityId]);

  useEffect(() => {
    load();
    api.members.me().then(r => setMyRole(r.role)).catch(() => {});
  }, [load]);

  function openCreate() {
    setEditProd(null);
    setForm({ ...EMPTY_PROD });
    setError("");
    setShowForm(true);
  }

  function openEdit(p: CbamProduct) {
    setEditProd(p);
    setForm({
      productName:          p.productName,
      cnCode:               p.cnCode ?? "",
      description:          p.description ?? "",
      unit:                 p.unit,
      isCbamScope:          p.isCbamScope,
      energyAllocationMode: p.energyAllocationMode,
    });
    setError("");
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!facilityId) return;
    setError(""); setSaving(true);
    try {
      if (editProd) {
        await api.cbamProducts.update(facilityId, editProd.id, {
          productName:          form.productName,
          cnCode:               form.cnCode || null,
          description:          form.description || null,
          unit:                 form.unit,
          isCbamScope:          form.isCbamScope,
          energyAllocationMode: form.energyAllocationMode as "facility" | "band",
        });
      } else {
        await api.cbamProducts.create(facilityId, {
          productName:          form.productName,
          cnCode:               form.cnCode || null,
          description:          form.description || null,
          unit:                 form.unit,
          isCbamScope:          form.isCbamScope,
          energyAllocationMode: form.energyAllocationMode as "facility" | "band",
        });
      }
      setShowForm(false);
      setEditProd(null);
      load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Hata oluştu");
    }
    setSaving(false);
  }

  async function deleteProduct(productId: string, productName: string) {
    if (!facilityId) return;
    if (!confirm(`"${productName}" ürününü silmek istediğinizden emin misiniz?`)) return;
    try {
      await api.cbamProducts.delete(facilityId, productId);
      load();
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Silme hatası");
    }
  }

  const canEdit = ["owner", "admin", "analyst"].includes(myRole ?? "");

  if (loading) return <div style={{ padding: 48, color: "#5c7a72" }}>Yükleniyor...</div>;
  if (!facility) return <div style={{ padding: 48, color: "#dc2626" }}>Tesis bulunamadı.</div>;

  const sectorLabel = SECTOR_LABELS[facility.sector] ?? facility.sector;

  return (
    <div style={s.page}>
      <Link to="/cbam" style={s.back}>← CBAM Tesislerine Dön</Link>

      {/* Facility header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <div style={s.h1}>{facility.facilityName}</div>
          <div style={s.sub}>
            {facility.operator && <span style={{ marginRight: 8 }}>{facility.operator}</span>}
            <span style={{ marginRight: 8 }}>{facility.facilityCountry}</span>
            <span style={{ ...s.badge, background: "#e0e7ff", color: "#3730a3" }}>{sectorLabel}</span>
            {facility.unLoCode && (
              <span style={{ ...s.badge, marginLeft: 6, background: "#f3f4f6", color: "#374151" }}>
                UN/LO: {facility.unLoCode}
              </span>
            )}
            {facility.cbamInstallationId && (
              <span style={{ ...s.badge, marginLeft: 6, background: "#fef3c7", color: "#92400e" }}>
                Portal: {facility.cbamInstallationId}
              </span>
            )}
          </div>
        </div>
        {canEdit && (
          <button style={s.btn} onClick={() => {
            if (showForm) { setShowForm(false); setEditProd(null); setError(""); }
            else openCreate();
          }}>
            {showForm ? "İptal" : "+ Ürün Ekle"}
          </button>
        )}
      </div>

      {/* Add/Edit product form */}
      {showForm && (
        <div style={s.card}>
          <div style={s.cardH}>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#0a1f1a" }}>
              {editProd ? "Ürün Düzenle" : "Yeni CBAM Ürünü"}
            </span>
          </div>
          <div style={s.cardB}>
            <form onSubmit={saveProduct}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={s.label}>Ürün Adı *</label>
                  <input style={s.input} value={form.productName} required
                    onChange={e => setForm(f => ({ ...f, productName: e.target.value }))} />
                </div>
                <div>
                  <label style={s.label}>CN Kodu</label>
                  <input style={s.input} value={form.cnCode} placeholder="7206, 7601, 2523…"
                    onChange={e => setForm(f => ({ ...f, cnCode: e.target.value }))} />
                </div>
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={s.label}>Açıklama</label>
                <input style={s.input} value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginBottom: 12 }}>
                <div>
                  <label style={s.label}>Birim</label>
                  <select style={s.input} value={form.unit}
                    onChange={e => setForm(f => ({ ...f, unit: e.target.value }))}>
                    <option value="tonne">tonne</option>
                    <option value="MWh">MWh</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
                <div>
                  <label style={s.label}>Enerji Dağıtım Modu</label>
                  <select style={s.input} value={form.energyAllocationMode}
                    onChange={e => setForm(f => ({ ...f, energyAllocationMode: e.target.value }))}>
                    <option value="facility">Tesis (facility)</option>
                    <option value="band">Band</option>
                  </select>
                </div>
                <div style={{ display: "flex", alignItems: "flex-end", paddingBottom: 14 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer" }}>
                    <input type="checkbox" checked={form.isCbamScope}
                      onChange={e => setForm(f => ({ ...f, isCbamScope: e.target.checked }))} />
                    CBAM Kapsam İçi
                  </label>
                </div>
              </div>
              {form.energyAllocationMode === "facility" ? (
                <div style={{ background: "#f0fdf4", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#065f46", marginBottom: 12 }}>
                  Tesis modu: Tesis toplam tüketimi ve ürünün elektrik payı girilir; yenilenebilir orantılı dağıtılır.
                </div>
              ) : (
                <div style={{ background: "#fffbeb", borderRadius: 8, padding: "10px 14px", fontSize: 12, color: "#92400e", marginBottom: 12 }}>
                  Band modu: Her üretim bandının kendi enerji sayacı var. Yenilenebilir enerji doğrudan bu ürün bandına atanır.
                </div>
              )}
              {error && <div style={s.err}>{error}</div>}
              <div style={{ display: "flex", gap: 10 }}>
                <button type="submit" style={s.btn} disabled={saving}>
                  {saving ? "Kaydediliyor…" : editProd ? "Güncelle" : "Ürün Kaydet"}
                </button>
                <button type="button" style={s.btnSm}
                  onClick={() => { setShowForm(false); setEditProd(null); setError(""); }}>
                  İptal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product list */}
      {facility.products.length === 0 && !showForm ? (
        <div style={s.empty}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📦</div>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Henüz ürün eklenmemiş</div>
          <div style={{ fontSize: 13 }}>Bu CBAM tesisine ait ürünleri ekleyin.</div>
        </div>
      ) : (
        facility.products.map(p => {
          const latestCalc = p.productPeriods.find(pp => pp.calculatedAt);
          return (
            <div key={p.id} style={s.card}>
              <div style={s.cardH}>
                <div>
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#0a1f1a" }}>{p.productName}</span>
                  {p.cnCode && <span style={{ marginLeft: 10, fontSize: 12, color: "#5c7a72" }}>CN: {p.cnCode}</span>}
                  <span style={{ ...s.badge, marginLeft: 10, background: p.isCbamScope ? "#d1fae5" : "#e5e7eb", color: p.isCbamScope ? "#065f46" : "#374151" }}>
                    {p.isCbamScope ? "CBAM Kapsam İçi" : "CBAM Dışı"}
                  </span>
                  <span style={{ ...s.badge, marginLeft: 6, background: "#dbeafe", color: "#1e40af" }}>
                    {p.energyAllocationMode === "band" ? "Band" : "Tesis"} modu
                  </span>
                </div>
                <div style={{ display: "flex", gap: 8 }}>
                  <Link
                    to={`/cbam/facilities/${facilityId}/products/${p.id}`}
                    style={{ ...s.btn, padding: "6px 14px", fontSize: 13, textDecoration: "none", display: "inline-flex", alignItems: "center" }}
                  >
                    Dönemler →
                  </Link>
                  {canEdit && (
                    <>
                      <button style={s.btnSm} onClick={() => openEdit(p)}>Düzenle</button>
                      <button style={s.btnDng} onClick={() => deleteProduct(p.id, p.productName)}>Sil</button>
                    </>
                  )}
                </div>
              </div>
              <div style={{ ...s.cardB, display: "flex", gap: 24, color: "#5c7a72", fontSize: 13 }}>
                <span>{p.productPeriods.length} dönem · birim: {p.unit}</span>
                {latestCalc?.see && (
                  <span style={{ color: "#059669", fontWeight: 600 }}>
                    Son SEE: {parseFloat(latestCalc.see).toFixed(4)} tCO₂/{p.unit}
                  </span>
                )}
                {p.description && <span>{p.description}</span>}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
