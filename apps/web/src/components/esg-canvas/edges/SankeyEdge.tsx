import { getBezierPath, EdgeLabelRenderer, type EdgeProps } from "@xyflow/react";

// CSS animasyonu bir kez enjekte et
const SANKEY_STYLE = `
@keyframes sankeyFlow {
  0%   { stroke-dashoffset: 40; }
  100% { stroke-dashoffset: 0; }
}
`;
let styleInjected = false;
function injectSankeyStyle() {
  if (styleInjected || typeof document === "undefined") return;
  styleInjected = true;
  const s = document.createElement("style");
  s.textContent = SANKEY_STYLE;
  document.head.appendChild(s);
}

// Scope'a göre renk
function scopeColor(source: string, nodes: Array<{ id: string; type?: string }>): string {
  const srcNode = nodes.find(n => n.id === source);
  const t = srcNode?.type ?? "";
  if (t.includes("vehicleFleet") || t.includes("naturalGas")) return "#ef4444"; // Scope 1
  if (t.includes("grid"))                                       return "#f97316"; // Scope 2
  if (t.includes("ppa") || t.includes("cert"))                 return "#eab308"; // Scope 3
  if (t.includes("calc") || t.includes("Calc"))                return "#dc2626"; // hesaplama
  return "#94a3b8";
}

export interface SankeyEdgeData extends Record<string, unknown> {
  weight?:    number; // tCO₂e (oran belirler)
  maxWeight?: number; // normalize için
  label?:     string;
}

interface SankeyEdgeProps extends EdgeProps {
  data?: SankeyEdgeData;
  // React Flow passes all canvas nodes via a prop when using custom edge renderers
  // We can't directly access them, so we use a contextual color fallback
}

export function SankeyEdge({
  sourceX, sourceY, targetX, targetY,
  sourcePosition, targetPosition,
  source,
  data,
  selected,
}: SankeyEdgeProps) {
  injectSankeyStyle();

  const weight    = data?.weight    ?? 50;
  const maxWeight = data?.maxWeight ?? 500;
  const ratio     = Math.max(0.02, Math.min(1, weight / maxWeight));
  const strokeWidth = 2 + ratio * 28; // 2–30px

  const color = source.includes("vehicle") || source.includes("gas")
    ? "#ef4444"
    : source.includes("grid")
    ? "#f97316"
    : "#dc2626";

  const [path, lx, ly] = getBezierPath({
    sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition,
  });

  // Parçacık animasyonu sadece düşük node sayısında
  const animate = ratio > 0.05;

  return (
    <>
      {/* Arka plan şerit */}
      <path
        d={path}
        fill="none"
        stroke={color + "22"}
        strokeWidth={strokeWidth + 2}
      />
      {/* Ana Sankey şerit */}
      <path
        d={path}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        opacity={selected ? 0.9 : 0.65}
        strokeLinecap="round"
        strokeDasharray={animate ? `${strokeWidth * 2} ${strokeWidth * 2}` : undefined}
        style={animate ? {
          animation: `sankeyFlow ${1.2 / ratio}s linear infinite`,
        } : undefined}
      />
      {/* Tooltip label */}
      {data?.label && (
        <EdgeLabelRenderer>
          <div style={{
            position: "absolute",
            transform: `translate(-50%, -50%) translate(${lx}px, ${ly}px)`,
            fontSize: 10,
            background: `${color}cc`,
            color: "#fff",
            padding: "2px 6px",
            borderRadius: 3,
            pointerEvents: "none",
            whiteSpace: "nowrap",
            fontWeight: 600,
          }}>
            {data.label} tCO₂e
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

// useEdgeFlowWeights — Carbon Flow modunda edge ağırlıklarını hesapla
export function useEdgeFlowWeights(
  edges: Array<{ id: string; source: string; target: string; data?: Record<string, unknown> }>,
  nodes: Array<{ id: string; type?: string; data?: Record<string, unknown> }>,
): Map<string, number> {
  const weights = new Map<string, number>();

  for (const edge of edges) {
    // Kaynak node bir emission calc ise liveValue'dan ağırlık al
    const srcNode = nodes.find(n => n.id === edge.source);
    if (!srcNode) continue;

    let weight = 50; // default
    const liveValue = srcNode.data?.liveValue as string | undefined;
    if (liveValue) {
      const match = liveValue.match(/[\d.]+/);
      if (match) weight = parseFloat(match[0]);
    }
    weights.set(edge.id, weight);
  }

  return weights;
}
