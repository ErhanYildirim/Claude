import { useState, useCallback } from "react";
import type { Node, Edge } from "@xyflow/react";

export type ViewMode = "organizational" | "dataflow" | "carbonflow" | "regulatory";

// Node/edge tipleri hangi modda görünür
const NODE_VISIBILITY: Record<ViewMode, Set<string>> = {
  organizational: new Set([
    "orgNode", "divisionNode", "facilityNode", "buildingNode", "processNode", "productNode", "vehicleFleetNode", "scopeGroupNode",
  ]),
  dataflow: new Set([
    "facilityNode", "meterNode", "apiSourceNode", "manualEntryNode",
    "emissionCalcNode", "cfMatchingNode", "cbamCalcNode", "cbamReportNode", "ghgReportNode",
    "gridNode", "solarNode", "windNode", "hydroNode", "naturalGasNode", "ppaContractNode",
  ]),
  carbonflow: new Set([
    "facilityNode", "processNode", "emissionCalcNode", "cbamCalcNode",
    "gridNode", "naturalGasNode", "vehicleFleetNode",
    "cbamReportNode", "ghgReportNode", "scopeGroupNode",
  ]),
  regulatory: new Set([
    "facilityNode", "processNode", "productNode",
    "scopeGroupNode", "cbamCalcNode", "cbamReportNode", "ghgReportNode",
  ]),
};

const EDGE_VISIBILITY: Record<ViewMode, Set<string>> = {
  organizational: new Set(["orgEdge"]),
  dataflow:       new Set(["dataFlowEdge", "energyFlowEdge"]),
  carbonflow:     new Set(["carbonFlowEdge", "energyFlowEdge"]),
  regulatory:     new Set(["carbonFlowEdge", "certFlowEdge"]),
};

export function useViewMode(allNodes: Node[], allEdges: Edge[]) {
  const [mode, setMode] = useState<ViewMode>("dataflow");

  const visibleNodes = allNodes.map(n => {
    const visible = NODE_VISIBILITY[mode].has(n.type ?? "");
    return { ...n, hidden: !visible };
  });

  const visibleEdges = allEdges.map(e => {
    const visible = EDGE_VISIBILITY[mode].has(e.type ?? "");
    // Carbon Flow modunda carbonFlowEdge → sankeyEdge olarak render et
    const effectiveType = (mode === "carbonflow" && e.type === "carbonFlowEdge")
      ? "sankeyEdge"
      : e.type;
    return { ...e, type: effectiveType, hidden: !visible };
  });

  const changeMode = useCallback((m: ViewMode) => setMode(m), []);

  return { mode, changeMode, visibleNodes, visibleEdges };
}

export const VIEW_MODE_LABELS: Record<ViewMode, { label: string; icon: string; desc: string }> = {
  organizational: { label: "Organizasyon",  icon: "🏢", desc: "Şirket hiyerarşisi" },
  dataflow:       { label: "Veri Akışı",    icon: "🔗", desc: "Sayaçlar ve veri kaynakları" },
  carbonflow:     { label: "Karbon Akışı",  icon: "🌡️", desc: "Emisyon akış şeması" },
  regulatory:     { label: "Regülatif",     icon: "⚖️", desc: "CBAM / GHG kapsam sınırları" },
};
