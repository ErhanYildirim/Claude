import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { BaseNode, type BaseNodeData } from "./BaseNode.js";

type BND = Node<BaseNodeData>;

export const OrgNode          = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🏢", color: "#64748b" }} />;
export const DivisionNode     = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🏬", color: "#6366f1" }} />;
export const FacilityNode = (p: NodeProps<BND>) => {
  const bound = !!(p.data.sourceId as string | undefined);
  return (
    <BaseNode
      {...p}
      data={{
        ...p.data, icon: "🏭", color: "#3b82f6",
        badge:      p.data.badge as string | undefined ?? (bound ? "✓" : "!"),
        badgeColor: p.data.badgeColor as string | undefined ?? (bound ? "#10b981" : "#f59e0b"),
      }}
    />
  );
};

export const ProductNode = (p: NodeProps<BND>) => {
  const bound = !!(p.data.sourceId as string | undefined);
  return (
    <BaseNode
      {...p}
      data={{
        ...p.data, icon: "📦", color: "#8b5cf6",
        badge:      p.data.badge as string | undefined ?? (bound ? "✓" : "!"),
        badgeColor: p.data.badgeColor as string | undefined ?? (bound ? "#10b981" : "#f59e0b"),
      }}
    />
  );
};

export const BuildingNode = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🏗️", color: "#0ea5e9" }} />;
export const ProcessNode  = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "⚙️", color: "#f97316" }} />;

// VehicleFleetNode — özel görünüm (Scope 1 etiketi)
interface FleetData extends BaseNodeData { scope?: string; }
type FleetNode = Node<FleetData>;

export function VehicleFleetNode({ data, selected }: NodeProps<FleetNode>) {
  const dark   = document.documentElement.getAttribute("data-theme") === "dark";
  const card   = dark ? "#1a1d27" : "#ffffff";
  const text   = dark ? "#f1f5f9" : "#1e293b";
  const sub    = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "#2d3748" : "#e2e8f0";
  const color  = "#dc2626";

  return (
    <div style={{
      background: card, border: `1.5px solid ${selected ? color : border}`,
      borderLeft: `4px solid ${color}`, borderRadius: 10,
      padding: "10px 14px", minWidth: 160, maxWidth: 220,
      boxShadow: selected ? `0 0 0 2px ${color}33` : "0 1px 4px rgba(0,0,0,0.12)",
    }}>
      <Handle type="target" position={Position.Top}    style={{ background: color }} />
      <Handle type="source" position={Position.Bottom} style={{ background: color }} />
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 20 }}>🚛</span>
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: text }}>{data.label}</div>
          {data.subLabel && <div style={{ fontSize: 11, color: sub }}>{data.subLabel}</div>}
          <div style={{
            fontSize: 10, color: "#fff", background: color,
            padding: "1px 5px", borderRadius: 3, display: "inline-block", marginTop: 3,
          }}>
            Scope 1
          </div>
        </div>
      </div>
    </div>
  );
}
