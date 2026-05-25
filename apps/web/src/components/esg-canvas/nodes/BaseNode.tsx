import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";

export interface BaseNodeData extends Record<string, unknown> {
  label:      string;
  subLabel?:  string;
  icon:       string;
  color:      string;
  badge?:     string;
  badgeColor?: string;
  liveValue?: string;
}

export type BaseNodeType = Node<BaseNodeData>;

const isDark = () => document.documentElement.getAttribute("data-theme") === "dark";

export function BaseNode({ data, selected }: NodeProps<BaseNodeType>) {
  const dark   = isDark();
  const card   = dark ? "#1a1d27" : "#ffffff";
  const text   = dark ? "#f1f5f9" : "#1e293b";
  const sub    = dark ? "#94a3b8" : "#64748b";
  const border = dark ? "#2d3748" : "#e2e8f0";

  return (
    <div style={{
      background: card,
      border: `1.5px solid ${selected ? data.color : border}`,
      borderLeft: `4px solid ${data.color}`,
      borderRadius: 10,
      padding: "10px 14px",
      minWidth: 160,
      maxWidth: 220,
      boxShadow: selected ? `0 0 0 2px ${data.color}33` : "0 1px 4px rgba(0,0,0,0.12)",
      position: "relative",
    }}>
      <Handle type="target" position={Position.Top}    style={{ background: data.color }} />
      <Handle type="source" position={Position.Bottom} style={{ background: data.color }} />
      <Handle type="target" position={Position.Left}   id="left-in"   style={{ background: data.color }} />
      <Handle type="source" position={Position.Right}  id="right-out" style={{ background: data.color }} />

      <div style={{ display: "flex", alignItems: "flex-start", gap: 8 }}>
        <span style={{ fontSize: 20, lineHeight: 1.2, flexShrink: 0 }}>{data.icon}</span>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: text, lineHeight: 1.3, wordBreak: "break-word" }}>
            {data.label}
          </div>
          {data.subLabel && (
            <div style={{ fontSize: 11, color: sub, marginTop: 2 }}>{data.subLabel}</div>
          )}
          {data.liveValue && (
            <div style={{
              fontSize: 11, color: data.color, fontWeight: 600,
              marginTop: 4, padding: "1px 6px",
              background: `${data.color}18`, borderRadius: 4,
              display: "inline-block",
            }}>
              {data.liveValue}
            </div>
          )}
        </div>
      </div>

      {data.badge && (
        <div style={{
          position: "absolute", top: -6, right: -6,
          background: data.badgeColor ?? "#ef4444",
          color: "#fff", borderRadius: 99,
          fontSize: 10, fontWeight: 700,
          padding: "1px 5px", lineHeight: 1.4,
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
        }}>
          {data.badge}
        </div>
      )}
    </div>
  );
}
