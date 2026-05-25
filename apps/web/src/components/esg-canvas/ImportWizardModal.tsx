import { useState } from "react";
import { api } from "../../lib/api.js";
import type { Node, Edge } from "@xyflow/react";

type Layout = "hierarchy" | "dataflow" | "geographic";

interface ImportWizardModalProps {
  onImport: (nodes: Node[], edges: Edge[]) => void;
  onClose:  () => void;
  card:     string;
  text:     string;
  sub:      string;
  border:   string;
}

export function ImportWizardModal({ onImport, onClose, card, text, sub, border }: ImportWizardModalProps) {
  const [step, setStep]         = useState<1 | 2 | 3>(1);
  const [mode]                  = useState<"all">("all");
  const [layout, setLayout]     = useState<Layout>("dataflow");
  const [loading, setLoading]   = useState(false);
  const [preview, setPreview]   = useState<{
    summary: { installations: number; nodesWillCreate: number; edgesWillCreate: number };
    nodes: unknown[]; edges: unknown[];
  } | null>(null);

  async function loadPreview() {
    setLoading(true);
    try {
      const data = await api.esgPlayground.importPreview(mode);
      setPreview(data);
      setStep(2);
    } finally {
      setLoading(false);
    }
  }

  function applyLayout(rawNodes: unknown[]): Node[] {
    const nodes = rawNodes as Node[];
    if (layout === "hierarchy") {
      // Org hiyerarşisi: facilityNode'ları dikey sütunda diz
      let y = 100;
      return nodes.map((n, i) => {
        if (n.type === "facilityNode") {
          const positioned = { ...n, position: { x: 300 + (i % 3) * 320, y } };
          if (i % 3 === 2) y += 180;
          return positioned;
        }
        return n;
      });
    }
    if (layout === "dataflow") {
      // Scope grupları solda, tesisler ortada, calc/output sağda
      return nodes.map(n => {
        if (n.type === "scopeGroupNode") return { ...n, position: { x: 20, y: (n.data?.scope as number ?? 1) * 140 - 120 } };
        return n;
      });
    }
    // geographic: mevcut pozisyonları koru
    return nodes;
  }

  function handleApply() {
    if (!preview) return;
    const nodes = applyLayout(preview.nodes);
    onImport(nodes, preview.edges as Edge[]);
    onClose();
  }

  const LAYOUT_OPTIONS: { key: Layout; label: string; icon: string; desc: string }[] = [
    { key: "hierarchy", icon: "🏛️", label: "Hiyerarşik",     desc: "Şirket → Bölüm → Tesis" },
    { key: "dataflow",  icon: "🔗", label: "Veri Akışı",      desc: "Tesisler ortada, hesaplamalar sağda" },
    { key: "geographic", icon: "🗺️", label: "Coğrafi Küme",   desc: "Ülke/konum bilgisine göre grupla" },
  ];

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
    }}>
      <div style={{
        background: card, borderRadius: 16, padding: "28px 32px",
        width: 520, maxWidth: "90vw",
        border: `1px solid ${border}`,
        boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
      }}>
        {/* Başlık */}
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: text }}>
              Platform İçe Aktarma
            </h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: sub }}>
              Adım {step} / 3
            </p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: sub, cursor: "pointer", fontSize: 20 }}>×</button>
        </div>

        {/* Step 1 — Kaynak seç */}
        {step === 1 && (
          <div>
            <p style={{ fontSize: 14, color: text, marginBottom: 16 }}>
              Platforma kayıtlı tesisler, sayaçlar ve organizasyon verilerini otomatik canvas'a dönüştürün.
            </p>
            <div style={{
              padding: "14px 16px", borderRadius: 8, border: `1px solid ${border}`,
              marginBottom: 16, fontSize: 13, color: sub,
            }}>
              <strong style={{ color: text }}>Tüm Tesisler</strong>
              <br />Platformdaki tüm Installation kayıtları ve bağlı Meter/Organization verileri
            </div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button onClick={onClose} style={{ padding: "8px 16px", borderRadius: 6, border: `1px solid ${border}`, background: "none", color: text, cursor: "pointer" }}>
                İptal
              </button>
              <button
                onClick={loadPreview}
                disabled={loading}
                style={{
                  padding: "8px 20px", borderRadius: 6, border: "none",
                  background: "#3b82f6", color: "#fff", cursor: loading ? "wait" : "pointer",
                  fontWeight: 600, fontSize: 13,
                }}
              >
                {loading ? "Yükleniyor..." : "Önizle →"}
              </button>
            </div>
          </div>
        )}

        {/* Step 2 — Önizle */}
        {step === 2 && preview && (
          <div>
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20,
            }}>
              {[
                { label: "Tesis", value: preview.summary.installations },
                { label: "Node", value: preview.summary.nodesWillCreate },
                { label: "Bağlantı", value: preview.summary.edgesWillCreate },
              ].map(s => (
                <div key={s.label} style={{
                  textAlign: "center", padding: "12px", borderRadius: 8,
                  border: `1px solid ${border}`,
                }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: "#3b82f6" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: sub }}>{s.label}</div>
                </div>
              ))}
            </div>
            <p style={{ fontSize: 12, color: sub, marginBottom: 16 }}>
              Scope 1/2/3 sınır grupları, tesis node'ları ve bağlantılar otomatik oluşturulacak.
            </p>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep(1)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "none", color: text, cursor: "pointer" }}>
                ← Geri
              </button>
              <button
                onClick={() => setStep(3)}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#3b82f6", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                Düzen Seç →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Düzen seç */}
        {step === 3 && (
          <div>
            <div style={{ marginBottom: 16 }}>
              {LAYOUT_OPTIONS.map(opt => (
                <div
                  key={opt.key}
                  onClick={() => setLayout(opt.key)}
                  style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 12px", borderRadius: 8, marginBottom: 8, cursor: "pointer",
                    border: `1.5px solid ${layout === opt.key ? "#3b82f6" : border}`,
                    background: layout === opt.key ? "rgba(59,130,246,0.07)" : "transparent",
                  }}
                >
                  <span style={{ fontSize: 22 }}>{opt.icon}</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{opt.label}</div>
                    <div style={{ fontSize: 11, color: sub }}>{opt.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <button onClick={() => setStep(2)} style={{ padding: "8px 14px", borderRadius: 6, border: `1px solid ${border}`, background: "none", color: text, cursor: "pointer" }}>
                ← Geri
              </button>
              <button
                onClick={handleApply}
                style={{ padding: "8px 20px", borderRadius: 6, border: "none", background: "#10b981", color: "#fff", cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                Canvas Oluştur ✓
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
