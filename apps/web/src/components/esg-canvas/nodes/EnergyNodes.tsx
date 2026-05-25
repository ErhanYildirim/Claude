import { Handle, Position, NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { BaseNode, type BaseNodeData } from "./BaseNode.js";

type BND = Node<BaseNodeData>;

export const GridConnectionNode = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🔌", color: "#06b6d4" }} />;
export const SolarNode          = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "☀️", color: "#eab308" }} />;
export const WindNode           = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "💨", color: "#10b981" }} />;
export const HydroNode          = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "💧", color: "#3b82f6" }} />;
export const NaturalGasNode     = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🔥", color: "#f97316" }} />;
export const PPAContractNode    = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "📝", color: "#16a34a" }} />;

// ── ScopeGroupNode — yeniden boyutlandırılabilir Scope sınırı konteyneri ──
interface ScopeGroupData extends Record<string, unknown> {
  label: string;
  scope: 1 | 2 | 3;
}

const SCOPE_COLORS: Record<number, { bg: string; border: string; text: string }> = {
  1: { bg: "rgba(239,68,68,0.06)",  border: "#ef4444", text: "#ef4444" },
  2: { bg: "rgba(249,115,22,0.06)", border: "#f97316", text: "#f97316" },
  3: { bg: "rgba(234,179,8,0.06)",  border: "#eab308", text: "#ca8a04" },
};

export function ScopeGroupNode({ data, selected }: NodeProps<Node<ScopeGroupData>>) {
  const scope  = data.scope ?? 1;
  const colors = SCOPE_COLORS[scope] ?? SCOPE_COLORS[1];

  return (
    <div style={{
      background: colors.bg,
      border:     `2px dashed ${selected ? colors.border : colors.border + "88"}`,
      borderRadius: 12,
      width: "100%", height: "100%",
      minWidth: 200, minHeight: 120,
      position: "relative", boxSizing: "border-box",
    }}>
      <NodeResizer color={colors.border} isVisible={selected} minWidth={200} minHeight={120} />
      <Handle type="target" position={Position.Top}    style={{ background: colors.border }} />
      <Handle type="source" position={Position.Bottom} style={{ background: colors.border }} />
      <div style={{
        position: "absolute", top: 8, left: 12,
        fontSize: 12, fontWeight: 700, color: colors.text,
        pointerEvents: "none", userSelect: "none",
      }}>
        Scope {scope} — {data.label}
      </div>
    </div>
  );
}
