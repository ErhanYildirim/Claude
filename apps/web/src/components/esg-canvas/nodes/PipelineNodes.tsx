import { BaseNode, type BaseNodeData } from "./BaseNode.js";
import { type Node, type NodeProps } from "@xyflow/react";

type BND = Node<BaseNodeData>;

export const MeterNode        = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "⚡", color: "#8b5cf6" }} />;
export const ApiSourceNode    = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🔗", color: "#06b6d4" }} />;
export const ManualEntryNode  = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "📋", color: "#64748b" }} />;
export const CfMatchingNode   = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "⚖️", color: "#16a34a" }} />;
export const CbamCalcNode     = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🌍", color: "#dc2626" }} />;
export const CbamReportNode   = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "📄", color: "#b91c1c", subLabel: "Teknik Dosya" }} />;
export const GhgReportNode    = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "📊", color: "#7c3aed", subLabel: "GHG Raporu" }} />;

export const EmissionCalcNode = (p: NodeProps<BND>) => (
  <BaseNode
    {...p}
    data={{
      ...p.data,
      icon:     "🧮",
      color:    "#ef4444",
      subLabel: p.data.subLabel ?? "tCO₂e/yıl",
    }}
  />
);
