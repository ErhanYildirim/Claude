import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import type { EsgGraph } from "../lib/api.js";
import * as XLSX from "xlsx";

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

function sourceLink(sourceType?: string, sourceId?: string): string | null {
  if (!sourceType || !sourceId) return null;
  if (sourceType === "installation") return `/installations/${sourceId}`;
  if (sourceType === "cbamFacility") return `/cbam/facilities/${sourceId}`;
  return null;
}

interface LiveZoneData {
  ci: number | null;
  rePct: number | null;
  updatedAt: string | null;
}

function exportExcel(graph: EsgGraph, outputNodes: CanvasNode[], liveZones: Record<string, LiveZoneData>) {
  const wb = XLSX.utils.book_new();

  const reportRows = [
    ["Canvas", graph.name],
    ["Tarih",  new Date(graph.updatedAt).toLocaleString("tr-TR")],
    [],
    ["Node Adı", "Değer", "Birim", "Son Güncelleme"],
    ...outputNodes.map(n => {
      const cfg = OUTPUT_CONFIG[n.type ?? ""] ?? { title: n.data.label ?? "", unit: "" };
      const val = n.type === "cbamReportNode" ? (n.data.subLabel ?? "") : (n.data.liveValue ?? "");
      return [n.data.label ?? cfg.title, val, cfg.unit, new Date().toLocaleString("tr-TR")];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reportRows), "Rapor");

  const energyRows = [
    ["Zone", "CI (gCO₂/kWh)", "RE%"],
    ...Object.entries(liveZones).map(([zone, v]) => [zone, v.ci, v.rePct]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(energyRows), "Enerji");

  XLSX.writeFile(wb, `${graph.name.replace(/[^a-z0-9ğüşıöçA-ZĞÜŞİÖÇ\s]/gi, "")}-rapor.xlsx`);
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
      <style media="print">{`
        [data-testid="excel-btn"], [data-testid="pdf-btn"] { display: none !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        [data-testid="kpi-card"] { page-break-inside: avoid; }
      `}</style>
      <ReportHeader graph={graph!} lastUpdated={lastUpdated} onRefresh={() => fetchLive(energyNodes)} outputNodes={outputNodes} energyNodes={energyNodes} liveZones={liveZones} />
      <CanvasMeta graph={graph!} outputCount={outputNodes.length} energyCount={energyNodes.length} />
      <KpiGrid outputNodes={outputNodes} />
      {energyNodes.length > 0 && Object.keys(liveZones).length > 0 && (
        <LiveDataRow energyNodes={energyNodes} liveZones={liveZones} />
      )}
    </div>
  );
}

function ReportHeader({
  graph, lastUpdated, onRefresh, outputNodes, liveZones,
}: {
  graph: EsgGraph;
  lastUpdated: Date | null;
  onRefresh: () => void;
  outputNodes: CanvasNode[];
  energyNodes: CanvasNode[];
  liveZones: Record<string, LiveZoneData>;
}) {
  const navigate = useNavigate();
  const ago = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 60_000)
    : null;

  return (
    <div
      data-testid="report-header"
      style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 16, flexWrap: "wrap",
      }}
    >
      <button
        onClick={() => navigate(`/esg-playground/${graph.id}`)}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: 0 }}
      >
        ← Playground
      </button>
      <span style={{ color: "var(--border)" }}>|</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{graph.name}</span>
      <span style={{
        background: "var(--accent-bg)", color: "var(--accent)",
        border: "1px solid var(--border-accent)", borderRadius: "var(--radius-pill)",
        fontSize: 10, fontWeight: 600, padding: "2px 8px",
      }}>
        ● CANLI
      </span>
      {ago !== null && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Son: {ago === 0 ? "az önce" : `${ago} dk önce`}</span>
      )}
      <button
        onClick={onRefresh}
        style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, padding: "3px 8px" }}
      >
        ↻ Yenile
      </button>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          data-testid="excel-btn"
          onClick={() => exportExcel(graph, outputNodes, liveZones)}
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: "var(--radius-md)", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
        >
          📊 Excel
        </button>
        <button
          data-testid="pdf-btn"
          onClick={() => window.print()}
          style={{ background: "var(--accent)", border: "none", color: "#fff", borderRadius: "var(--radius-md)", padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          📄 PDF İndir
        </button>
      </div>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  cfe:  { label: "24/7 CFE", color: "#16a34a" },
  cbam: { label: "CBAM",     color: "#dc2626" },
  ghg:  { label: "GHG Protocol", color: "#7c3aed" },
  org:  { label: "Organizasyon", color: "#64748b" },
};

function CanvasMeta({ graph, outputCount, energyCount }: { graph: EsgGraph; outputCount: number; energyCount: number }) {
  const cat = graph.templateCategory ? CATEGORY_LABELS[graph.templateCategory] : null;
  return (
    <div
      data-testid="canvas-meta"
      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {outputCount} çıktı node'u · {energyCount} enerji kaynağı
      </span>
      {cat && (
        <span style={{
          background: `${cat.color}22`, color: cat.color,
          border: `1px solid ${cat.color}44`, borderRadius: "var(--radius-pill)",
          fontSize: 10, fontWeight: 700, padding: "2px 8px",
        }}>
          {cat.label}
        </span>
      )}
    </div>
  );
}

function KpiGrid({ outputNodes }: { outputNodes: CanvasNode[] }) {
  return (
    <div
      data-testid="kpi-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 16,
        marginBottom: 20,
      }}
    >
      {outputNodes.map(n => <KpiCard key={n.id} node={n} />)}
    </div>
  );
}
function KpiCard({ node }: { node: CanvasNode }) {
  const cfg = OUTPUT_CONFIG[node.type ?? ""] ?? { title: node.data.label ?? "", unit: "", color: "#64748b" };
  const displayValue = node.type === "cbamReportNode"
    ? (node.data.subLabel || null)
    : (node.data.liveValue || null);
  const hasValue = displayValue !== null && displayValue !== "";
  const link = sourceLink(node.data.sourceType, node.data.sourceId);

  return (
    <div
      data-testid="kpi-card"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${hasValue ? "var(--border)" : "var(--border-muted, var(--border))"}`,
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "3px",
        background: hasValue ? cfg.color : "var(--border)",
      }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
        {node.data.label ?? cfg.title}
      </div>
      <div
        data-testid="kpi-value"
        style={{ fontSize: 32, fontWeight: 800, color: hasValue ? "var(--text-primary)" : "var(--text-muted)", lineHeight: 1 }}
      >
        {displayValue ?? "—"}
      </div>
      {cfg.unit && hasValue && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{cfg.unit}</div>
      )}
      {link && (
        <a
          href={link}
          data-testid="kpi-platform-link"
          style={{ display: "block", marginTop: 12, fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
        >
          → Platform sayfasına git
        </a>
      )}
    </div>
  );
}
const ENERGY_ICONS: Record<string, string> = { gridNode: "🔌", solarNode: "☀️", windNode: "💨" };
const ENERGY_LABELS: Record<string, string> = { gridNode: "CI", solarNode: "RE%", windNode: "RE%" };

function LiveDataRow({ energyNodes, liveZones }: { energyNodes: CanvasNode[]; liveZones: Record<string, LiveZoneData> }) {
  const items = energyNodes.filter(n => n.data.zone && liveZones[n.data.zone as string]);
  if (items.length === 0) return null;

  return (
    <div
      data-testid="live-data-row"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}
    >
      {items.map(n => {
        const zone = n.data.zone as string;
        const live = liveZones[zone];
        const isGrid = n.type === "gridNode";
        const value = isGrid
          ? (live.ci !== null ? `${live.ci} gCO₂/kWh` : "—")
          : (live.rePct !== null ? `${live.rePct.toFixed(1)}% RE` : "—");
        return (
          <div
            key={n.id}
            style={{
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>{ENERGY_ICONS[n.type ?? ""] ?? "⚡"}</span>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {n.data.label ?? n.type} · {ENERGY_LABELS[n.type ?? ""] ?? ""}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
