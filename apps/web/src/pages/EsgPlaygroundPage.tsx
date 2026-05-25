import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange,
  type OnConnect, type Viewport, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../lib/api.js";
import type { EsgGraph } from "../lib/api.js";
import { nodeTypes } from "../components/esg-canvas/nodeTypes.js";
import { edgeTypes } from "../components/esg-canvas/edges/CustomEdges.js";
import { useCanvasLiveData } from "../hooks/useEsgNodeData.js";
import { useViewMode, VIEW_MODE_LABELS, type ViewMode } from "../hooks/useViewMode.js";
import { useValidationEngine } from "../hooks/useValidationEngine.js";
import { useSimulator } from "../hooks/useSimulator.js";
import { ImportWizardModal } from "../components/esg-canvas/ImportWizardModal.js";
import { useCanvasHistory } from "../hooks/useCanvasHistory.js";
import { useCollaboration } from "../hooks/useCollaboration.js";
import { CollaborationOverlay } from "../components/esg-canvas/CollaborationOverlay.js";
import { toPng } from "html-to-image";

// ── Canvas boyutu değişirse bu key React Flow'u sıfırlar
const FLOW_KEY = "esg-canvas-v1";

export default function EsgPlaygroundPage() {
  const { graphId } = useParams<{ graphId?: string }>();
  const navigate    = useNavigate();

  const [graph, setGraph]           = useState<EsgGraph | null>(null);
  const [nodes, setNodes]           = useState<Node[]>([]);
  const [edges, setEdges]           = useState<Edge[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [lastSaved, setLastSaved]   = useState<Date | null>(null);
  const [dirty, setDirty]           = useState(false);
  const { mode, changeMode, visibleNodes, visibleEdges } = useViewMode(nodes, edges);
  const validation = useValidationEngine(nodes, edges);
  const simulator  = useSimulator(nodes, edges);
  const [rightPanel, setRightPanel] = useState<"properties" | "snapshots" | "validation" | "simulator" | null>(null);
  const [leftPanel, setLeftPanel]   = useState<"nodes" | "copilot">("nodes");
  const [showGraphList, setShowGraphList]     = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [searchQuery, setSearchQuery]         = useState("");
  const [showSearch, setShowSearch]           = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const history   = useCanvasHistory([], []);
  const [graphList, setGraphList]   = useState<EsgGraph[]>([]);
  const collab = useCollaboration(graphId, !!graphId);
  const [commentMode, setCommentMode] = useState(false);
  const [rfInstance, setRfInstance]   = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null;

  // Canlı veri — grid/solar/wind node'larına otomatik badge
  const liveDataMap = useCanvasLiveData(
    nodes.map(n => ({ id: n.id, type: n.type, data: n.data as Record<string, unknown> })),
    !!graphId,
  );

  // Live data değişince ilgili node'ların datasını güncelle (sadece liveValue/badge)
  useEffect(() => {
    if (liveDataMap.size === 0) return;
    setNodes(nds => nds.map(n => {
      const live = liveDataMap.get(n.id);
      if (!live) return n;
      return { ...n, data: { ...n.data, ...live } };
    }));
  }, [liveDataMap]); // eslint-disable-line react-hooks/exhaustive-deps

  // Validation badge'lerini node'lara yansıt
  useEffect(() => {
    const issueMap = new Map<string, { badge: string; badgeColor: string }>();
    for (const issue of validation.issues) {
      if (!issue.nodeId) continue;
      if (!issueMap.has(issue.nodeId)) {
        issueMap.set(issue.nodeId, {
          badge:      issue.severity === "critical" ? "!" : issue.severity === "warning" ? "⚠" : "·",
          badgeColor: issue.severity === "critical" ? "#ef4444" : issue.severity === "warning" ? "#f59e0b" : "#64748b",
        });
      }
    }
    setNodes(nds => nds.map(n => {
      const badge = issueMap.get(n.id);
      const currentBadge = n.data?.badge as string | undefined;
      const newBadge = badge?.badge;
      if (currentBadge === newBadge) return n;
      return { ...n, data: { ...n.data, badge: newBadge, badgeColor: badge?.badgeColor } };
    }));
  }, [validation.issues]); // eslint-disable-line react-hooks/exhaustive-deps

  const viewportRef   = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const saveTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef      = useRef<Node[]>([]);
  const edgesRef      = useRef<Edge[]>([]);
  nodesRef.current    = nodes;
  edgesRef.current    = edges;

  const isDark = document.documentElement.getAttribute("data-theme") === "dark";
  const bg     = isDark ? "#0f1117" : "#f8fafc";
  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        if (graphId) {
          const g = await api.esgPlayground.get(graphId);
          setGraph(g);
          setNodes((g.nodesJson as Node[]) ?? []);
          setEdges((g.edgesJson as Edge[]) ?? []);
          if (g.viewport) viewportRef.current = g.viewport as Viewport;
        } else {
          // Liste yükle — henüz açık canvas yok
          const list = await api.esgPlayground.list();
          setGraphList(list);
          setShowGraphList(true);
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [graphId]);

  // ── Auto-save (debounce 3 sn) ────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (!graphId) return;
    setDirty(true);
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(async () => {
      setSaving(true);
      try {
        await api.esgPlayground.update(graphId, {
          nodesJson: nodesRef.current,
          edgesJson: edgesRef.current,
          viewport:  viewportRef.current,
        });
        setLastSaved(new Date());
        setDirty(false);
      } finally {
        setSaving(false);
      }
    }, 3000);
  }, [graphId]);

  const onNodesChange: OnNodesChange = useCallback(changes => {
    const hasStructural = changes.some(c => c.type === "add" || c.type === "remove");
    if (hasStructural) history.pushHistory(nodesRef.current, edgesRef.current);
    setNodes(nds => applyNodeChanges(changes, nds));
    scheduleSave();
  }, [scheduleSave, history]);

  const onEdgesChange: OnEdgesChange = useCallback(changes => {
    const hasStructural = changes.some(c => c.type === "add" || c.type === "remove");
    if (hasStructural) history.pushHistory(nodesRef.current, edgesRef.current);
    setEdges(eds => applyEdgeChanges(changes, eds));
    scheduleSave();
  }, [scheduleSave, history]);

  const onConnect: OnConnect = useCallback(connection => {
    // Aktif moda göre default edge tipi ata — aksi takdirde mode filtresi gizler
    const defaultType =
      mode === "organizational" ? "orgEdge"      :
      mode === "carbonflow"     ? "carbonFlowEdge":
      mode === "regulatory"     ? "certFlowEdge"  :
      "dataFlowEdge"; // dataflow (default)
    setEdges(eds => addEdge({ ...connection, type: defaultType, animated: true }, eds));
    scheduleSave();
  }, [scheduleSave, mode]);

  const onViewportChange = useCallback((vp: Viewport) => {
    viewportRef.current = vp;
  }, []);

  // ── Yeni canvas oluştur ──────────────────────────────────────────────────
  async function createNew() {
    const g = await api.esgPlayground.create({ name: "Yeni Canvas" });
    navigate(`/esg-playground/${g.id}`);
  }

  // ── Canvas sil (listeden) ─────────────────────────────────────────────────
  async function deleteGraph(e: React.MouseEvent, id: string, name: string) {
    e.stopPropagation();
    if (!window.confirm(`"${name}" canvas'ı kalıcı olarak silinecek. Emin misiniz?`)) return;
    await api.esgPlayground.delete(id);
    setGraphList(prev => prev.filter(g => g.id !== id));
  }

  // ── Renk tema ────────────────────────────────────────────────────────────
  const miniMapNodeColor = (node: Node) => {
    const t = node.type ?? "";
    if (t.includes("scope1") || t.includes("Scope1")) return "#ef4444";
    if (t.includes("scope2") || t.includes("Scope2")) return "#f97316";
    if (t.includes("scope3") || t.includes("Scope3")) return "#eab308";
    if (t.includes("facility") || t.includes("Facility")) return "#3b82f6";
    if (t.includes("meter")    || t.includes("Meter"))    return "#8b5cf6";
    if (t.includes("calc")     || t.includes("Calc"))     return "#10b981";
    return isDark ? "#94a3b8" : "#64748b";
  };

  // ── Klavye kısayolları ────────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === "z" && !e.shiftKey) {
        e.preventDefault();
        const snap = history.undo(nodesRef.current, edgesRef.current);
        if (snap) { setNodes(snap.nodes); setEdges(snap.edges); }
      }
      if (ctrl && (e.key === "y" || (e.key === "z" && e.shiftKey))) {
        e.preventDefault();
        const snap = history.redo(nodesRef.current, edgesRef.current);
        if (snap) { setNodes(snap.nodes); setEdges(snap.edges); }
      }
      if (ctrl && e.key === "f") {
        e.preventDefault();
        setShowSearch(s => !s);
      }
      if (e.key === "/" && !e.ctrlKey && !(e.target as HTMLElement).closest("input, textarea")) {
        e.preventDefault();
        setLeftPanel("copilot");
      }
      if (e.key === "Escape") {
        setShowSearch(false);
        setSearchQuery("");
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [history]);

  // ── Sürükle-Bırak — Node Palette → Canvas ─────────────────────────────────
  const NODE_DROP_LABELS: Record<string, string> = {
    orgNode: "Organizasyon", divisionNode: "Bölüm", facilityNode: "Yeni Tesis",
    buildingNode: "Bina", processNode: "Proses", productNode: "Ürün",
    vehicleFleetNode: "Araç Filosu", gridNode: "Şebeke", solarNode: "Solar PV",
    windNode: "Rüzgar", hydroNode: "Hidroelektrik", naturalGasNode: "Doğalgaz",
    ppaContractNode: "PPA Sözleşmesi", meterNode: "Sayaç", apiSourceNode: "API Kaynağı",
    manualEntryNode: "Manuel Giriş", emissionCalcNode: "Emisyon Hesap",
    cfMatchingNode: "CFE Eşleştirme", cbamCalcNode: "CBAM Hesap",
    cbamReportNode: "CBAM Rapor", ghgReportNode: "GHG Raporu", scopeGroupNode: "Scope Grubu",
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const type = e.dataTransfer.getData("application/voltfox-node-type");
    if (!type || !rfInstance) return;
    const position = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const newNode: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      position,
      data: { label: NODE_DROP_LABELS[type] ?? type },
    };
    history.pushHistory(nodesRef.current, edgesRef.current);
    setNodes(nds => [...nds, newNode]);
    scheduleSave();
  }, [rfInstance, scheduleSave, history]);

  // ── PNG Export ─────────────────────────────────────────────────────────────
  async function exportPng() {
    const el = canvasRef.current?.querySelector(".react-flow") as HTMLElement | null;
    if (!el) return;
    const dataUrl = await toPng(el, { pixelRatio: 2 });
    const a = document.createElement("a");
    a.href = dataUrl;
    a.download = `${graph?.name ?? "canvas"}-${new Date().toISOString().slice(0, 10)}.png`;
    a.click();
  }

  // ── JSON Export ────────────────────────────────────────────────────────────
  function exportJson() {
    const blob = new Blob([JSON.stringify({ nodes, edges }, null, 2)], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = `${graph?.name ?? "canvas"}.esg.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── JSON Import ────────────────────────────────────────────────────────────
  function importJson() {
    const input = document.createElement("input");
    input.type   = "file";
    input.accept = ".json";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const data = JSON.parse(e.target?.result as string);
          if (data.nodes) { setNodes(data.nodes); setEdges(data.edges ?? []); scheduleSave(); }
        } catch { /* geçersiz JSON */ }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  // ── Kaydedilmedi uyarısı ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Graph list seçimi ─────────────────────────────────────────────────────
  if (!loading && showGraphList) {
    return (
      <div style={{ background: bg, minHeight: "100%", padding: "32px 24px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: text }}>ESG Playground</h1>
            <p style={{ margin: "4px 0 0", fontSize: 13, color: sub }}>
              Şirketinizin ESG veri mimarisini görsel olarak tasarlayın
            </p>
          </div>
          <button
            onClick={createNew}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "#10b981", color: "#fff", fontSize: 14,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            + Yeni Canvas
          </button>
        </div>
        {graphList.length === 0 ? (
          <div style={{
            textAlign: "center", padding: "80px 0", color: sub,
            border: `2px dashed ${border}`, borderRadius: 12,
          }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>🕸️</div>
            <div style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 8 }}>
              Henüz canvas yok
            </div>
            <div style={{ fontSize: 13, marginBottom: 20 }}>
              İlk ESG dijital ikizinizi oluşturmak için başlayın
            </div>
            <button
              onClick={createNew}
              style={{
                padding: "10px 20px", borderRadius: 8, border: "none",
                background: "#10b981", color: "#fff", fontSize: 14,
                fontWeight: 600, cursor: "pointer",
              }}
            >
              Canvas Oluştur
            </button>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 16 }}>
            {graphList.map(g => (
              <div
                key={g.id}
                onClick={() => navigate(`/esg-playground/${g.id}`)}
                style={{
                  background: card, border: `1px solid ${border}`, borderRadius: 12,
                  padding: "20px", cursor: "pointer", transition: "border-color 0.15s",
                  position: "relative",
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = "#10b981")}
                onMouseLeave={e => (e.currentTarget.style.borderColor = border)}
              >
                {/* Sil butonu */}
                <button
                  onClick={e => deleteGraph(e, g.id, g.name)}
                  title="Canvas'ı sil"
                  style={{
                    position: "absolute", top: 10, right: 10,
                    background: "none", border: "none",
                    color: sub, cursor: "pointer", fontSize: 14,
                    padding: "2px 6px", borderRadius: 4,
                    lineHeight: 1, opacity: 0.6,
                  }}
                  onMouseEnter={e => { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#ef4444"; }}
                  onMouseLeave={e => { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.color = sub; }}
                >
                  🗑
                </button>
                <div style={{ fontSize: 32, marginBottom: 8 }}>🕸️</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 4 }}>{g.name}</div>
                {g.description && (
                  <div style={{ fontSize: 12, color: sub, marginBottom: 8 }}>{g.description}</div>
                )}
                <div style={{ fontSize: 11, color: sub }}>
                  {new Date(g.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                </div>
              </div>
            ))}
            <div
              onClick={createNew}
              style={{
                background: "transparent", border: `2px dashed ${border}`, borderRadius: 12,
                padding: "20px", cursor: "pointer", display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", minHeight: 120,
                color: sub, transition: "border-color 0.15s",
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = "#10b981")}
              onMouseLeave={e => (e.currentTarget.style.borderColor = border)}
            >
              <div style={{ fontSize: 24, marginBottom: 6 }}>+</div>
              <div style={{ fontSize: 13 }}>Yeni Canvas</div>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: sub }}>
        Yükleniyor...
      </div>
    );
  }

  // ── Ana canvas görünümü ──────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: bg }}>
      {showImportModal && (
        <ImportWizardModal
          card={card} text={text} sub={sub} border={border}
          onClose={() => setShowImportModal(false)}
          onImport={(importedNodes, importedEdges) => {
            setNodes(prev => [...prev, ...importedNodes]);
            setEdges(prev => [...prev, ...importedEdges]);
            scheduleSave();
          }}
        />
      )}

      {/* ── Toolbar ──────────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "8px 16px", borderBottom: `1px solid ${border}`,
        background: card, flexShrink: 0, gap: 12,
      }}>
        {/* Sol: başlık + breadcrumb */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => navigate("/esg-playground")}
            style={{ background: "none", border: "none", color: sub, cursor: "pointer", fontSize: 18 }}
          >
            ←
          </button>
          <span style={{ fontSize: 13, color: sub }}>ESG Playground</span>
          <span style={{ color: sub }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: text }}>
            {graph?.name ?? "Canvas"}
          </span>
        </div>

        {/* Orta: view mode + panel toggles */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {/* View mode */}
          {(Object.keys(VIEW_MODE_LABELS) as ViewMode[]).map(m => {
            const vm = VIEW_MODE_LABELS[m];
            return (
              <button
                key={m}
                onClick={() => changeMode(m)}
                title={vm.desc}
                style={{
                  padding: "4px 10px", borderRadius: 6, fontSize: 12,
                  border: `1px solid ${border}`, cursor: "pointer",
                  background: mode === m ? "#0f172a" : card,
                  color:      mode === m ? "#f1f5f9" : text,
                }}
              >
                {vm.icon} {vm.label}
              </button>
            );
          })}
          <div style={{ width: 1, background: border, margin: "0 4px" }} />
          {[
            { key: "nodes",   label: "Nodlar" },
            { key: "copilot", label: "AI" },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setLeftPanel(btn.key as "nodes" | "copilot")}
              style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 12,
                border: `1px solid ${border}`, cursor: "pointer",
                background: leftPanel === btn.key ? "#10b981" : card,
                color:      leftPanel === btn.key ? "#fff"    : text,
              }}
            >
              {btn.label}
            </button>
          ))}
          <div style={{ width: 1, background: border, margin: "0 4px" }} />
          {[
            { key: "properties", label: "Özellikler" },
            { key: "validation", label: "Doğrulama" },
            { key: "simulator",  label: "Simülatör" },
            { key: "snapshots",  label: "Görüntüler" },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setRightPanel(p => p === btn.key as typeof rightPanel ? null : btn.key as typeof rightPanel)}
              style={{
                padding: "4px 10px", borderRadius: 6, fontSize: 12,
                border: `1px solid ${border}`, cursor: "pointer",
                background: rightPanel === btn.key ? "#3b82f6" : card,
                color:      rightPanel === btn.key ? "#fff"    : text,
              }}
            >
              {btn.label}
            </button>
          ))}
        </div>

        {/* Sağ: peer avatarları + kaydet durumu */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 12, color: sub }}>
          {/* Aktif kullanıcılar */}
          {collab.peers.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {collab.peers.slice(0, 5).map(p => (
                <div
                  key={p.userId}
                  title={p.name}
                  style={{
                    width: 24, height: 24, borderRadius: "50%",
                    background: p.color, color: "#fff",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 10, fontWeight: 700, cursor: "default",
                    border: "2px solid rgba(255,255,255,0.3)",
                  }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </div>
              ))}
              {collab.peers.length > 5 && (
                <div style={{ fontSize: 11, color: sub }}>+{collab.peers.length - 5}</div>
              )}
            </div>
          )}
          {/* Yorum pin modu */}
          <button
            onClick={() => setCommentMode(m => !m)}
            title="Yorum Ekle (yorum modunda canvas'a tıkla)"
            style={{
              padding: "4px 8px", borderRadius: 6, fontSize: 12,
              border: `1px solid ${commentMode ? "#f59e0b" : border}`,
              background: commentMode ? "rgba(245,158,11,0.15)" : card,
              color: commentMode ? "#f59e0b" : sub, cursor: "pointer",
            }}
          >
            💬
          </button>
          {saving ? (
            <span>Kaydediliyor...</span>
          ) : dirty ? (
            <span style={{ color: "#f59e0b" }}>● Kaydedilmedi</span>
          ) : lastSaved ? (
            <span>✓ {lastSaved.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })}</span>
          ) : null}
          {/* Undo/Redo */}
          <button
            onClick={() => { const s = history.undo(nodesRef.current, edgesRef.current); if (s) { setNodes(s.nodes); setEdges(s.edges); } }}
            disabled={!history.canUndo}
            title="Geri Al (Ctrl+Z)"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: card, color: history.canUndo ? text : sub, cursor: history.canUndo ? "pointer" : "default" }}
          >↩</button>
          <button
            onClick={() => { const s = history.redo(nodesRef.current, edgesRef.current); if (s) { setNodes(s.nodes); setEdges(s.edges); } }}
            disabled={!history.canRedo}
            title="Yinele (Ctrl+Y)"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: card, color: history.canRedo ? text : sub, cursor: history.canRedo ? "pointer" : "default" }}
          >↪</button>
          <button
            onClick={() => setShowSearch(s => !s)}
            title="Ara (Ctrl+F)"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: showSearch ? "#3b82f6" : card, color: showSearch ? "#fff" : text, cursor: "pointer" }}
          >🔍</button>
          <button
            onClick={exportPng}
            title="PNG Export"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: card, color: text, cursor: "pointer" }}
          >📸</button>
          <button
            onClick={exportJson}
            title="JSON Export"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: card, color: text, cursor: "pointer" }}
          >⬇</button>
          <button
            onClick={importJson}
            title="JSON Import"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: card, color: text, cursor: "pointer" }}
          >⬆</button>
          <button
            onClick={() => setShowImportModal(true)}
            style={{
              padding: "4px 12px", borderRadius: 6, fontSize: 12,
              border: `1px solid ${border}`, background: card, color: text, cursor: "pointer",
            }}
          >
            📥 İçe Aktar
          </button>
          <button
            onClick={() => navigate("/esg-playground")}
            style={{
              padding: "4px 12px", borderRadius: 6, fontSize: 12,
              border: `1px solid ${border}`, background: card, color: text, cursor: "pointer",
            }}
          >
            Tüm Canvaslar
          </button>
        </div>
      </div>

      {/* ── Ana alan: sol panel + canvas + sağ panel ─────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sol panel */}
        <div style={{
          width: 220, flexShrink: 0, borderRight: `1px solid ${border}`,
          background: card, overflow: "auto", display: "flex", flexDirection: "column",
        }}>
          {leftPanel === "nodes" && <NodePalette card={card} text={text} sub={sub} border={border} />}
          {leftPanel === "copilot" && (
            <CopilotPanel
              card={card} text={text} sub={sub} border={border}
              graphId={graphId}
              currentNodes={nodesRef.current}
              currentEdges={edgesRef.current}
              onApply={(addNodes, addEdges) => {
                history.pushHistory(nodesRef.current, edgesRef.current);
                setNodes(nds => [...nds, ...(addNodes as Node[])]);
                setEdges(eds => [...eds, ...(addEdges as Edge[])]);
                scheduleSave();
              }}
            />
          )}
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{ flex: 1, position: "relative", cursor: commentMode ? "crosshair" : "default" }}
          onMouseMove={e => {
            if (!canvasRef.current) return;
            const rect = canvasRef.current.getBoundingClientRect();
            collab.sendCursor(e.clientX - rect.left, e.clientY - rect.top);
          }}
          onClick={e => {
            if (!commentMode) return;
            const rect = canvasRef.current?.getBoundingClientRect();
            if (!rect) return;
            const text = window.prompt("Yorum:");
            if (text?.trim()) {
              collab.addComment(e.clientX - rect.left, e.clientY - rect.top, text.trim());
              setCommentMode(false);
            }
          }}
        >
          {/* Arama overlay */}
          {showSearch && (
            <div style={{
              position: "absolute", top: 12, left: "50%", transform: "translateX(-50%)",
              zIndex: 10, background: card, borderRadius: 8, padding: "8px 12px",
              border: `1px solid ${border}`, boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
              display: "flex", alignItems: "center", gap: 8, width: 280,
            }}>
              <span style={{ color: sub, fontSize: 14 }}>🔍</span>
              <input
                autoFocus
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Node ara..."
                style={{
                  flex: 1, border: "none", background: "transparent",
                  color: text, fontSize: 13, outline: "none",
                }}
              />
              <span style={{ fontSize: 11, color: sub }}>
                {searchQuery
                  ? `${nodes.filter(n => String(n.data?.label ?? "").toLowerCase().includes(searchQuery.toLowerCase())).length} sonuç`
                  : ""}
              </span>
            </div>
          )}
          <CollaborationOverlay
            cursors={collab.cursors}
            comments={collab.comments}
            myUserId={collab.myUserId}
          />
          <ReactFlow
            key={FLOW_KEY}
            onInit={setRfInstance}
            onDrop={handleDrop}
            onDragOver={e => e.preventDefault()}
            onNodeClick={(_, node) => { setSelectedNodeId(node.id); setRightPanel("properties"); }}
            onPaneClick={() => setSelectedNodeId(null)}
            nodes={visibleNodes.map(n => {
              const lockedBy = collab.lockedNodes.get(n.id);
              const isLockedByOther = lockedBy && lockedBy.userId !== collab.myUserId;
              if (!showSearch || !searchQuery) {
                return isLockedByOther
                  ? { ...n, style: { ...n.style, outline: `2px solid ${lockedBy.color}`, outlineOffset: 2 }, draggable: false }
                  : n;
              }
              const matches = String(n.data?.label ?? "").toLowerCase().includes(searchQuery.toLowerCase());
              return {
                ...n,
                style: { ...n.style, opacity: matches ? 1 : 0.2, ...(isLockedByOther ? { outline: `2px solid ${lockedBy!.color}`, outlineOffset: 2 } : {}) },
                draggable: isLockedByOther ? false : undefined,
              };
            })}
            edges={visibleEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeDragStart={(_, node) => collab.lockNode(node.id)}
            onNodeDragStop={(_, node)  => collab.unlockNode(node.id)}
            onMoveEnd={(_, vp) => onViewportChange(vp)}
            defaultViewport={viewportRef.current}
            fitView={nodes.length > 0}
            deleteKeyCode="Delete"
            multiSelectionKeyCode="Shift"
            nodeTypes={nodeTypes}
            edgeTypes={edgeTypes}
            isValidConnection={conn => conn.source !== conn.target}
            proOptions={{ hideAttribution: true }}
          >
            <Background color={isDark ? "#2d3748" : "#e2e8f0"} gap={20} />
            <Controls />
            <MiniMap
              nodeColor={miniMapNodeColor}
              style={{ background: card, border: `1px solid ${border}` }}
            />
          </ReactFlow>
          {nodes.length === 0 && (
            <div style={{
              position: "absolute", inset: 0, display: "flex",
              flexDirection: "column", alignItems: "center", justifyContent: "center",
              pointerEvents: "none", color: sub,
            }}>
              <div style={{ fontSize: 48, marginBottom: 12 }}>🕸️</div>
              <div style={{ fontSize: 16, fontWeight: 600, color: text, marginBottom: 4 }}>
                Canvas boş
              </div>
              <div style={{ fontSize: 13 }}>
                Sol panelden node ekleyin veya AI Copilot kullanın
              </div>
            </div>
          )}
        </div>

        {/* Sağ panel */}
        {rightPanel && (
          <div style={{
            width: 280, flexShrink: 0, borderLeft: `1px solid ${border}`,
            background: card, overflow: "auto",
          }}>
            {rightPanel === "properties" && (
              <PanelSection title="Özellikler" sub={sub} text={text} border={border}>
                {selectedNode ? (
                  <NodePropertiesPanel
                    node={selectedNode}
                    text={text} sub={sub} border={border}
                    onChange={(id, data) => {
                      setNodes(nds => nds.map(n => n.id === id ? { ...n, data: { ...n.data, ...data } } : n));
                      scheduleSave();
                    }}
                    onDelete={(id) => {
                      history.pushHistory(nodesRef.current, edgesRef.current);
                      setNodes(nds => nds.filter(n => n.id !== id));
                      setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
                      setSelectedNodeId(null);
                      scheduleSave();
                    }}
                  />
                ) : (
                  <p style={{ fontSize: 13, color: sub, padding: "0 16px" }}>
                    Bir node seçin.
                  </p>
                )}
              </PanelSection>
            )}
            {rightPanel === "validation" && (
              <PanelSection title="Doğrulama" sub={sub} text={text} border={border}>
                <div style={{ padding: "0 16px" }}>
                  <ScoreBadge score={validation.score} />
                  {validation.issues.length === 0 ? (
                    <p style={{ fontSize: 12, color: "#10b981", marginTop: 8 }}>
                      ✓ Sorun bulunamadı
                    </p>
                  ) : (
                    <div style={{ marginTop: 10 }}>
                      {validation.critical.map(i => (
                        <div key={i.id} style={{
                          fontSize: 11, color: "#ef4444", padding: "4px 0",
                          borderBottom: `1px solid ${border}`,
                        }}>
                          🔴 {i.message}
                        </div>
                      ))}
                      {validation.warnings.map(i => (
                        <div key={i.id} style={{
                          fontSize: 11, color: "#f59e0b", padding: "4px 0",
                          borderBottom: `1px solid ${border}`,
                        }}>
                          🟡 {i.message}
                        </div>
                      ))}
                      {validation.suggestions.map(i => (
                        <div key={i.id} style={{
                          fontSize: 11, color: sub, padding: "4px 0",
                          borderBottom: `1px solid ${border}`,
                        }}>
                          🔵 {i.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </PanelSection>
            )}
            {rightPanel === "simulator" && (
              <SimulatorPanel
                simulator={simulator}
                text={text} sub={sub} border={border}
              />
            )}
            {rightPanel === "snapshots" && (
              <SnapshotsPanel graphId={graphId!} card={card} text={text} sub={sub} border={border} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Alt bileşenler ─────────────────────────────────────────────────────────

function PanelSection({ title, sub, text, border, children }: {
  title: string; sub: string; text: string; border: string; children: React.ReactNode;
}) {
  return (
    <div>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${border}`,
        fontSize: 12, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        {title}
      </div>
      <div style={{ padding: "12px 0" }}>{children}</div>
    </div>
  );
}

const NODE_PALETTE_ITEMS = [
  { type: "facilityNode",   icon: "🏭", label: "Tesis",          color: "#3b82f6" },
  { type: "meterNode",      icon: "⚡", label: "Sayaç",          color: "#8b5cf6" },
  { type: "orgNode",        icon: "🏢", label: "Organizasyon",   color: "#64748b" },
  { type: "processNode",    icon: "⚙️", label: "Proses",         color: "#f97316" },
  { type: "gridNode",       icon: "🔌", label: "Şebeke Bağl.",   color: "#06b6d4" },
  { type: "solarNode",      icon: "☀️", label: "Güneş PV",       color: "#eab308" },
  { type: "windNode",       icon: "💨", label: "Rüzgar",         color: "#10b981" },
  { type: "emissionCalcNode", icon: "🧮", label: "Emisyon Hesap", color: "#ef4444" },
  { type: "cbamCalcNode",   icon: "🌍", label: "CBAM Hesap",     color: "#dc2626" },
  { type: "cbamReportNode", icon: "📄", label: "CBAM Rapor",     color: "#b91c1c" },
  { type: "scopeGroupNode", icon: "⬡", label: "Scope Grubu",    color: "#475569" },
];

function NodePalette({ card: _card, text, sub, border }: {
  card: string; text: string; sub: string; border: string;
}) {
  return (
    <div>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${border}`,
        fontSize: 12, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        Node Kütüphanesi
      </div>
      <div style={{ padding: 8 }}>
        {NODE_PALETTE_ITEMS.map(item => (
          <div
            key={item.type}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData("application/voltfox-node-type", item.type);
              e.dataTransfer.effectAllowed = "copy";
            }}
            style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "6px 8px", borderRadius: 6, cursor: "grab",
              fontSize: 13, color: text, marginBottom: 2,
              border: `1px solid transparent`,
            }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = border)}
            onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            <span style={{ fontSize: 12 }}>{item.label}</span>
          </div>
        ))}
        <p style={{ fontSize: 11, color: sub, padding: "8px 8px 0", lineHeight: 1.5 }}>
          Sürükleyerek canvas'a bırakın.
        </p>
      </div>
    </div>
  );
}

interface CopilotMessage {
  role: "user" | "assistant";
  text: string;
  addCount?: number;
  connectCount?: number;
}

function CopilotPanel({ card: _card, text, sub, border, graphId, currentNodes, currentEdges, onApply }: {
  card: string; text: string; sub: string; border: string;
  graphId?: string;
  currentNodes: unknown[];
  currentEdges: unknown[];
  onApply: (addNodes: unknown[], addEdges: unknown[]) => void;
}) {
  const [input, setInput]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const messagesEndRef           = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const prompt = input.trim();
    if (!prompt || loading) return;
    setInput("");
    setMessages(m => [...m, { role: "user", text: prompt }]);
    setLoading(true);
    try {
      const res = await api.esgPlayground.copilot({
        graphId,
        prompt,
        currentNodes,
        currentEdges,
      });
      const addNodes   = (res.add     ?? []) as unknown[];
      const addEdges   = (res.connect ?? []) as unknown[];
      setMessages(m => [...m, {
        role: "assistant",
        text: res.message ?? "Canvas güncellendi.",
        addCount:     addNodes.length,
        connectCount: addEdges.length,
      }]);
      if (addNodes.length > 0 || addEdges.length > 0) {
        onApply(addNodes, addEdges);
      }
    } catch {
      setMessages(m => [...m, { role: "assistant", text: "AI servisi geçici olarak kullanılamıyor. Lütfen tekrar deneyin." }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${border}`,
        fontSize: 12, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.05em",
        display: "flex", alignItems: "center", gap: 6,
      }}>
        <span>✨</span> AI Co-Pilot
      </div>

      {/* Mesaj listesi */}
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px", display: "flex", flexDirection: "column", gap: 8 }}>
        {messages.length === 0 && (
          <div style={{ padding: "10px 12px", background: "rgba(16,185,129,0.07)", borderRadius: 8, fontSize: 11, color: sub, lineHeight: 1.6 }}>
            Örnek komutlar:<br />
            <em>"Berlin fabrikamı ekle, DE şebekesine bağla"</em><br />
            <em>"Scope 2 sınır grubu ve solar panel ekle"</em><br />
            <em>"CBAM hesaplama motoru ve rapor çıktısı ekle"</em>
          </div>
        )}
        {messages.map((msg, i) => (
          <div key={i} style={{
            alignSelf: msg.role === "user" ? "flex-end" : "flex-start",
            maxWidth: "90%",
          }}>
            <div style={{
              padding: "7px 10px", borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
              background: msg.role === "user" ? "#3b82f6" : "rgba(100,116,139,0.15)",
              color: msg.role === "user" ? "#fff" : text,
              fontSize: 12, lineHeight: 1.5,
            }}>
              {msg.text}
            </div>
            {msg.role === "assistant" && (msg.addCount ?? 0) + (msg.connectCount ?? 0) > 0 && (
              <div style={{ fontSize: 10, color: "#10b981", marginTop: 3, paddingLeft: 4 }}>
                +{msg.addCount} node, {msg.connectCount} bağlantı eklendi
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div style={{ alignSelf: "flex-start", padding: "7px 12px", borderRadius: "10px 10px 10px 2px", background: "rgba(100,116,139,0.15)", fontSize: 12, color: sub }}>
            <span style={{ animation: "pulse 1s infinite" }}>Düşünüyor…</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "8px 10px", borderTop: `1px solid ${border}`, display: "flex", gap: 6 }}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={loading}
          placeholder="Canvas'a ne ekleyeyim?"
          style={{
            flex: 1, padding: "6px 10px", borderRadius: 6,
            border: `1px solid ${border}`, background: "transparent",
            color: text, fontSize: 12, outline: "none",
          }}
        />
        <button
          onClick={send}
          disabled={loading || !input.trim()}
          style={{
            padding: "6px 10px", borderRadius: 6, border: "none",
            background: loading || !input.trim() ? "#334155" : "#10b981",
            color: "#fff", cursor: loading || !input.trim() ? "default" : "pointer",
            fontSize: 14, transition: "background 0.15s",
          }}
        >
          →
        </button>
      </div>
    </div>
  );
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? "#10b981" : score >= 50 ? "#f59e0b" : "#ef4444";
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{
        width: 48, height: 48, borderRadius: "50%",
        border: `3px solid ${color}`, display: "flex",
        alignItems: "center", justifyContent: "center",
        fontSize: 14, fontWeight: 700, color,
      }}>
        {score}
      </div>
      <div style={{ fontSize: 12 }}>
        <div style={{ fontWeight: 600, color }}>
          {score >= 80 ? "İyi" : score >= 50 ? "Orta" : "Düşük"}
        </div>
        <div style={{ color: "#94a3b8" }}>Tamamlanma skoru</div>
      </div>
    </div>
  );
}

function SimulatorPanel({ simulator, text, sub, border }: {
  simulator: ReturnType<typeof import("../hooks/useSimulator.js").useSimulator>;
  text: string; sub: string; border: string;
}) {
  const [scenName, setScenName] = useState("");

  return (
    <div>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${border}`,
        fontSize: 12, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.05em",
      }}>
        Karbon Simülatörü
      </div>

      <div style={{ padding: "12px 16px" }}>
        {/* Baseline */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Baseline Emisyon</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: text }}>
            {simulator.baselineCo2.toFixed(0)} tCO₂e
          </div>
        </div>

        {!simulator.isSimulating ? (
          <button
            onClick={simulator.startSimulation}
            style={{
              width: "100%", padding: "8px", borderRadius: 6, border: "none",
              background: "#3b82f6", color: "#fff", fontSize: 12, cursor: "pointer",
            }}
          >
            Senaryo Başlat
          </button>
        ) : (
          <>
            {/* Canlı delta */}
            {simulator.liveDelta != null && (
              <div style={{
                padding: "8px 10px", borderRadius: 8, marginBottom: 10,
                background: simulator.liveDelta < 0 ? "rgba(16,185,129,0.1)" : "rgba(239,68,68,0.1)",
              }}>
                <div style={{ fontSize: 11, color: sub }}>Senaryo Etkisi</div>
                <div style={{
                  fontSize: 18, fontWeight: 700,
                  color: simulator.liveDelta < 0 ? "#10b981" : "#ef4444",
                }}>
                  {simulator.liveDelta > 0 ? "+" : ""}{simulator.liveDelta.toFixed(0)} tCO₂e
                </div>
                <div style={{ fontSize: 11, color: sub }}>
                  {simulator.baselineCo2 > 0
                    ? `${((simulator.liveDelta / simulator.baselineCo2) * 100).toFixed(1)}%`
                    : ""}
                </div>
              </div>
            )}

            {/* Senaryo kaydet */}
            <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
              <input
                value={scenName}
                onChange={e => setScenName(e.target.value)}
                placeholder="Senaryo adı..."
                style={{
                  flex: 1, padding: "5px 8px", borderRadius: 5,
                  border: `1px solid ${border}`, background: "transparent",
                  color: text, fontSize: 11,
                }}
              />
              <button
                onClick={() => { if (scenName.trim()) { simulator.saveScenario(scenName); setScenName(""); } }}
                style={{
                  padding: "5px 10px", borderRadius: 5, border: "none",
                  background: "#10b981", color: "#fff", cursor: "pointer", fontSize: 11,
                }}
              >
                Kaydet
              </button>
            </div>

            <button
              onClick={simulator.cancelSimulation}
              style={{
                width: "100%", padding: "6px", borderRadius: 5, border: `1px solid ${border}`,
                background: "transparent", color: sub, fontSize: 11, cursor: "pointer",
              }}
            >
              İptal
            </button>
          </>
        )}

        {/* Senaryo listesi */}
        {simulator.scenarios.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: sub, marginBottom: 6, fontWeight: 600 }}>Senaryolar</div>
            {simulator.scenarios.map(s => {
              const deltas = simulator.getDelta(s.id);
              const total  = deltas.find(d => d.nodeId === "total");
              return (
                <div key={s.id} style={{
                  padding: "6px 8px", borderRadius: 6, marginBottom: 4,
                  border: `1px solid ${border}`, fontSize: 11,
                }}>
                  <div style={{ fontWeight: 600, color: text }}>{s.name}</div>
                  {total && (
                    <div style={{
                      color: total.delta < 0 ? "#10b981" : "#ef4444", marginTop: 2,
                    }}>
                      {total.delta > 0 ? "+" : ""}{total.delta.toFixed(0)} tCO₂e
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const NODE_TYPE_DISPLAY: Record<string, string> = {
  orgNode: "Organizasyon", divisionNode: "Bölüm", facilityNode: "Tesis",
  buildingNode: "Bina", processNode: "Proses", productNode: "Ürün",
  vehicleFleetNode: "Araç Filosu", gridNode: "Şebeke", solarNode: "Solar PV",
  windNode: "Rüzgar", hydroNode: "Hidroelektrik", naturalGasNode: "Doğalgaz",
  ppaContractNode: "PPA Sözleşmesi", meterNode: "Sayaç", apiSourceNode: "API Kaynağı",
  manualEntryNode: "Manuel Giriş", emissionCalcNode: "Emisyon Hesap",
  cfMatchingNode: "CFE Eşleştirme", cbamCalcNode: "CBAM Hesap",
  cbamReportNode: "CBAM Rapor", ghgReportNode: "GHG Raporu", scopeGroupNode: "Scope Grubu",
};

function NodePropertiesPanel({ node, text, sub, border, onChange, onDelete }: {
  node: Node;
  text: string; sub: string; border: string;
  onChange: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const inputStyle = {
    width: "100%", padding: "5px 8px", borderRadius: 5,
    border: `1px solid ${border}`, background: "transparent",
    color: text, fontSize: 12, boxSizing: "border-box" as const,
  };

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ fontSize: 10, color: sub, marginBottom: 12, fontFamily: "monospace" }}>
        {NODE_TYPE_DISPLAY[node.type ?? ""] ?? node.type}
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: sub, display: "block", marginBottom: 4 }}>Başlık</label>
        <input
          value={String(node.data?.label ?? "")}
          onChange={e => onChange(node.id, { label: e.target.value })}
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 11, color: sub, display: "block", marginBottom: 4 }}>Alt Başlık</label>
        <input
          value={String(node.data?.subLabel ?? "")}
          onChange={e => onChange(node.id, { subLabel: e.target.value })}
          placeholder="İsteğe bağlı"
          style={inputStyle}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, color: sub, display: "block", marginBottom: 4 }}>Konum</label>
        <div style={{ fontSize: 11, color: sub, fontFamily: "monospace" }}>
          x: {Math.round(node.position.x)}, y: {Math.round(node.position.y)}
        </div>
      </div>

      <button
        onClick={() => onDelete(node.id)}
        style={{
          width: "100%", padding: "6px", borderRadius: 5, border: "none",
          background: "rgba(239,68,68,0.1)", color: "#ef4444",
          fontSize: 11, cursor: "pointer",
        }}
      >
        🗑 Node'u Sil
      </button>
    </div>
  );
}

function SnapshotsPanel({ graphId, card: _card, text, sub, border }: {
  graphId: string; card: string; text: string; sub: string; border: string;
}) {
  const [snapshots, setSnapshots]   = useState<Array<{ id: string; name: string; createdAt: string; hash: string; reportingPeriod?: string | null }>>([]);
  const [showForm, setShowForm]     = useState(false);
  const [snapName, setSnapName]     = useState("");
  const [reportPeriod, setReportPeriod] = useState("");

  useEffect(() => {
    api.esgPlayground.snapshots.list(graphId)
      .then(s => setSnapshots(s as typeof snapshots))
      .catch(() => null);
  }, [graphId]);

  async function createSnap() {
    if (!snapName.trim()) return;
    await api.esgPlayground.snapshots.create(graphId, {
      name: snapName,
      reportingPeriod: reportPeriod.trim() || undefined,
    });
    const updated = await api.esgPlayground.snapshots.list(graphId);
    setSnapshots(updated as typeof snapshots);
    setShowForm(false);
    setSnapName("");
    setReportPeriod("");
  }

  return (
    <div>
      <div style={{
        padding: "12px 16px", borderBottom: `1px solid ${border}`,
        display: "flex", alignItems: "center", justifyContent: "space-between",
      }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          Anlık Görüntüler
        </span>
        <button
          onClick={() => setShowForm(f => !f)}
          style={{ background: "none", border: "none", color: "#10b981", cursor: "pointer", fontSize: 18 }}
        >
          +
        </button>
      </div>
      {showForm && (
        <div style={{ padding: "10px 12px", borderBottom: `1px solid ${border}` }}>
          <input
            value={snapName}
            onChange={e => setSnapName(e.target.value)}
            placeholder="Görüntü adı (örn: Q1 2025 Denetim)"
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 6,
              border: `1px solid ${border}`, background: "transparent",
              color: text, fontSize: 12, boxSizing: "border-box", marginBottom: 6,
            }}
          />
          <input
            value={reportPeriod}
            onChange={e => setReportPeriod(e.target.value)}
            placeholder="Raporlama dönemi (isteğe bağlı)"
            style={{
              width: "100%", padding: "6px 8px", borderRadius: 6,
              border: `1px solid ${border}`, background: "transparent",
              color: text, fontSize: 12, boxSizing: "border-box", marginBottom: 6,
            }}
          />
          <button
            onClick={createSnap}
            style={{
              width: "100%", padding: "6px", borderRadius: 6, border: "none",
              background: "#10b981", color: "#fff", fontSize: 12, cursor: "pointer",
            }}
          >
            🔒 Dondur & Kaydet
          </button>
        </div>
      )}
      <div style={{ padding: "8px 0" }}>
        {snapshots.length === 0 ? (
          <p style={{ fontSize: 12, color: sub, padding: "0 16px" }}>Henüz anlık görüntü yok.</p>
        ) : (
          snapshots.map(s => (
            <div key={s.id} style={{
              padding: "8px 16px", borderBottom: `1px solid ${border}`,
              fontSize: 12,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ fontWeight: 600, color: text }}>{s.name}</div>
                <span style={{ fontSize: 10, color: "#10b981" }}>🔒</span>
              </div>
              {s.reportingPeriod && (
                <div style={{ fontSize: 10, color: "#3b82f6", marginTop: 1 }}>
                  📅 {s.reportingPeriod}
                </div>
              )}
              <div style={{ color: sub, marginTop: 2, fontSize: 11 }}>
                {new Date(s.createdAt).toLocaleDateString("tr-TR")}
              </div>
              <div style={{ color: sub, fontSize: 9, marginTop: 1, fontFamily: "monospace" }}>
                SHA-256: {s.hash.slice(0, 16)}…
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
