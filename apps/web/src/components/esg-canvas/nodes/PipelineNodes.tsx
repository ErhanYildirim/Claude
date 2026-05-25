import { BaseNode, type BaseNodeData } from "./BaseNode.js";
import { type Node, type NodeProps } from "@xyflow/react";

type BND = Node<BaseNodeData>;

export const ApiSourceNode    = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🔗", color: "#06b6d4" }} />;
export const ManualEntryNode  = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "📋", color: "#64748b" }} />;
export const CbamCalcNode     = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "🌍", color: "#dc2626" }} />;
export const CbamReportNode   = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "📄", color: "#b91c1c", subLabel: "Teknik Dosya" }} />;
export const GhgReportNode    = (p: NodeProps<BND>) => <BaseNode {...p} data={{ ...p.data, icon: "📊", color: "#7c3aed", subLabel: "GHG Raporu" }} />;

function daysAgoLabel(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 60)  return `${mins}dk`;
  const hrs = Math.floor(mins / 60);
  if (hrs  < 24)  return `${hrs}s`;
  return `${Math.floor(hrs / 24)}g`;
}

export const MeterNode = (p: NodeProps<BND>) => {
  const lastDataAt = p.data.lastDataAt as string | undefined;
  const daysOld    = lastDataAt ? Math.floor((Date.now() - new Date(lastDataAt).getTime()) / 86_400_000) : null;
  return (
    <BaseNode
      {...p}
      data={{
        ...p.data, icon: "⚡", color: "#8b5cf6",
        subLabel:  lastDataAt ? `Veri: ${daysAgoLabel(lastDataAt)} önce` : (p.data.subLabel as string | undefined),
        badge:     p.data.badge as string | undefined ?? (lastDataAt ? (daysOld! > 30 ? "⚠" : "✓") : undefined),
        badgeColor: p.data.badgeColor as string | undefined ?? (lastDataAt ? (daysOld! > 30 ? "#f59e0b" : "#10b981") : undefined),
      }}
    />
  );
};

export const EmissionCalcNode = (p: NodeProps<BND>) => {
  const val = p.data.lastEmissionValue as number | undefined;
  const at  = p.data.lastCalculatedAt  as string | undefined;
  return (
    <BaseNode
      {...p}
      data={{
        ...p.data, icon: "🧮", color: "#ef4444",
        liveValue: val != null ? `${Number(val).toFixed(2)} tCO₂e` : (p.data.liveValue as string | undefined),
        subLabel:  at ? `${daysAgoLabel(at)} önce` : (p.data.subLabel as string | undefined ?? "tCO₂e/yıl"),
        badge:     p.data.badge as string | undefined ?? (at ? "✓" : undefined),
        badgeColor: p.data.badgeColor as string | undefined ?? (at ? "#10b981" : undefined),
      }}
    />
  );
};

export const CfMatchingNode = (p: NodeProps<BND>) => {
  const score = p.data.cfeScore as number | undefined;
  const at    = p.data.lastRunAt  as string | undefined;
  const color = score != null ? (score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444") : "#16a34a";
  return (
    <BaseNode
      {...p}
      data={{
        ...p.data, icon: "⚖️", color: "#16a34a",
        liveValue:  score != null ? `${Number(score).toFixed(1)}% CFE` : (p.data.liveValue as string | undefined),
        subLabel:   at ? `${daysAgoLabel(at)} önce` : (p.data.subLabel as string | undefined),
        badge:      p.data.badge as string | undefined ?? (at ? "✓" : undefined),
        badgeColor: p.data.badgeColor as string | undefined ?? (score != null ? color : undefined),
      }}
    />
  );
};
