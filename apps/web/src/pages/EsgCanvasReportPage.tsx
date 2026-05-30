import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import type { EsgGraph } from "../lib/api.js";

interface CanvasNode {
  id: string;
  type?: string;
  data: {
    label?: string;
    liveValue?: string;
    subLabel?: string;
    zone?: string;
    color?: string;
    sourceType?: string;
    sourceId?: string;
    [key: string]: unknown;
  };
}

const OUTPUT_NODE_TYPES = new Set([
  "emissionCalcNode", "cbamCalcNode", "cfMatchingNode", "ghgReportNode", "cbamReportNode",
]);
const ENERGY_NODE_TYPES = new Set(["gridNode", "solarNode", "windNode"]);

const OUTPUT_CONFIG: Record<string, { title: string; unit: string; color: string }> = {
  emissionCalcNode: { title: "Emisyon Hesabı",       unit: "tCO₂e", color: "#ef4444" },
  cbamCalcNode:     { title: "CBAM Karbon Maliyeti",  unit: "€",     color: "#dc2626" },
  cfMatchingNode:   { title: "CFE Eşleştirme Skoru",  unit: "%",     color: "#16a34a" },
  ghgReportNode:    { title: "GHG Toplam Emisyon",    unit: "tCO₂e", color: "#7c3aed" },
  cbamReportNode:   { title: "CBAM Teknik Dosya",     unit: "",      color: "#b91c1c" },
};

interface LiveZoneData {
  ci: number;
  rePct: number;
  updatedAt: string;
}

function parseNodes(nodesJson: unknown): { outputNodes: CanvasNode[]; energyNodes: CanvasNode[] } {
  const nodes = Array.isArray(nodesJson) ? (nodesJson as CanvasNode[]) : [];
  return {
    outputNodes: nodes.filter(n => OUTPUT_NODE_TYPES.has(n.type ?? "")),
    energyNodes: nodes.filter(n => ENERGY_NODE_TYPES.has(n.type ?? "")),
  };
}

export default function EsgCanvasReportPage() {
  const { graphId } = useParams<{ graphId: string }>();
  const navigate = useNavigate();

  const [graph, setGraph]         = useState<EsgGraph | null>(null);
  const [loading, setLoading]     = useState(true);
  const [liveZones, setLiveZones] = useState<Record<string, LiveZoneData>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { outputNodes, energyNodes } = graph
    ? parseNodes(graph.nodesJson)
    : { outputNodes: [], energyNodes: [] };

  const fetchLive = useCallback(async (enNodes: CanvasNode[]) => {
    const zones = [...new Set(enNodes.map(n => n.data.zone).filter(Boolean) as string[])];
    if (zones.length === 0) return;
    try {
      const res = await api.esgPlayground.liveData(zones);
      setLiveZones((res as { zones: Record<string, LiveZoneData> }).zones ?? {});
      setLastUpdated(new Date());
    } catch {
      // enerji satırı gizlenir, sessiz hata
    }
  }, []);

  useEffect(() => {
    if (!graphId) return;
    setLoading(true);
    api.esgPlayground.get(graphId)
      .then(g => {
        setGraph(g);
        const { energyNodes: en } = parseNodes(g.nodesJson);
        fetchLive(en);
      })
      .catch(() => navigate("/esg-playground"))
      .finally(() => setLoading(false));
  }, [graphId, navigate, fetchLive]);

  useEffect(() => {
    if (!graph) return;
    const { energyNodes: en } = parseNodes(graph.nodesJson);
    const id = setInterval(() => fetchLive(en), 30_000);
    return () => clearInterval(id);
  }, [graph, fetchLive]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
        Yükleniyor...
      </div>
    );
  }

  if (outputNodes.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-muted)" }}>
        <div style={{ fontSize: 48 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Bu canvas'ta rapor node'u bulunmuyor</div>
        <div style={{ fontSize: 13 }}>Emisyon Hesabı, CBAM, CFE veya GHG rapor node'u ekleyin</div>
        <button
          onClick={() => navigate(`/esg-playground/${graphId}`)}
          style={{ marginTop: 8, padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
        >
          Canvas'a Dön
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px", fontFamily: "var(--font-sans)" }}>
      <ReportHeader graph={graph!} lastUpdated={lastUpdated} onRefresh={() => fetchLive(energyNodes)} outputNodes={outputNodes} energyNodes={energyNodes} liveZones={liveZones} />
      <CanvasMeta graph={graph!} outputCount={outputNodes.length} energyCount={energyNodes.length} />
      <KpiGrid outputNodes={outputNodes} />
      {energyNodes.length > 0 && Object.keys(liveZones).length > 0 && (
        <LiveDataRow energyNodes={energyNodes} liveZones={liveZones} />
      )}
    </div>
  );
}

// ── Placeholder bileşenler — sonraki task'larda implemente edilecek ──────────
function ReportHeader(_: { graph: EsgGraph; lastUpdated: Date | null; onRefresh: () => void; outputNodes: CanvasNode[]; energyNodes: CanvasNode[]; liveZones: Record<string, LiveZoneData> }) {
  return <div data-testid="report-header" />;
}
function CanvasMeta(_: { graph: EsgGraph; outputCount: number; energyCount: number }) {
  return <div data-testid="canvas-meta" />;
}
function KpiGrid({ outputNodes }: { outputNodes: CanvasNode[] }) {
  return (
    <div data-testid="kpi-grid">
      {outputNodes.map(n => <KpiCard key={n.id} node={n} />)}
    </div>
  );
}
function KpiCard({ node }: { node: CanvasNode }) {
  const cfg = OUTPUT_CONFIG[node.type ?? ""] ?? { title: node.data.label ?? "", unit: "", color: "#64748b" };
  const displayValue = node.type === "cbamReportNode"
    ? (node.data.subLabel || null)
    : (node.data.liveValue || null);
  return (
    <div data-testid="kpi-card" style={{ marginBottom: 12 }}>
      <div>{node.data.label ?? cfg.title}</div>
      <div data-testid="kpi-value">{displayValue ?? "—"}</div>
    </div>
  );
}
function LiveDataRow(_: { energyNodes: CanvasNode[]; liveZones: Record<string, LiveZoneData> }) {
  return <div data-testid="live-data-row" />;
}
