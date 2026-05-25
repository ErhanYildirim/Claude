import { useNavigate } from "react-router-dom";
import type { Node, ReactFlowInstance } from "@xyflow/react";

interface Props {
  node: Node;
  rfInstance: ReactFlowInstance;
  isDark: boolean;
  onDelete: (node: Node) => void;
  onDuplicate: (node: Node) => void;
}

interface ActionDef {
  label: string;
  icon: string;
  onClick: () => void;
  danger?: boolean;
}

export function CanvasActionBar({ node, rfInstance, isDark, onDelete, onDuplicate }: Props) {
  const navigate = useNavigate();

  const card   = isDark ? "#1e2530" : "#ffffff";
  const border = isDark ? "#2d3748" : "#e2e8f0";
  const text   = isDark ? "#f1f5f9" : "#1e293b";

  const sourceId   = node.data?.sourceId   as string | undefined;
  const sourceType = node.data?.sourceType as string | undefined;

  // Platforma Git URL
  function platformPath(): string | null {
    if (!sourceId) return null;
    if (sourceType === "installation") return `/installations/${sourceId}`;
    if (sourceType === "cbamFacility")  return `/cbam/facilities/${sourceId}`;
    if (sourceType === "cbamProduct")   return `/cbam`;
    return null;
  }

  // Node tipine göre aksiyon listesi
  const actions: ActionDef[] = [];

  if (platformPath()) {
    actions.push({ label: "Git", icon: "→", onClick: () => navigate(platformPath()!) });
  }

  // Tip bazlı özel aksiyonlar
  if (node.type === "facilityNode" || node.type === "meterNode") {
    actions.push({ label: "Veri Gir", icon: "📊", onClick: () => navigate("/import") });
  }
  if (node.type === "cbamReportNode" || node.type === "productNode") {
    actions.push({ label: "CBAM", icon: "🌍", onClick: () => navigate("/reports/cbam") });
  }
  if (node.type === "ghgReportNode") {
    actions.push({ label: "GHG", icon: "🌡️", onClick: () => navigate("/reports/ghg") });
  }
  if (node.type === "cfMatchingNode") {
    actions.push({ label: "CFE", icon: "⚡", onClick: () => navigate("/cfe") });
  }

  actions.push({ label: "Kopyala", icon: "⎘", onClick: () => onDuplicate(node) });
  actions.push({ label: "Sil", icon: "🗑", onClick: () => onDelete(node), danger: true });

  // Node pozisyonunu screen koordinatına çevir
  const screenPos = rfInstance.flowToScreenPosition({
    x: node.position.x + ((node.measured?.width ?? 180) / 2),
    y: node.position.y,
  });

  return (
    <div
      style={{
        position: "fixed",
        left: screenPos.x,
        top: screenPos.y - 48,
        transform: "translateX(-50%)",
        zIndex: 800,
        display: "flex",
        background: card,
        border: `1px solid ${border}`,
        borderRadius: 8,
        boxShadow: "0 4px 16px rgba(0,0,0,0.18)",
        overflow: "hidden",
        pointerEvents: "auto",
      }}
    >
      {actions.map((a, i) => (
        <button
          key={i}
          onMouseDown={e => { e.preventDefault(); e.stopPropagation(); }}
          onClick={e => { e.preventDefault(); e.stopPropagation(); a.onClick(); }}
          title={a.label}
          style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "6px 10px",
            background: "transparent",
            border: "none",
            borderRight: i < actions.length - 1 ? `1px solid ${border}` : "none",
            cursor: "pointer",
            color: a.danger ? "#ef4444" : text,
            fontSize: 11, fontWeight: 500,
            whiteSpace: "nowrap",
          }}
          onMouseEnter={e => { e.currentTarget.style.background = a.danger ? "#fef2f2" : (isDark ? "#2d3748" : "#f8fafc"); }}
          onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
        >
          <span>{a.icon}</span>
          <span>{a.label}</span>
        </button>
      ))}
    </div>
  );
}
