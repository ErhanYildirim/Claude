import { useState } from "react";
import { api } from "../../lib/api.js";
import type { Node } from "@xyflow/react";

interface Props {
  node: Node;
  isDark: boolean;
  onDeleteNode: () => void;        // sadece canvas'tan sil
  onDeleteCascade: () => void;     // canvas + platform sil
  onCancel: () => void;
}

const SOURCE_TYPE_LABELS: Record<string, string> = {
  installation: "Tesis (GEC)",
  cbamFacility: "CBAM Tesisi",
  cbamProduct:  "CBAM Ürünü",
};

export function DeleteNodeDialog({ node, isDark, onDeleteNode, onDeleteCascade, onCancel }: Props) {
  const [deletingPlatform, setDeletingPlatform] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const card    = isDark ? "#1a1d27" : "#ffffff";
  const text    = isDark ? "#f1f5f9" : "#1e293b";
  const sub     = isDark ? "#94a3b8" : "#64748b";
  const border  = isDark ? "#2d3748" : "#e2e8f0";
  const overlay = isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)";

  const sourceId   = node.data?.sourceId as string | undefined;
  const sourceType = node.data?.sourceType as string | undefined;
  const label      = node.data?.label as string ?? node.id;
  const sourceName = sourceType ? SOURCE_TYPE_LABELS[sourceType] : undefined;

  async function handleCascadeDelete() {
    if (!sourceId || !sourceType) return;
    setDeletingPlatform(true);
    setError(null);
    try {
      if (sourceType === "installation") {
        await api.installations.delete(sourceId);
      } else if (sourceType === "cbamFacility") {
        await api.cbamFacilities.delete(sourceId);
      } else if (sourceType === "cbamProduct") {
        // CBAM ürün silme için facilityId gerekli — node.data'dan al
        const facilityId = node.data?.facilityId as string | undefined;
        if (!facilityId) throw new Error("Tesis ID bulunamadı");
        await api.cbamProducts.delete(facilityId, sourceId);
      }
      onDeleteCascade();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Platform kaynağı silinemedi.");
    } finally {
      setDeletingPlatform(false);
    }
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: overlay, zIndex: 9500,
        display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div style={{
        background: card, borderRadius: 14, border: `1px solid ${border}`,
        width: "100%", maxWidth: 420, padding: "24px",
        boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
      }}>
        <div style={{ fontSize: 16, fontWeight: 700, color: text, marginBottom: 6 }}>
          Node'u Sil
        </div>
        <div style={{ fontSize: 13, color: sub, marginBottom: 20, lineHeight: 1.5 }}>
          <strong style={{ color: text }}>"{label}"</strong> node'unu silmek istiyorsunuz.
          {sourceId && sourceName && (
            <> Bu node <strong style={{ color: text }}>{sourceName}</strong> kaynağına bağlı.</>
          )}
        </div>

        {error && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
            padding: "8px 12px", marginBottom: 14, fontSize: 12, color: "#dc2626",
          }}>
            {error}
          </div>
        )}

        {/* Option 1: Sadece node'u sil */}
        <button
          onClick={onDeleteNode}
          style={{
            width: "100%", padding: "10px 14px", borderRadius: 8, marginBottom: 8,
            border: `1px solid ${border}`, background: "transparent",
            color: text, fontSize: 13, fontWeight: 500, cursor: "pointer",
            textAlign: "left" as const, display: "flex", alignItems: "flex-start",
            flexDirection: "column" as const, gap: 2,
          }}
        >
          <span style={{ fontWeight: 600 }}>Sadece node'u sil</span>
          <span style={{ fontSize: 11, color: sub }}>
            Canvas'tan kaldırılır — {sourceName ?? "platform verisi"} korunur
          </span>
        </button>

        {/* Option 2: Cascade (yalnızca bağlı kaynak varsa) */}
        {sourceId && sourceType && (
          <>
            <button
              onClick={handleCascadeDelete}
              disabled={deletingPlatform}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8, marginBottom: 12,
                border: "1px solid #fecaca",
                background: deletingPlatform ? "#f3f4f6" : "#fef2f2",
                color: deletingPlatform ? "#9ca3af" : "#dc2626",
                fontSize: 13, fontWeight: 500, cursor: deletingPlatform ? "default" : "pointer",
                textAlign: "left" as const, display: "flex", alignItems: "flex-start",
                flexDirection: "column" as const, gap: 2,
              }}
            >
              <span style={{ fontWeight: 600 }}>
                {deletingPlatform ? "Siliniyor..." : `Node + ${sourceName} sil`}
              </span>
              <span style={{ fontSize: 11 }}>
                ⚠ Platform kaynağı da kalıcı olarak silinir — geri alınamaz
              </span>
            </button>
            <div style={{
              fontSize: 11, color: sub, padding: "8px 10px",
              background: isDark ? "#1e2530" : "#f8fafc",
              borderRadius: 6, marginBottom: 14, lineHeight: 1.4,
            }}>
              Platform kaynağı silinirse bağlı tüm hesaplamalar ve raporlar da etkilenir.
            </div>
          </>
        )}

        <button
          onClick={onCancel}
          style={{
            width: "100%", padding: "8px 14px", borderRadius: 8,
            border: `1px solid ${border}`, background: "transparent",
            color: sub, fontSize: 13, cursor: "pointer",
          }}
        >
          İptal
        </button>
      </div>
    </div>
  );
}
