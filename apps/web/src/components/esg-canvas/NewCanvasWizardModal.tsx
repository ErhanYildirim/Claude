import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import type { EsgTemplate } from "../../lib/api.js";

interface Props {
  onClose: () => void;
  onCreated: (graphId: string) => void;
  isDark: boolean;
}

const BUILTIN_TEMPLATES = [
  {
    key: "blank",
    name: "Boş Canvas",
    description: "Sıfırdan kendi akışınızı oluşturun",
    icon: "🕸️",
    category: "blank",
  },
  {
    key: "auto-generate",
    name: "Şirketten Oluştur",
    description: "Mevcut tesis ve CBAM verilerinden otomatik canvas oluştur",
    icon: "✨",
    category: "auto",
  },
  {
    key: "cfe-24-7-matching",
    name: "24/7 CFE Matching",
    description: "Saatlik tüketim-üretim eşleştirme akışı — solar/wind + PPA + CFE skoru",
    icon: "⚡",
    category: "cfe",
  },
  {
    key: "cbam-actual-emissions",
    name: "CBAM Actual Emissions",
    description: "Ürün bazında gömülü emisyon hesabı — CBAM Ek IV akışı",
    icon: "🌍",
    category: "cbam",
  },
  {
    key: "ghg-protocol-scope123",
    name: "GHG Protocol Scope 1+2+3",
    description: "GHG Protocol kapsamlı emisyon envanteri — tüm scope'lar",
    icon: "🌡️",
    category: "ghg",
  },
  {
    key: "org-structure",
    name: "Organizasyon Yapısı",
    description: "Şirket hiyerarşisi — birim, tesis, proses ağacı",
    icon: "🏢",
    category: "org",
  },
];

export function NewCanvasWizardModal({ onClose, onCreated, isDark }: Props) {
  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";
  const overlay = isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)";

  const [selected, setSelected]   = useState<string>("blank");
  const [name, setName]           = useState("");
  const [creating, setCreating]   = useState(false);
  const [error, setError]         = useState<string | null>(null);
  const [templates, setTemplates] = useState<EsgTemplate[]>([]);

  useEffect(() => {
    api.esgPlayground.templates.list()
      .then(t => setTemplates(t))
      .catch(() => { /* şablonlar yüklenemedi, builtin'ler gösterilir */ });
  }, []);

  // Seçili şablonun adını input'a otomatik doldur
  useEffect(() => {
    const tpl = BUILTIN_TEMPLATES.find(t => t.key === selected);
    if (!tpl || tpl.key === "blank" || tpl.key === "auto-generate") setName("");
    else setName(tpl.name);
  }, [selected]);

  async function handleCreate() {
    setCreating(true);
    setError(null);
    try {
      const finalName = name.trim() || (BUILTIN_TEMPLATES.find(t => t.key === selected)?.name ?? "Yeni Canvas");

      if (selected === "blank") {
        const g = await api.esgPlayground.create({ name: finalName });
        onCreated(g.id);
        return;
      }

      if (selected === "auto-generate") {
        const result = await api.esgPlayground.generateFromCompany({ name: finalName });
        onCreated(result.graph.id);
        return;
      }

      // Şablon clone
      const g = await api.esgPlayground.templates.clone(selected, { name: finalName });
      onCreated(g.id);
    } catch {
      setError("Canvas oluşturulamadı. Lütfen tekrar deneyin.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: overlay, zIndex: 9000,
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px",
      }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{
        background: card, borderRadius: 16, border: `1px solid ${border}`,
        width: "100%", maxWidth: 620, padding: "28px 28px 24px",
        boxShadow: "0 20px 60px rgba(0,0,0,0.3)",
      }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 20 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: text }}>Yeni Canvas Oluştur</h2>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: sub }}>
              Bir şablon seçin veya sıfırdan başlayın
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", color: sub, fontSize: 20, lineHeight: 1, padding: "2px 4px" }}
          >×</button>
        </div>

        {/* Template grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 20 }}>
          {BUILTIN_TEMPLATES.map(tpl => {
            const isSelected = selected === tpl.key;
            return (
              <div
                key={tpl.key}
                onClick={() => setSelected(tpl.key)}
                style={{
                  padding: "14px", borderRadius: 10, cursor: "pointer",
                  border: `2px solid ${isSelected ? "#10b981" : border}`,
                  background: isSelected ? (isDark ? "rgba(16,185,129,0.1)" : "rgba(16,185,129,0.06)") : "transparent",
                  transition: "border-color 0.15s, background 0.15s",
                  display: "flex", gap: 10, alignItems: "flex-start",
                }}
                onMouseEnter={e => { if (!isSelected) e.currentTarget.style.borderColor = "#10b98180"; }}
                onMouseLeave={e => { if (!isSelected) e.currentTarget.style.borderColor = border; }}
              >
                <span style={{ fontSize: 22, flexShrink: 0 }}>{tpl.icon}</span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: text, marginBottom: 2 }}>{tpl.name}</div>
                  <div style={{ fontSize: 11, color: sub, lineHeight: 1.4 }}>{tpl.description}</div>
                </div>
                {isSelected && (
                  <span style={{ marginLeft: "auto", flexShrink: 0, color: "#10b981", fontSize: 14 }}>✓</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Name input */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 600, color: sub, display: "block", marginBottom: 6 }}>
            Canvas Adı
          </label>
          <input
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Örn: Q4 2025 CFE Akışı"
            onKeyDown={e => { if (e.key === "Enter" && !creating) handleCreate(); }}
            style={{
              width: "100%", padding: "9px 12px", borderRadius: 8,
              border: `1px solid ${border}`, background: "transparent",
              color: text, fontSize: 14, outline: "none", boxSizing: "border-box",
            }}
            onFocus={e => (e.currentTarget.style.borderColor = "#10b981")}
            onBlur={e => (e.currentTarget.style.borderColor = border)}
            autoFocus
          />
        </div>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
            padding: "8px 12px", marginBottom: 12, fontSize: 12, color: "#dc2626",
          }}>
            {error}
          </div>
        )}

        {/* Actions */}
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "8px 18px", borderRadius: 8, border: `1px solid ${border}`,
              background: "transparent", color: text, fontSize: 14,
              fontWeight: 500, cursor: "pointer",
            }}
          >
            İptal
          </button>
          <button
            onClick={handleCreate}
            disabled={creating}
            style={{
              padding: "8px 20px", borderRadius: 8, border: "none",
              background: creating ? "#6b7280" : "#10b981", color: "#fff",
              fontSize: 14, fontWeight: 600, cursor: creating ? "default" : "pointer",
              minWidth: 100,
            }}
          >
            {creating ? "Oluşturuluyor..." : "Canvas Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}
