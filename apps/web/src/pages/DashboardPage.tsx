import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Installation } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";

const ROLE_LABELS: Record<string, string> = {
  owner: "Sahip", admin: "Yönetici", analyst: "Analist", viewer: "İzleyici",
};

const SECTOR_LABELS: Record<string, string> = {
  steel: "Çelik", aluminium: "Alüminyum", cement: "Çimento",
  fertilizer: "Gübre", electricity: "Elektrik",
};

const s: Record<string, React.CSSProperties> = {
  nav:    { background: "#0066CC", color: "#fff", padding: "12px 24px", display: "flex", alignItems: "center", justifyContent: "space-between" },
  brand:  { fontWeight: 700, fontSize: 18 },
  navBtn: { background: "rgba(255,255,255,.15)", border: "none", color: "#fff", padding: "6px 14px", borderRadius: 6, cursor: "pointer", fontSize: 13 },
  page:   { maxWidth: 900, margin: "0 auto", padding: "32px 24px" },
  h1:     { fontSize: 22, fontWeight: 700, color: "#111827", marginBottom: 6 },
  sub:    { color: "#6B7280", fontSize: 14, marginBottom: 28 },
  grid:   { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 16 },
  card:   { background: "#fff", borderRadius: 10, border: "1px solid #E5E7EB", padding: "20px", cursor: "pointer", textDecoration: "none", color: "inherit", display: "block", transition: "box-shadow .15s" },
  cardTitle: { fontWeight: 600, fontSize: 15, color: "#111827", marginBottom: 4 },
  cardSub:   { fontSize: 13, color: "#6B7280", marginBottom: 12 },
  badge:  { display: "inline-block", background: "#EFF6FF", color: "#1D4ED8", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600 },
  addBtn: { display: "inline-flex", alignItems: "center", gap: 6, background: "#0066CC", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 24 },
  empty:  { textAlign: "center" as const, padding: "60px 0", color: "#6B7280" },
  modal:  { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  mCard:  { background: "#fff", borderRadius: 12, padding: "32px", width: 440, boxShadow: "0 8px 32px rgba(0,0,0,.15)" },
  mTitle: { fontSize: 17, fontWeight: 700, marginBottom: 20 },
  label:  { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 5 },
  input:  { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", marginBottom: 14 },
  row:    { display: "flex", gap: 10 },
  btn:    { flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnP:   { background: "#0066CC", color: "#fff" },
  btnS:   { background: "#F3F4F6", color: "#374151" },
  err:    { color: "#DC2626", fontSize: 13, marginBottom: 12 },
};

export default function DashboardPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ facilityName: "", operator: "", facilityCountry: "TR", facilityRef: "", sector: "steel" });
  const [saving, setSaving]  = useState(false);
  const [error, setError]    = useState("");
  const [myRole, setMyRole]  = useState<string | null>(null);

  useEffect(() => {
    api.installations.list().then(data => {
      setInstallations(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
    api.members.me().then(r => setMyRole(r.role)).catch(() => {});
  }, []);

  async function createInstallation(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      const inst = await api.installations.create({
        facilityName:    form.facilityName,
        operator:        form.operator,
        facilityCountry: form.facilityCountry,
        facilityRef:     form.facilityRef || undefined,
        sector:          form.sector,
      });
      setInstallations(prev => [inst, ...prev]);
      setShowModal(false);
      setForm({ facilityName: "", operator: "", facilityCountry: "TR", facilityRef: "", sector: "steel" });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Hata oluştu");
    }
    setSaving(false);
  }

  async function deleteInstallation(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault();
    e.stopPropagation();
    if (!confirm(`"${name}" tesisini ve tüm dönemlerini silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz.`)) return;
    try {
      await api.installations.delete(id);
      setInstallations(prev => prev.filter(i => i.id !== id));
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : "Silme hatası");
    }
  }

  return (
    <>
      <nav style={s.nav}>
        <span style={s.brand}>Voltfox</span>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {myRole && (
            <span style={{ fontSize: 12, color: "rgba(255,255,255,.7)", background: "rgba(255,255,255,.15)", borderRadius: 4, padding: "3px 9px" }}>
              {ROLE_LABELS[myRole] ?? myRole}
            </span>
          )}
          {["owner", "admin"].includes(myRole ?? "") && (
            <Link to="/settings" style={{ ...s.navBtn, textDecoration: "none", display: "inline-block" }}>Ayarlar</Link>
          )}
          <button style={s.navBtn} onClick={() => supabase.auth.signOut()}>Çıkış</button>
        </div>
      </nav>
      <div style={s.page}>
        <div style={s.h1}>Tesisler</div>
        <div style={s.sub}>CBAM hesaplama için üretim tesislerinizi yönetin</div>

        <button style={s.addBtn} onClick={() => setShowModal(true)}>
          + Yeni Tesis
        </button>

        {loading ? (
          <div style={s.empty}>Yükleniyor...</div>
        ) : installations.length === 0 ? (
          <div style={s.empty}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🏭</div>
            <div>Henüz tesis eklenmemiş. İlk tesisinizi ekleyin.</div>
          </div>
        ) : (
          <div style={s.grid}>
            {installations.map(inst => (
              <div key={inst.id} style={{ position: "relative" }}>
                <Link to={`/installations/${inst.id}`} style={s.card}>
                  <div style={s.cardTitle}>{inst.facilityName}</div>
                  <div style={s.cardSub}>{inst.operator} · {inst.facilityCountry}</div>
                  <span style={{ ...s.badge, marginRight: 6 }}>{SECTOR_LABELS[(inst as any).sector] ?? (inst as any).sector ?? "Çelik"}</span>
                  <span style={s.badge}>{inst._count?.periods ?? 0} dönem</span>
                </Link>
                {["owner", "admin"].includes(myRole ?? "") && (
                  <button
                    style={{ position: "absolute", top: 10, right: 10, background: "#FEE2E2", border: "none", borderRadius: 5, color: "#DC2626", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 600, zIndex: 1 }}
                    onClick={e => deleteInstallation(e, inst.id, inst.facilityName)}>
                    Sil
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {showModal && (
        <div style={s.modal} onClick={(e) => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.mCard}>
            <div style={s.mTitle}>Yeni Tesis Ekle</div>
            {error && <div style={s.err}>{error}</div>}
            <form onSubmit={createInstallation}>
              <label style={s.label}>Tesis Adı *</label>
              <input style={s.input} value={form.facilityName}
                onChange={e => setForm(f => ({ ...f, facilityName: e.target.value }))} required />
              <label style={s.label}>Operatör *</label>
              <input style={s.input} value={form.operator}
                onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} required />
              <label style={s.label}>Ülke (ISO-2) *</label>
              <input style={s.input} value={form.facilityCountry}
                onChange={e => setForm(f => ({ ...f, facilityCountry: e.target.value }))}
                maxLength={2} required />
              <label style={s.label}>CBAM Sektörü *</label>
              <select style={{ ...s.input, background: "#fff" }} value={form.sector}
                onChange={e => setForm(f => ({ ...f, sector: e.target.value }))} required>
                <option value="steel">Çelik (Steel)</option>
                <option value="aluminium">Alüminyum (Aluminium)</option>
                <option value="cement">Çimento (Cement)</option>
                <option value="fertilizer">Gübre (Fertilizer)</option>
                <option value="electricity">Elektrik (Electricity)</option>
              </select>
              <label style={s.label}>Tesis Referans No</label>
              <input style={s.input} value={form.facilityRef}
                onChange={e => setForm(f => ({ ...f, facilityRef: e.target.value }))}
                placeholder="Opsiyonel" />
              <div style={s.row}>
                <button type="button" style={{ ...s.btn, ...s.btnS }} onClick={() => setShowModal(false)}>İptal</button>
                <button type="submit" style={{ ...s.btn, ...s.btnP }} disabled={saving}>
                  {saving ? "Kaydediliyor..." : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
