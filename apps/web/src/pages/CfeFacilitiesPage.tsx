import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Installation, CreateInstallationBody } from "../lib/api.js";

const SECTORS = [
  "Enerji", "Demir-Çelik", "Alüminyum", "Çimento", "Gübre",
  "Kimyasal", "Endüstriyel", "Tekstil", "Gıda", "Diğer",
];

const s: Record<string, React.CSSProperties> = {
  page:  { maxWidth: 1100, margin: "0 auto", padding: "32px 28px" },
  h1:    { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:   { fontSize: 14, color: "#5c7a72", marginBottom: 0 },
  card:  { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 20 },
  table: { width: "100%", borderCollapse: "collapse" as const },
  th:    { textAlign: "left" as const, fontSize: 11, color: "#5c7a72", fontWeight: 700,
           textTransform: "uppercase" as const, letterSpacing: ".05em",
           padding: "10px 14px", borderBottom: "1px solid #d4ece4" },
  td:    { padding: "12px 14px", fontSize: 13, color: "#1a3530", borderBottom: "1px solid #eef7f3" },
  btn:   { padding: "10px 22px", borderRadius: 8, border: "none", cursor: "pointer",
           fontWeight: 700, fontSize: 14, background: "#00b87a", color: "#fff" },
  btnSm: { padding: "6px 14px", borderRadius: 7, border: "1px solid #d4ece4",
           cursor: "pointer", fontSize: 12, background: "#fff", color: "#1a3530" },
  btnDanger: { padding: "6px 14px", borderRadius: 7, border: "1px solid #fca5a5",
               cursor: "pointer", fontSize: 12, background: "#fff", color: "#dc2626" },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#5c7a72",
           textTransform: "uppercase" as const, letterSpacing: ".05em", marginBottom: 6 },
  input: { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #d4ece4",
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
  width: 480, boxShadow: "0 20px 60px rgba(0,0,0,.2)",
};

const EMPTY_FORM: Omit<CreateInstallationBody, "facilityRef"> = {
  facilityName: "", operator: "", facilityCountry: "Türkiye", sector: "Enerji",
};

export default function CfeFacilitiesPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading]   = useState(true);
  const [err,     setErr]       = useState("");
  const [showAdd, setShowAdd]   = useState(false);
  const [form,    setForm]      = useState(EMPTY_FORM);
  const [saving,  setSaving]    = useState(false);
  const [search,  setSearch]    = useState("");

  useEffect(() => { load(); }, []);

  async function load() {
    try {
      setLoading(true);
      setErr("");
      const list = await api.installations.list();
      setInstallations(list);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Yükleme hatası");
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!form.facilityName.trim()) return;
    setSaving(true);
    try {
      await api.installations.create({
        ...form,
        operator: form.operator.trim() || form.facilityName.trim(),
      });
      setShowAdd(false);
      setForm(EMPTY_FORM);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Kayıt hatası");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!window.confirm(`"${name}" tesisini silmek istediğinize emin misiniz? Tüm dönemleri de silinecek.`)) return;
    try {
      await api.installations.delete(id);
      await load();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Silme hatası");
    }
  }

  const filtered = installations.filter(i =>
    i.facilityName.toLowerCase().includes(search.toLowerCase()) ||
    i.facilityCountry.toLowerCase().includes(search.toLowerCase()) ||
    i.sector.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24 }}>
        <div>
          <h1 style={s.h1}>Tesisler</h1>
          <p style={s.sub}>Granüler emisyon hesaplama ve 24/7 CFE matching için tesis yönetimi</p>
        </div>
        <button style={s.btn} onClick={() => setShowAdd(true)}>+ Tesis Ekle</button>
      </div>

      {/* CBAM note */}
      <div style={{
        background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8,
        padding: "10px 16px", fontSize: 13, color: "#92400e", marginBottom: 20,
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span>⚠️</span>
        <span>
          CBAM kapsamındaki tesisler{" "}
          <Link to="/cbam" style={{ color: "#b45309", fontWeight: 600 }}>CBAM Emissions</Link>{" "}
          modülünden yönetilmektedir. Bu sayfadaki tesisler granüler hesaplama ve CFE matching için kullanılır.
        </span>
      </div>

      {err && (
        <div style={{ background: "#fee2e2", border: "1px solid #fca5a5", borderRadius: 8, padding: "10px 16px", fontSize: 13, color: "#dc2626", marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* Search + Stats row */}
      <div style={{ display: "flex", gap: 12, marginBottom: 20, alignItems: "center" }}>
        <input
          style={{ ...s.input, maxWidth: 320 }}
          placeholder="Tesis ara..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span style={{ fontSize: 13, color: "#5c7a72", marginLeft: "auto" }}>
          {loading ? "Yükleniyor..." : `${filtered.length} tesis`}
        </span>
      </div>

      {/* Table */}
      <div style={s.card}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "40px", color: "#5c7a72" }}>Yükleniyor...</div>
        ) : (
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Tesis Adı</th>
                <th style={s.th}>Operatör</th>
                <th style={s.th}>Ülke</th>
                <th style={s.th}>Sektör</th>
                <th style={s.th}>Dönem Sayısı</th>
                <th style={s.th}>Oluşturulma</th>
                <th style={s.th}></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...s.td, textAlign: "center", color: "#5c7a72", padding: "48px" }}>
                    {installations.length === 0
                      ? "Henüz tesis eklenmemiş. "+ '"Tesis Ekle" butonuyla başlayın.'
                      : "Arama sonucu bulunamadı."}
                  </td>
                </tr>
              ) : filtered.map(inst => (
                <tr key={inst.id} style={{ transition: "background .1s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "#f4fbf8")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
                >
                  <td style={s.td}>
                    <Link to={`/installations/${inst.id}`}
                      style={{ color: "#00b87a", fontWeight: 600, textDecoration: "none" }}>
                      {inst.facilityName}
                    </Link>
                  </td>
                  <td style={s.td}>{inst.operator}</td>
                  <td style={s.td}>{inst.facilityCountry}</td>
                  <td style={s.td}>
                    <span style={{
                      background: "#e6f9f2", color: "#009966", borderRadius: 4,
                      padding: "2px 9px", fontSize: 11, fontWeight: 700,
                    }}>
                      {inst.sector}
                    </span>
                  </td>
                  <td style={{ ...s.td, textAlign: "center" as const }}>
                    <span style={{
                      background: "#f4fbf8", borderRadius: 4, padding: "2px 10px",
                      fontSize: 13, fontWeight: 700, color: "#0a1f1a",
                    }}>
                      {inst._count?.periods ?? 0}
                    </span>
                  </td>
                  <td style={{ ...s.td, color: "#5c7a72", fontSize: 12 }}>
                    {new Date(inst.createdAt).toLocaleDateString("tr-TR")}
                  </td>
                  <td style={{ ...s.td, whiteSpace: "nowrap" as const }}>
                    <Link to={`/installations/${inst.id}`}
                      style={{ ...s.btnSm, textDecoration: "none", display: "inline-block", marginRight: 8 }}>
                      Detay
                    </Link>
                    <button style={s.btnDanger} onClick={() => handleDelete(inst.id, inst.facilityName)}>
                      Sil
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Add Modal */}
      {showAdd && (
        <div style={overlay} onClick={e => { if (e.target === e.currentTarget) setShowAdd(false); }}>
          <div style={modal}>
            <h2 style={{ fontSize: 18, fontWeight: 700, color: "#0a1f1a", marginBottom: 24 }}>Yeni Tesis Ekle</h2>

            <div style={{ display: "grid", gap: 16 }}>
              <div>
                <label style={s.label}>Tesis Adı *</label>
                <input style={s.input} value={form.facilityName}
                  onChange={e => setForm(f => ({ ...f, facilityName: e.target.value }))}
                  placeholder="örn. İstanbul Fabrika A" />
              </div>
              <div>
                <label style={s.label}>Operatör</label>
                <input style={s.input} value={form.operator}
                  onChange={e => setForm(f => ({ ...f, operator: e.target.value }))}
                  placeholder="Boş bırakılırsa tesis adı kullanılır" />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div>
                  <label style={s.label}>Ülke</label>
                  <input style={s.input} value={form.facilityCountry}
                    onChange={e => setForm(f => ({ ...f, facilityCountry: e.target.value }))}
                    placeholder="Türkiye" />
                </div>
                <div>
                  <label style={s.label}>Sektör</label>
                  <select style={s.select} value={form.sector}
                    onChange={e => setForm(f => ({ ...f, sector: e.target.value }))}>
                    {SECTORS.map(sec => <option key={sec}>{sec}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 28, justifyContent: "flex-end" }}>
              <button style={{ ...s.btnSm, padding: "10px 20px" }} onClick={() => setShowAdd(false)}>İptal</button>
              <button
                style={{ ...s.btn, opacity: saving || !form.facilityName.trim() ? 0.6 : 1 }}
                disabled={saving || !form.facilityName.trim()}
                onClick={handleCreate}
              >
                {saving ? "Kaydediliyor..." : "Tesis Ekle"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
