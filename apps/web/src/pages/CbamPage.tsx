import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import type { Installation } from "../lib/api.js";
import { supabase } from "../lib/supabase.js";
import { SECTOR_COLORS, SECTOR_LABELS } from "../lib/chart-utils.js";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ReferenceLine,
} from "recharts";

const s: Record<string, React.CSSProperties> = {
  page:      { maxWidth: 1000, margin: "0 auto", padding: "32px 28px" },
  h1:        { fontSize: 22, fontWeight: 700, color: "#0a1f1a", marginBottom: 4 },
  sub:       { fontSize: 14, color: "#5c7a72", marginBottom: 24 },
  kpiRow:    { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14, marginBottom: 24 },
  kpi:       { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "16px 18px" },
  kpiL:      { fontSize: 12, color: "#5c7a72", marginBottom: 4 },
  kpiV:      { fontSize: 22, fontWeight: 700, color: "#0a1f1a" },
  addBtn:    { display: "inline-flex", alignItems: "center", gap: 6, background: "#00b87a", color: "#fff", border: "none", borderRadius: 8, padding: "10px 18px", fontSize: 14, fontWeight: 600, cursor: "pointer", marginBottom: 20 },
  grid:      { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(270px, 1fr))", gap: 16 },
  card:      { background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", textDecoration: "none", color: "inherit", display: "block", transition: "box-shadow .15s" },
  cardTitle: { fontWeight: 600, fontSize: 15, color: "#0a1f1a", marginBottom: 4 },
  cardSub:   { fontSize: 13, color: "#5c7a72", marginBottom: 12 },
  badge:     { display: "inline-block", borderRadius: 4, padding: "2px 8px", fontSize: 12, fontWeight: 600 },
  modal:     { position: "fixed" as const, inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100 },
  mCard:     { background: "#fff", borderRadius: 12, padding: "32px", width: 440, boxShadow: "0 8px 32px rgba(0,0,0,.15)" },
  mTitle:    { fontSize: 17, fontWeight: 700, marginBottom: 20 },
  label:     { display: "block", fontSize: 13, fontWeight: 600, color: "#1a3530", marginBottom: 5 },
  input:     { width: "100%", padding: "9px 12px", borderRadius: 7, border: "1px solid #D1D5DB", fontSize: 14, outline: "none", marginBottom: 14, boxSizing: "border-box" as const },
  row:       { display: "flex", gap: 10 },
  btn:       { flex: 1, padding: "10px", borderRadius: 8, border: "none", cursor: "pointer", fontWeight: 600, fontSize: 14 },
  btnP:      { background: "#00b87a", color: "#fff" },
  btnS:      { background: "#eef7f3", color: "#1a3530" },
  err:       { color: "#DC2626", fontSize: 13, marginBottom: 12 },
  empty:     { textAlign: "center" as const, padding: "60px 0", color: "#5c7a72" },
  actBtns:   { position: "absolute" as const, top: 10, right: 10, display: "flex", gap: 4, zIndex: 1 },
};

const ROLE_LABELS: Record<string, string> = {
  owner: "Sahip", admin: "Yönetici", analyst: "Analist", viewer: "İzleyici",
};

const EMPTY_FORM = { facilityName: "", operator: "", facilityCountry: "TR", facilityRef: "", sector: "steel" };

export default function CbamPage() {
  const [installations, setInstallations] = useState<Installation[]>([]);
  const [loading, setLoading]             = useState(true);
  const [showModal, setShowModal]         = useState(false);
  const [editingInst, setEditingInst]     = useState<Installation | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving]   = useState(false);
  const [error, setError]     = useState("");
  const [myRole, setMyRole]   = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"installations" | "comparison">("installations");
  const [compData, setCompData] = useState<Array<{
    label: string; facilityName: string; periodName: string; reportYear: number;
    seeBaseline: number; seeVoltfox: number; defaultSee: number | null;
  }>>([]);

  useEffect(() => {
    api.installations.list().then(data => {
      setInstallations(Array.isArray(data) ? data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
    api.members.me().then(r => setMyRole(r.role)).catch(() => {});
    // Load comparison data
    api.installations.list().then(async list => {
      const rows: typeof compData = [];
      for (const inst of list) {
        const detail = await api.installations.get(inst.id).catch(() => null);
        if (!detail) continue;
        for (const p of detail.periods) {
          if (!p.result) continue;
          rows.push({
            label: `${inst.facilityName.slice(0, 10)} / ${p.periodName.slice(0, 8)}`,
            facilityName: inst.facilityName,
            periodName:   p.periodName,
            reportYear:   p.reportYear,
            seeBaseline:  p.result.seeBaseline,
            seeVoltfox:   p.result.seeVoltfox,
            defaultSee:   p.result.defaultSee,
          });
        }
      }
      setCompData(rows.sort((a, b) => a.reportYear - b.reportYear));
    }).catch(() => {});
  }, []);

  function openCreate() {
    setEditingInst(null);
    setForm(EMPTY_FORM);
    setError("");
    setShowModal(true);
  }

  function openEdit(e: React.MouseEvent, inst: Installation) {
    e.preventDefault(); e.stopPropagation();
    setEditingInst(inst);
    setForm({
      facilityName:    inst.facilityName,
      operator:        inst.operator,
      facilityCountry: inst.facilityCountry,
      facilityRef:     inst.facilityRef ?? "",
      sector:          (inst as Installation & { sector?: string }).sector ?? "steel",
    });
    setError("");
    setShowModal(true);
  }

  async function saveInstallation(e: React.FormEvent) {
    e.preventDefault();
    setError(""); setSaving(true);
    try {
      if (editingInst) {
        const updated = await api.installations.update(editingInst.id, {
          facilityName:    form.facilityName,
          operator:        form.operator,
          facilityCountry: form.facilityCountry,
          facilityRef:     form.facilityRef || undefined,
          sector:          form.sector,
        });
        setInstallations(prev => prev.map(i => i.id === updated.id ? { ...i, ...updated } : i));
      } else {
        const inst = await api.installations.create({
          facilityName:    form.facilityName,
          operator:        form.operator,
          facilityCountry: form.facilityCountry,
          facilityRef:     form.facilityRef || undefined,
          sector:          form.sector,
        });
        setInstallations(prev => [inst, ...prev]);
      }
      setShowModal(false);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : "Hata oluştu"); }
    setSaving(false);
  }

  async function deleteInstallation(e: React.MouseEvent, id: string, name: string) {
    e.preventDefault(); e.stopPropagation();
    if (!confirm(`"${name}" tesisini ve tüm dönemlerini silmek istediğinizden emin misiniz?\nBu işlem geri alınamaz.`)) return;
    try {
      await api.installations.delete(id);
      setInstallations(prev => prev.filter(i => i.id !== id));
    } catch (e: unknown) { alert(e instanceof Error ? e.message : "Silme hatası"); }
  }

  const totalPeriods = installations.reduce((s, i) => s + (i._count?.periods ?? 0), 0);
  const canEdit = ["owner", "admin"].includes(myRole ?? "");

  return (
    <>
      <div style={s.page}>
        <div style={s.h1}>CBAM Tesisleri</div>
        <div style={s.sub}>
          CBAM kapsamındaki üretim tesislerinizi yönetin
          {myRole && <span style={{ marginLeft: 10, background: "#e6f9f2", color: "#009966", borderRadius: 4, padding: "2px 8px", fontSize: 12 }}>{ROLE_LABELS[myRole] ?? myRole}</span>}
          <button style={{ marginLeft: 10, background: "none", border: "none", color: "#5c7a72", cursor: "pointer", fontSize: 12 }} onClick={() => supabase.auth.signOut()}>Çıkış</button>
        </div>

        <div style={s.kpiRow}>
          <div style={s.kpi}><div style={s.kpiL}>Toplam Tesis</div><div style={s.kpiV}>{installations.length}</div></div>
          <div style={s.kpi}><div style={s.kpiL}>Toplam Dönem</div><div style={s.kpiV}>{totalPeriods}</div></div>
          <div style={s.kpi}><div style={s.kpiL}>Hesaplanmış Dönem</div><div style={{ ...s.kpiV, color: "#059669" }}>—</div></div>
        </div>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, borderBottom: "1px solid #d4ece4", marginBottom: 20 }}>
          {(["installations", "comparison"] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{
              padding: "8px 18px", border: "none", cursor: "pointer", fontWeight: 600,
              fontSize: 13, borderRadius: "6px 6px 0 0",
              background: activeTab === tab ? "#fff" : "transparent",
              color: activeTab === tab ? "#0a1f1a" : "#5c7a72",
              borderBottom: activeTab === tab ? "2px solid #00b87a" : "2px solid transparent",
            }}>
              {tab === "installations" ? "Tesisler" : "Dönem Karşılaştırması"}
            </button>
          ))}
        </div>

        {activeTab === "comparison" ? (
          <div>
            {compData.length === 0 ? (
              <div style={s.empty}>
                <div style={{ fontSize: 32, marginBottom: 12 }}>📊</div>
                <div>Hesaplanmış dönem yok. Tesis → Dönem → SEE Hesapla adımlarını tamamlayın.</div>
              </div>
            ) : (
              <>
                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px", marginBottom: 20 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", letterSpacing: ".08em",
                                textTransform: "uppercase", marginBottom: 14 }}>
                    Spesifik Gömülü Emisyon (SEE) — tCO₂e/tonne ürün
                  </div>
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={compData} margin={{ top: 5, right: 20, bottom: 60, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#d4ece4" />
                      <XAxis dataKey="label" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" interval={0} />
                      <YAxis tick={{ fontSize: 11 }} unit=" t" width={52} />
                      <Tooltip
                        formatter={(v: unknown, name: unknown) =>
                          [`${Number(v).toFixed(4)} tCO₂e/t`, String(name)] as [string, string]
                        }
                        contentStyle={{ borderRadius: 8, border: "1px solid #d4ece4", fontSize: 12 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 12, paddingTop: 8 }} />
                      {compData.some(d => d.defaultSee !== null) && (
                        <Bar dataKey="defaultSee" name="CBAM Default SEE" fill="#fca5a5" />
                      )}
                      <Bar dataKey="seeBaseline" name="SEE Baseline" fill="#d4ece4" />
                      <Bar dataKey="seeVoltfox"  name="SEE Actual (Voltfox)" fill="#00b87a" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Comparison table */}
                <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #d4ece4", padding: "20px" }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#5c7a72", letterSpacing: ".08em",
                                textTransform: "uppercase", marginBottom: 12 }}>Detaylı Karşılaştırma</div>
                  <table style={{ width: "100%", borderCollapse: "collapse" }}>
                    <thead>
                      <tr>
                        {["Tesis", "Dönem", "Yıl", "SEE Baseline", "SEE Actual", "Azaltım %", "CBAM Default"].map(h => (
                          <th key={h} style={{ textAlign: h === "Tesis" || h === "Dönem" ? "left" : "right",
                                               fontSize: 11, color: "#5c7a72", fontWeight: 700,
                                               textTransform: "uppercase", letterSpacing: ".04em",
                                               padding: "8px 12px", borderBottom: "1px solid #d4ece4" } as React.CSSProperties}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compData.map((d, i) => {
                        const pct = d.seeBaseline > 0 ? ((d.seeBaseline - d.seeVoltfox) / d.seeBaseline * 100) : 0;
                        return (
                          <tr key={i} style={{ background: i % 2 === 0 ? "#fff" : "#f9fdfb" }}>
                            <td style={{ padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #eef7f3" }}>{d.facilityName}</td>
                            <td style={{ padding: "10px 12px", fontSize: 13, borderBottom: "1px solid #eef7f3" }}>{d.periodName}</td>
                            <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: "1px solid #eef7f3" }}>{d.reportYear}</td>
                            <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", borderBottom: "1px solid #eef7f3" }}>{d.seeBaseline.toFixed(4)}</td>
                            <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", fontWeight: 600, color: "#059669", borderBottom: "1px solid #eef7f3" }}>{d.seeVoltfox.toFixed(4)}</td>
                            <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", color: "#059669", borderBottom: "1px solid #eef7f3" }}>%{pct.toFixed(1)}</td>
                            <td style={{ padding: "10px 12px", fontSize: 13, textAlign: "right", color: d.defaultSee !== null ? "#ef4444" : "#5c7a72", borderBottom: "1px solid #eef7f3" }}>
                              {d.defaultSee !== null ? d.defaultSee.toFixed(4) : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        ) : null}

        {activeTab === "installations" && canEdit && (
          <button style={s.addBtn} onClick={openCreate}>+ Yeni Tesis</button>
        )}

        {activeTab === "installations" && (
          loading ? (
            <div style={s.empty}>Yükleniyor...</div>
          ) : installations.length === 0 ? (
            <div style={s.empty}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>🏭</div>
              <div>Henüz tesis eklenmemiş. İlk tesisinizi ekleyin.</div>
            </div>
          ) : (
            <div style={s.grid}>
              {installations.map(inst => {
                const sec = (inst as Installation & { sector?: string }).sector ?? "steel";
                const sectorColor = SECTOR_COLORS[sec] ?? "#5c7a72";
                const sectorLabel = SECTOR_LABELS[sec] ?? sec;
                return (
                  <div key={inst.id} style={{ position: "relative" }}>
                    <Link to={`/installations/${inst.id}`} style={s.card}>
                      <div style={s.cardTitle}>{inst.facilityName}</div>
                      <div style={s.cardSub}>{inst.operator} · {inst.facilityCountry}</div>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ ...s.badge, background: sectorColor + "20", color: sectorColor }}>{sectorLabel}</span>
                        <span style={{ ...s.badge, background: "#e6f9f2", color: "#009966" }}>{inst._count?.periods ?? 0} dönem</span>
                      </div>
                    </Link>
                    {canEdit && (
                      <div style={s.actBtns}>
                        <button
                          style={{ background: "#e6f9f2", border: "none", borderRadius: 5, color: "#009966", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 600 }}
                          onClick={e => openEdit(e, inst)}>Düzenle</button>
                        <button
                          style={{ background: "#FEE2E2", border: "none", borderRadius: 5, color: "#DC2626", cursor: "pointer", padding: "3px 8px", fontSize: 11, fontWeight: 600 }}
                          onClick={e => deleteInstallation(e, inst.id, inst.facilityName)}>Sil</button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {showModal && (
        <div style={s.modal} onClick={e => e.target === e.currentTarget && setShowModal(false)}>
          <div style={s.mCard}>
            <div style={s.mTitle}>{editingInst ? "Tesis Düzenle" : "Yeni Tesis Ekle"}</div>
            {error && <div style={s.err}>{error}</div>}
            <form onSubmit={saveInstallation}>
              <label style={s.label}>Tesis Adı *</label>
              <input style={s.input} value={form.facilityName}
                onChange={e => setForm(f => ({ ...f, facilityName: e.target.value }))} required />
              <label style={s.label}>Operatör *</label>
              <input style={s.input} value={form.operator}
                onChange={e => setForm(f => ({ ...f, operator: e.target.value }))} required />
              <label style={s.label}>Ülke (ISO-2) *</label>
              <input style={s.input} value={form.facilityCountry}
                onChange={e => setForm(f => ({ ...f, facilityCountry: e.target.value }))} maxLength={2} required />
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
                onChange={e => setForm(f => ({ ...f, facilityRef: e.target.value }))} placeholder="Opsiyonel" />
              <div style={s.row}>
                <button type="button" style={{ ...s.btn, ...s.btnS }} onClick={() => setShowModal(false)}>İptal</button>
                <button type="submit" style={{ ...s.btn, ...s.btnP }} disabled={saving}>
                  {saving ? "Kaydediliyor..." : editingInst ? "Güncelle" : "Kaydet"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
