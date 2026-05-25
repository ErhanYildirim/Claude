import {
  BaseEdge, EdgeLabelRenderer, getStraightPath, getBezierPath,
  type EdgeProps, type Edge,
} from "@xyflow/react";

// ── Shared animated dash style ─────────────────────────────────────────────
const DASH_ANIMATION = `
@keyframes dashFlow {
  from { stroke-dashoffset: 24; }
  to   { stroke-dashoffset: 0;  }
}
`;

function injectStyle(id: string, css: string) {
  if (typeof document === "undefined") return;
  if (document.getElementById(id)) return;
  const s = document.createElement("style");
  s.id = id;
  s.textContent = css;
  document.head.appendChild(s);
}

interface LabeledEdgeProps extends EdgeProps {
  data?: { label?: string; weight?: number };
}

function EdgeLabel({ x, y, label }: { x: number; y: number; label: string }) {
  return (
    <EdgeLabelRenderer>
      <div style={{
        position: "absolute",
        transform: `translate(-50%, -50%) translate(${x}px, ${y}px)`,
        fontSize: 10, background: "#0f111799", color: "#fff",
        padding: "1px 5px", borderRadius: 3, pointerEvents: "none",
        whiteSpace: "nowrap",
      }}>
        {label}
      </div>
    </EdgeLabelRenderer>
  );
}

// ── 1. energyFlowEdge — elektrik akışı (mavi, animasyonlu) ────────────────
export function EnergyFlowEdge(props: LabeledEdgeProps) {
  injectStyle("dash-anim", DASH_ANIMATION);
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge path={path} style={{
        stroke: "#3b82f6", strokeWidth: 2,
        strokeDasharray: "6 6",
        animation: "dashFlow 0.8s linear infinite",
      }} />
      {props.data?.label && <EdgeLabel x={lx} y={ly} label={props.data.label} />}
    </>
  );
}

// ── 2. dataFlowEdge — veri akışı (mor, ince noktalı) ─────────────────────
export function DataFlowEdge(props: LabeledEdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge path={path} style={{
        stroke: "#8b5cf6", strokeWidth: 1.5,
        strokeDasharray: "2 4",
      }} />
      {props.data?.label && <EdgeLabel x={lx} y={ly} label={props.data.label} />}
    </>
  );
}

// ── 3. carbonFlowEdge — karbon akışı (kırmızı, kalın) ─────────────────────
export function CarbonFlowEdge(props: LabeledEdgeProps) {
  injectStyle("dash-anim", DASH_ANIMATION);
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  const weight = props.data?.weight ?? 1;
  const width  = Math.max(2, Math.min(12, weight * 0.02));
  return (
    <>
      <BaseEdge path={path} style={{
        stroke: "#ef4444", strokeWidth: width,
        strokeDasharray: "8 4",
        animation: "dashFlow 1s linear infinite",
        opacity: 0.85,
      }} />
      {props.data?.label && <EdgeLabel x={lx} y={ly} label={`${props.data.label} tCO₂e`} />}
    </>
  );
}

// ── 4. certFlowEdge — sertifika akışı (yeşil, trakt) ─────────────────────
export function CertFlowEdge(props: LabeledEdgeProps) {
  const { sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition } = props;
  const [path, lx, ly] = getBezierPath({ sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition });
  return (
    <>
      <BaseEdge path={path} style={{
        stroke: "#16a34a", strokeWidth: 2,
        strokeDasharray: "10 3 2 3",
      }} />
      {props.data?.label && <EdgeLabel x={lx} y={ly} label={props.data.label} />}
    </>
  );
}

// ── 5. orgEdge — organizasyon hiyerarşisi (gri, düz çizgi) ───────────────
export function OrgEdge(props: LabeledEdgeProps) {
  const { sourceX, sourceY, targetX, targetY } = props;
  const [path] = getStraightPath({ sourceX, sourceY, targetX, targetY });
  return (
    <BaseEdge path={path} style={{ stroke: "#64748b", strokeWidth: 1.5 }} />
  );
}

// ── edgeTypes haritası ─────────────────────────────────────────────────────
import { SankeyEdge } from "./SankeyEdge.js";

export const edgeTypes = {
  energyFlowEdge: EnergyFlowEdge,
  dataFlowEdge:   DataFlowEdge,
  carbonFlowEdge: CarbonFlowEdge,
  certFlowEdge:   CertFlowEdge,
  orgEdge:        OrgEdge,
  sankeyEdge:     SankeyEdge,
} as const;

// ── Bağlantı doğrulama kuralları ────────────────────────────────────────────
// hangi node tipi hangi tipler ile bağlanabilir
const ALLOWED_CONNECTIONS: Record<string, string[]> = {
  // Org → Division → Facility → Process/Building
  orgNode:          ["divisionNode", "facilityNode"],
  divisionNode:     ["facilityNode", "buildingNode"],
  facilityNode:     ["processNode", "buildingNode", "meterNode", "gridNode", "solarNode", "windNode", "hydroNode", "naturalGasNode", "emissionCalcNode"],
  buildingNode:     ["meterNode", "processNode"],
  processNode:      ["productNode", "meterNode", "emissionCalcNode", "cbamCalcNode"],
  productNode:      ["cbamCalcNode", "cbamReportNode"],
  vehicleFleetNode: ["emissionCalcNode"],
  // Energy sources → consumption nodes
  gridNode:         ["facilityNode", "buildingNode", "processNode", "meterNode", "emissionCalcNode"],
  solarNode:        ["facilityNode", "buildingNode", "processNode", "emissionCalcNode", "cfMatchingNode"],
  windNode:         ["facilityNode", "buildingNode", "processNode", "emissionCalcNode", "cfMatchingNode"],
  hydroNode:        ["facilityNode", "emissionCalcNode", "cfMatchingNode"],
  naturalGasNode:   ["facilityNode", "processNode", "emissionCalcNode"],
  ppaContractNode:  ["cfMatchingNode", "cbamCalcNode"],
  // Meters → calc
  meterNode:        ["emissionCalcNode", "cfMatchingNode", "cbamCalcNode", "apiSourceNode", "manualEntryNode"],
  apiSourceNode:    ["meterNode", "emissionCalcNode"],
  manualEntryNode:  ["meterNode", "emissionCalcNode"],
  // Calc → output
  emissionCalcNode: ["cbamCalcNode", "ghgReportNode", "cfMatchingNode"],
  cfMatchingNode:   ["emissionCalcNode", "cbamCalcNode", "cbamReportNode"],
  cbamCalcNode:     ["cbamReportNode"],
  cbamReportNode:   [],
  ghgReportNode:    [],
  // Scope group: alles erlaubt (container)
  scopeGroupNode:   [],
};

export function isValidConnection(
  sourceType: string | undefined,
  targetType: string | undefined,
): boolean {
  if (!sourceType || !targetType) return true; // bilinmiyorsa izin ver
  if (sourceType === targetType && sourceType !== "scopeGroupNode") return false; // kendine bağlanamaz
  const allowed = ALLOWED_CONNECTIONS[sourceType];
  if (!allowed) return true; // tanımsız tip — izin ver
  return allowed.length === 0 || allowed.includes(targetType);
}
