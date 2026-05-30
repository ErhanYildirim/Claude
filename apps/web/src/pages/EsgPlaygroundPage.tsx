import { useState, useCallback, useRef, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ReactFlow, Background, Controls, MiniMap,
  addEdge, applyNodeChanges, applyEdgeChanges,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange,
  type OnConnect, type Viewport, type ReactFlowInstance,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "../lib/api.js";
import type { EsgGraph } from "../lib/api.js";
import { dispatchResourceUpdate } from "../lib/canvasSync.js";
import { nodeTypes } from "../components/esg-canvas/nodeTypes.js";
import { edgeTypes } from "../components/esg-canvas/edges/CustomEdges.js";
import { useCanvasLiveData } from "../hooks/useEsgNodeData.js";
import { useViewMode, VIEW_MODE_LABELS, type ViewMode, NODE_VISIBILITY } from "../hooks/useViewMode.js";
import { useValidationEngine } from "../hooks/useValidationEngine.js";
import { useSimulator } from "../hooks/useSimulator.js";
import { ImportWizardModal } from "../components/esg-canvas/ImportWizardModal.js";
import { PlatformResourcesPanel } from "../components/esg-canvas/PlatformResourcesPanel.js";
import { NewCanvasWizardModal } from "../components/esg-canvas/NewCanvasWizardModal.js";
import { useCanvasHistory } from "../hooks/useCanvasHistory.js";
import { useCollaboration } from "../hooks/useCollaboration.js";
import { CollaborationOverlay } from "../components/esg-canvas/CollaborationOverlay.js";
import { CanvasValidator } from "../components/esg-canvas/CanvasValidator.js";
import { useCanvasValidation } from "../hooks/useCanvasValidation.js";
import { DeleteNodeDialog } from "../components/esg-canvas/DeleteNodeDialog.js";
import { CanvasActionBar } from "../components/esg-canvas/CanvasActionBar.js";
import { toPng } from "html-to-image";

// ── Canvas boyutu değişirse bu key React Flow'u sıfırlar
const FLOW_KEY = "esg-canvas-v1";

export default function EsgPlaygroundPage() {
  const { graphId } = useParams<{ graphId?: string }>();
  const navigate    = useNavigate();
  const [searchParams] = useSearchParams();

  const [graph, setGraph]           = useState<EsgGraph | null>(null);
  const [nodes, setNodes]           = useState<Node[]>([]);
  const [edges, setEdges]           = useState<Edge[]>([]);
  const [loading, setLoading]       = useState(true);
  const [saving, setSaving]         = useState(false);
  const [lastSaved, setLastSaved]   = useState<Date | null>(null);
  const [dirty, setDirty]           = useState(false);
  const [listError, setListError]   = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { mode, changeMode, visibleNodes, visibleEdges } = useViewMode(nodes, edges);
  const validation        = useValidationEngine(nodes, edges);
  const canvasValidation  = useCanvasValidation(nodes, edges);
  const simulator         = useSimulator(nodes, edges);
  const [rightPanel, setRightPanel] = useState<"properties" | "snapshots" | "validation" | "simulator" | null>(null);
  const [leftPanel, setLeftPanel]   = useState<"nodes" | "resources" | "workflows">("nodes");
  const [copilotOpen, setCopilotOpen] = useState(true);
  const [showGraphList, setShowGraphList]         = useState(false);
  const [showImportModal, setShowImportModal]     = useState(false);
  const [showNewWizard, setShowNewWizard]         = useState(false);
  const [searchQuery, setSearchQuery]         = useState("");
  const [showSearch, setShowSearch]           = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);
  const history   = useCanvasHistory([], []);
  const [graphList, setGraphList]   = useState<EsgGraph[]>([]);
  const collab = useCollaboration(graphId, !!graphId);
  const [commentMode, setCommentMode] = useState(false);
  const [rfInstance, setRfInstance]   = useState<ReactFlowInstance | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [editingName, setEditingName]         = useState(false);
  const [draftName,   setDraftName]           = useState("");
  const [deleteDialogNode, setDeleteDialogNode] = useState<Node | null>(null);
  const [confirmDeleteGraphId, setConfirmDeleteGraphId] = useState<string | null>(null);
  const selectedNode = selectedNodeId ? nodes.find(n => n.id === selectedNodeId) ?? null : null;
  const selectedEdge = selectedEdgeId ? edges.find(e => e.id === selectedEdgeId) ?? null : null;

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

  const viewportRef    = useRef<Viewport>({ x: 0, y: 0, zoom: 1 });
  const saveTimerRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nodesRef       = useRef<Node[]>([]);
  const edgesRef       = useRef<Edge[]>([]);
  const initialLoadRef = useRef(true); // ilk yüklemede auto-save'i engelle
  nodesRef.current     = nodes;
  edgesRef.current     = edges;

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
      // graphId varsa liste görünümünü kapat — aksi hâlde navigasyon sonrası liste takılı kalır
      if (graphId) {
        setShowGraphList(false);
        setGraph(null);
        setNodes([]);
        setEdges([]);
        initialLoadRef.current = true; // yeni canvas yüklendiğinde flag sıfırla
      }
      try {
        if (graphId) {
          const [g, list] = await Promise.all([
            api.esgPlayground.get(graphId),
            api.esgPlayground.list(),
          ]);
          setGraph(g);
          setNodes((g.nodesJson as Node[]) ?? []);
          setEdges((g.edgesJson as Edge[]) ?? []);
          if (g.viewport) viewportRef.current = g.viewport as Viewport;
          setGraphList(list);
          // Yükleme bitti — artık kullanıcı değişikliklerini kaydet
          setTimeout(() => { initialLoadRef.current = false; }, 100);
        } else {
          // Liste yükle — henüz açık canvas yok
          const list = await api.esgPlayground.list();
          setGraphList(list);
          setShowGraphList(true);
        }
      } catch (err) {
        console.error("[ESGPlayground] load error", err);
        if (graphId) {
          // Canvas yüklenemedi → listeye geri dön
          navigate("/esg-playground");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [graphId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-save (debounce 3 sn) ────────────────────────────────────────────
  const scheduleSave = useCallback(() => {
    if (!graphId) return;
    // İlk yükleme sonrası state set edilmesi kaydetme tetiklemesin
    if (initialLoadRef.current) return;
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

  // ── Node silme — kaynak bağlıysa dialog, değilse direkt sil ──────────────
  function requestDeleteNode(node: Node) {
    if (node.data?.sourceId) {
      setDeleteDialogNode(node);
    } else {
      commitDeleteNode(node.id);
    }
  }

  function commitDeleteNode(id: string) {
    history.pushHistory(nodesRef.current, edgesRef.current);
    setNodes(nds => nds.filter(n => n.id !== id));
    setEdges(eds => eds.filter(e => e.source !== id && e.target !== id));
    setSelectedNodeId(null);
    setDeleteDialogNode(null);
    scheduleSave();
  }

  // ── Node kopyala ──────────────────────────────────────────────────────────
  function duplicateNode(node: Node) {
    const cloned: Node = {
      ...node,
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      position: { x: node.position.x + 30, y: node.position.y + 30 },
      data: Object.assign({}, node.data) as Record<string, unknown>,
    };
    history.pushHistory(nodesRef.current, edgesRef.current);
    setNodes(nds => [...nds, cloned]);
    scheduleSave();
  }

  // ── Yeni canvas wizard ────────────────────────────────────────────────────
  function handleWizardCreated(graphId: string) {
    setShowNewWizard(false);
    navigate(`/esg-playground/${graphId}`);
  }

  // ── Canvas sil (listeden) ─────────────────────────────────────────────────
  async function deleteGraph(e: React.MouseEvent, id: string) {
    e.stopPropagation();
    if (confirmDeleteGraphId !== id) {
      setConfirmDeleteGraphId(id);
      return;
    }
    setConfirmDeleteGraphId(null);
    setDeletingId(id);
    setListError(null);
    try {
      await api.esgPlayground.delete(id);
      setGraphList(prev => prev.filter(g => g.id !== id));
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : "Canvas silinemedi. Lütfen tekrar deneyin.");
    } finally {
      setDeletingId(null);
    }
  }

  // ── Canvas sil (editor içinden) ──────────────────────────────────────────
  async function deleteCurrentGraph() {
    if (!graphId || !graph) return;
    setDeleteDialogNode({ id: "__graph__", type: "__graph__", position: { x: 0, y: 0 }, data: { label: graph.name, __isGraphDelete: true } } as Node);
  }

  async function commitDeleteCurrentGraph() {
    if (!graphId) return;
    setDeleteDialogNode(null);
    try {
      await api.esgPlayground.delete(graphId);
      navigate("/esg-playground");
    } catch (err: unknown) {
      setListError(err instanceof Error ? err.message : "Canvas silinemedi.");
    }
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
        setCopilotOpen(o => !o);
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
    const type       = e.dataTransfer.getData("application/voltfox-node-type");
    if (!type || !rfInstance) return;
    const sourceId   = e.dataTransfer.getData("application/voltfox-source-id");
    const sourceType = e.dataTransfer.getData("application/voltfox-source-type");
    const sourceName = e.dataTransfer.getData("application/voltfox-source-name");
    const position   = rfInstance.screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const label      = sourceName || (NODE_DROP_LABELS[type] ?? type);
    const newNode: Node = {
      id: `node-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      type,
      position,
      data: {
        label,
        ...(sourceId   && { sourceId }),
        ...(sourceType && { sourceType }),
      },
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

  // ── ?highlight=type:id → ilgili node'u bul, seç ve fitView ─────────────────
  useEffect(() => {
    if (!rfInstance || nodes.length === 0) return;
    const highlight = searchParams.get("highlight");
    if (!highlight) return;
    const [sourceType, sourceId] = highlight.split(":");
    if (!sourceType || !sourceId) return;
    const target = nodes.find(n =>
      n.data?.sourceId === sourceId && n.data?.sourceType === sourceType
    );
    if (!target) return;
    setSelectedNodeId(target.id);
    setRightPanel("properties");
    // Kısa gecikme: React Flow'un layout'u yerleştirmesi için
    setTimeout(() => {
      rfInstance.fitView({ nodes: [{ id: target.id }], duration: 600, padding: 0.3 });
    }, 150);
  }, [rfInstance, nodes.length, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Kaydedilmedi uyarısı ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (dirty) { e.preventDefault(); e.returnValue = ""; }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // ── Platform kaynak güncelleme olaylarını dinle ───────────────────────────
  useEffect(() => {
    function handleResourceUpdate(e: Event) {
      const { sourceType, sourceId, changes } = (e as CustomEvent).detail as {
        sourceType: string; sourceId: string; changes: Record<string, unknown>;
      };
      setNodes(nds => nds.map(n => {
        if (n.data?.sourceId !== sourceId || n.data?.sourceType !== sourceType) return n;
        return {
          ...n,
          data: {
            ...n.data,
            ...(changes.name    !== undefined ? { label: changes.name }                                           : {}),
            ...(changes.deleted               ? { _deleted: true, label: `⚠ Silinmiş — ${n.data.label as string}` } : {}),
          },
        };
      }));
      scheduleSave();
    }
    window.addEventListener("voltfox:resource-updated", handleResourceUpdate);
    return () => window.removeEventListener("voltfox:resource-updated", handleResourceUpdate);
  }, [scheduleSave]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── ?highlight param: liste açıkken kaynağı içeren canvas'a yönlendir ──────
  useEffect(() => {
    const highlight = searchParams.get("highlight");
    if (!highlight || !showGraphList || graphList.length === 0) return;
    const [sourceType, sourceId] = highlight.split(":");
    if (!sourceType || !sourceId) return;
    // Tüm canvasların nodes verisine bakarak sourceId'yi bul
    // Basit heuristic: ilk canvas'a yönlendir (tam arama çok pahalı)
    // Gerçek uygulamada API endpoint gerekir; şimdilik ilk canvas'a git
    const firstGraph = graphList[0];
    if (firstGraph) navigate(`/esg-playground/${firstGraph.id}?highlight=${highlight}`);
  }, [showGraphList, graphList, searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

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
            onClick={() => setShowNewWizard(true)}
            style={{
              padding: "8px 16px", borderRadius: 8, border: "none",
              background: "#10b981", color: "#fff", fontSize: 14,
              fontWeight: 600, cursor: "pointer",
            }}
          >
            + Yeni Canvas
          </button>
        </div>
        {listError && (
          <div style={{
            background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8,
            padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "#dc2626",
            display: "flex", alignItems: "center", gap: 8,
          }}>
            ⚠️ {listError}
            <button
              onClick={() => setListError(null)}
              style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "#dc2626", fontSize: 16 }}
            >×</button>
          </div>
        )}
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
              onClick={() => setShowNewWizard(true)}
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
                {/* Sil butonu — iki adımlı onay */}
                {confirmDeleteGraphId === g.id ? (
                  <div
                    style={{ position: "absolute", top: 8, right: 8, display: "flex", gap: 4 }}
                    onClick={e => e.stopPropagation()}
                  >
                    <button
                      onClick={e => deleteGraph(e, g.id)}
                      style={{
                        padding: "3px 8px", borderRadius: 4, border: "none",
                        background: "#ef4444", color: "#fff", fontSize: 11,
                        fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      Evet, sil
                    </button>
                    <button
                      onClick={e => { e.stopPropagation(); setConfirmDeleteGraphId(null); }}
                      style={{
                        padding: "3px 8px", borderRadius: 4, border: "none",
                        background: "#e2e8f0", color: "#475569", fontSize: 11,
                        fontWeight: 600, cursor: "pointer",
                      }}
                    >
                      İptal
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={e => deleteGraph(e, g.id)}
                    title="Canvas'ı sil"
                    disabled={deletingId === g.id}
                    style={{
                      position: "absolute", top: 10, right: 10,
                      background: "none", border: "none",
                      color: deletingId === g.id ? "#ef4444" : sub,
                      cursor: deletingId === g.id ? "default" : "pointer",
                      fontSize: 14, padding: "2px 6px", borderRadius: 4,
                      lineHeight: 1, opacity: deletingId === g.id ? 1 : 0.6,
                    }}
                    onMouseEnter={e => { if (deletingId !== g.id) { e.currentTarget.style.opacity = "1"; e.currentTarget.style.color = "#ef4444"; } }}
                    onMouseLeave={e => { if (deletingId !== g.id) { e.currentTarget.style.opacity = "0.6"; e.currentTarget.style.color = sub; } }}
                  >
                    {deletingId === g.id ? "⏳" : "🗑"}
                  </button>
                )}
                <div style={{ fontSize: 32, marginBottom: 8 }}>🕸️</div>
                <div style={{ fontSize: 15, fontWeight: 600, color: text, marginBottom: 4 }}>{g.name}</div>
                {g.description && (
                  <div style={{ fontSize: 12, color: sub, marginBottom: 8 }}>{g.description}</div>
                )}
                <div style={{ fontSize: 11, color: sub }}>
                  {new Date(g.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                </div>
                <button
                  data-testid={`report-btn-${g.id}`}
                  disabled={deletingId === g.id}
                  onClick={e => { e.stopPropagation(); navigate(`/esg-playground/${g.id}/report`); }}
                  style={{
                    marginTop: 10, width: "100%",
                    padding: "5px 0", borderRadius: 6,
                    border: `1px solid ${border}`, background: "transparent",
                    color: sub, fontSize: 11, fontWeight: 600, cursor: deletingId === g.id ? "not-allowed" : "pointer",
                    opacity: deletingId === g.id ? 0.4 : 1,
                    transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => { if (deletingId !== g.id) { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.color = "#10b981"; } }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = sub; }}
                >
                  📊 Raporu Görüntüle
                </button>
              </div>
            ))}
            <div
              onClick={() => setShowNewWizard(true)}
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

      {showNewWizard && (
        <NewCanvasWizardModal
          isDark={isDark}
          onClose={() => setShowNewWizard(false)}
          onCreated={handleWizardCreated}
        />
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
    <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: bg }}>
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
        background: card, flexShrink: 0, gap: 8,
        overflow: "hidden", flexWrap: "nowrap", minHeight: 44,
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
          {editingName ? (
            <input
              autoFocus
              value={draftName}
              onChange={e => setDraftName(e.target.value)}
              onBlur={async () => {
                setEditingName(false);
                if (draftName.trim() && draftName.trim() !== graph?.name && graphId) {
                  await api.esgPlayground.update(graphId, { name: draftName.trim() });
                  setGraph(g => g ? { ...g, name: draftName.trim() } : g);
                }
              }}
              onKeyDown={e => {
                if (e.key === "Enter") e.currentTarget.blur();
                if (e.key === "Escape") setEditingName(false);
              }}
              style={{
                fontSize: 13, fontWeight: 600, color: text,
                background: "transparent", border: `1px solid ${border}`,
                borderRadius: 4, padding: "2px 6px", outline: "none", minWidth: 120,
              }}
            />
          ) : (
            <span
              style={{ fontSize: 13, fontWeight: 600, color: text, cursor: "text" }}
              title="Düzenlemek için tıkla"
              onClick={() => { setDraftName(graph?.name ?? "Canvas"); setEditingName(true); }}
            >
              {graph?.name ?? "Canvas"}
            </span>
          )}
        </div>

        {/* Orta: view mode + panel toggles */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", flexShrink: 1, overflow: "hidden", flexWrap: "nowrap" }}>
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
            { key: "nodes",     label: "Nodlar" },
            { key: "resources", label: "Kaynaklar" },
            { key: "workflows", label: "İş Akışları" },
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setLeftPanel(btn.key as "nodes" | "resources" | "workflows")}
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
          <button
            onClick={() => setCopilotOpen(o => !o)}
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 12,
              border: `1px solid ${border}`, cursor: "pointer",
              background: copilotOpen ? "#10b981" : card,
              color:      copilotOpen ? "#fff"    : text,
            }}
          >
            ✨ AI
          </button>
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
        <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: sub, flexShrink: 0, flexWrap: "nowrap" }}>
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
            onClick={() => graphId && navigate(`/esg-playground/${graphId}/report`)}
            title="Canvas Raporu"
            data-testid="toolbar-report-btn"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: card, color: text, cursor: "pointer" }}
          >
            📊
          </button>
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
          <button
            onClick={deleteCurrentGraph}
            title="Bu canvas'ı sil"
            style={{
              padding: "4px 10px", borderRadius: 6, fontSize: 12,
              border: `1px solid #fecaca`, background: "#fef2f2", color: "#dc2626", cursor: "pointer",
            }}
          >
            🗑
          </button>
        </div>
      </div>

      {/* ── Ana alan: sol panel + canvas + sağ panel ─────────────────────── */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sol panel — overflow: hidden; her child kendi scroll'unu yönetir */}
        <div style={{
          flex: "0 0 220px", minWidth: 0, maxWidth: 220,
          borderRight: `1px solid ${border}`,
          background: card, overflow: "hidden",
          display: "flex", flexDirection: "column",
        }}>
          {leftPanel === "nodes" && <NodePalette card={card} text={text} sub={sub} border={border} mode={mode} />}
          {leftPanel === "resources" && (
            <PlatformResourcesPanel text={text} sub={sub} border={border} />
          )}
          {leftPanel === "workflows" && (
            <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
              <div style={{ padding: "10px 14px", borderBottom: `1px solid ${border}`, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: "uppercase" as const, letterSpacing: "0.05em" }}>İş Akışları</span>
                <button
                  onClick={() => setShowNewWizard(true)}
                  style={{ padding: "2px 8px", borderRadius: 5, border: "none", background: "#10b981", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                >+ Yeni</button>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px 10px" }}>
                {graphList.length === 0 ? (
                  <div style={{ fontSize: 11, color: sub, padding: "16px 8px", textAlign: "center" as const, lineHeight: 1.6 }}>
                    Henüz canvas yok.<br />Yeni oluşturmak için + Yeni'ye tıklayın.
                  </div>
                ) : (
                  graphList.map(g => (
                    <div
                      key={g.id}
                      onClick={() => navigate(`/esg-playground/${g.id}`)}
                      style={{
                        display: "flex", alignItems: "flex-start", gap: 7,
                        padding: "7px 8px", borderRadius: 6, cursor: "pointer",
                        marginBottom: 2,
                        border: g.id === graphId ? `1px solid #10b981` : "1px solid transparent",
                        background: g.id === graphId ? "rgba(16,185,129,0.08)" : "transparent",
                      }}
                      onMouseEnter={e => { if (g.id !== graphId) { e.currentTarget.style.borderColor = border; e.currentTarget.style.background = "rgba(16,185,129,0.04)"; } }}
                      onMouseLeave={e => { if (g.id !== graphId) { e.currentTarget.style.borderColor = "transparent"; e.currentTarget.style.background = "transparent"; } }}
                    >
                      <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>🕸️</span>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 11.5, color: g.id === graphId ? "#10b981" : text, fontWeight: g.id === graphId ? 700 : 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const }}>
                          {g.name}
                        </div>
                        <div style={{ fontSize: 10, color: sub }}>
                          {new Date(g.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short" })}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Canvas */}
        <div
          ref={canvasRef}
          style={{ flex: 1, minWidth: 0, position: "relative", overflow: "hidden", cursor: commentMode ? "crosshair" : "default" }}
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
            onNodeClick={(_, node) => { setSelectedEdgeId(null); setSelectedNodeId(node.id); setRightPanel("properties"); }}
            onEdgeClick={(_, edge) => { setSelectedNodeId(null); setSelectedEdgeId(edge.id); setRightPanel("properties"); }}
            onPaneClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }}
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
            onMove={(_, vp) => { viewportRef.current = vp; }}
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

          {/* Floating action bar — seçili node'un üzerinde bağlamsal toolbar */}
          {selectedNode && rfInstance && (
            <CanvasActionBar
              node={selectedNode}
              rfInstance={rfInstance}
              isDark={isDark}
              onDelete={node => requestDeleteNode(node)}
              onDuplicate={node => duplicateNode(node)}
            />
          )}

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

          {/* Canvas Completeness Validator — sağ alt */}
          {nodes.length > 0 && (
            <CanvasValidator
              result={canvasValidation}
              isDark={isDark}
              onSelectNode={nodeId => {
                setSelectedNodeId(nodeId);
                setRightPanel("properties");
                const target = nodes.find(n => n.id === nodeId);
                if (target && rfInstance) {
                  rfInstance.fitView({ nodes: [{ id: nodeId }], duration: 500, padding: 0.3 });
                }
              }}
            />
          )}
        </div>

        {/* Sağ panel */}
        {rightPanel && (
          <div style={{
            flex: "0 0 280px", minWidth: 0, maxWidth: 280,
            borderLeft: `1px solid ${border}`,
            background: card, overflowX: "hidden", overflowY: "auto",
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
                      const n = nodesRef.current.find(nd => nd.id === id);
                      if (n) requestDeleteNode(n);
                    }}
                  />
                ) : selectedEdge ? (
                  <EdgePropertiesPanel
                    edge={selectedEdge}
                    nodes={nodes}
                    text={text} sub={sub} border={border}
                    onDelete={(id) => {
                      history.pushHistory(nodesRef.current, edgesRef.current);
                      setEdges(eds => eds.filter(e => e.id !== id));
                      setSelectedEdgeId(null);
                      scheduleSave();
                    }}
                  />
                ) : (
                  <p style={{ fontSize: 13, color: sub, padding: "0 16px" }}>
                    Bir node veya bağlantı seçin.
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

      {/* ── AI Copilot — canvas altı sabit bar ────────────────────────────── */}
      {copilotOpen && (
        <div style={{
          flexShrink: 0,
          height: 300,
          borderTop: `1px solid ${border}`,
          background: card,
          display: "flex",
          flexDirection: "column",
        }}>
          {/* Bar başlık + kapat */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "6px 14px", borderBottom: `1px solid ${border}`,
            flexShrink: 0,
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.05em" }}>
              ✨ AI Co-Pilot
            </span>
            <button
              onClick={() => setCopilotOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: sub, fontSize: 16, lineHeight: 1, padding: "0 2px" }}
              title="Kapat"
            >
              ×
            </button>
          </div>
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
        </div>
      )}

      {/* Node silme dialog — kaynak bağlıysa cascade uyarısı; canvas silme için de kullanılır */}
      {deleteDialogNode && (
        deleteDialogNode.data?.__isGraphDelete
          ? (
            <div style={{
              position: "fixed", inset: 0, background: isDark ? "rgba(0,0,0,0.7)" : "rgba(0,0,0,0.4)",
              zIndex: 9500, display: "flex", alignItems: "center", justifyContent: "center", padding: 24,
            }}
              onClick={e => { if (e.target === e.currentTarget) setDeleteDialogNode(null); }}
            >
              <div style={{
                background: isDark ? "#1a1d27" : "#fff", borderRadius: 14,
                border: `1px solid ${border}`, width: "100%", maxWidth: 380,
                padding: 24, boxShadow: "0 16px 48px rgba(0,0,0,0.25)",
              }}>
                <div style={{ fontSize: 16, fontWeight: 700, color: isDark ? "#f1f5f9" : "#1e293b", marginBottom: 8 }}>
                  Canvas'ı Sil
                </div>
                <div style={{ fontSize: 13, color: isDark ? "#94a3b8" : "#64748b", marginBottom: 20, lineHeight: 1.5 }}>
                  <strong>"{deleteDialogNode.data.label as string}"</strong> canvas'ı kalıcı olarak silinecek. Geri alınamaz.
                </div>
                <button
                  onClick={commitDeleteCurrentGraph}
                  style={{
                    width: "100%", padding: "10px 14px", borderRadius: 8, marginBottom: 8,
                    border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                  }}
                >
                  Evet, kalıcı olarak sil
                </button>
                <button
                  onClick={() => setDeleteDialogNode(null)}
                  style={{
                    width: "100%", padding: "8px 14px", borderRadius: 8,
                    border: `1px solid ${border}`, background: "transparent",
                    color: isDark ? "#94a3b8" : "#64748b", fontSize: 13, cursor: "pointer",
                  }}
                >
                  İptal
                </button>
              </div>
            </div>
          )
          : (
            <DeleteNodeDialog
              node={deleteDialogNode}
              isDark={isDark}
              onDeleteNode={() => commitDeleteNode(deleteDialogNode.id)}
              onDeleteCascade={() => commitDeleteNode(deleteDialogNode.id)}
              onCancel={() => setDeleteDialogNode(null)}
            />
          )
      )}
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

const NODE_PALETTE_GROUPS: Array<{
  label: string;
  items: Array<{ type: string; icon: string; label: string }>;
}> = [
  {
    label: "Organizasyon",
    items: [
      { type: "orgNode",        icon: "🏢", label: "Organizasyon" },
      { type: "divisionNode",   icon: "🏬", label: "Bölüm" },
      { type: "facilityNode",   icon: "🏭", label: "Tesis" },
      { type: "buildingNode",   icon: "🏗", label: "Bina" },
      { type: "processNode",    icon: "⚙️", label: "Proses" },
      { type: "productNode",    icon: "📦", label: "Ürün (CBAM)" },
    ],
  },
  {
    label: "Enerji Kaynakları",
    items: [
      { type: "gridNode",         icon: "🔌", label: "Şebeke" },
      { type: "solarNode",        icon: "☀️", label: "Solar PV" },
      { type: "windNode",         icon: "💨", label: "Rüzgar" },
      { type: "hydroNode",        icon: "💧", label: "Hidroelektrik" },
      { type: "naturalGasNode",   icon: "🔥", label: "Doğalgaz" },
      { type: "vehicleFleetNode", icon: "🚗", label: "Araç Filosu" },
      { type: "ppaContractNode",  icon: "📃", label: "PPA / EAC" },
    ],
  },
  {
    label: "Veri & Hesaplama",
    items: [
      { type: "meterNode",        icon: "⚡", label: "Sayaç" },
      { type: "apiSourceNode",    icon: "🔗", label: "API Kaynağı" },
      { type: "manualEntryNode",  icon: "✏️", label: "Manuel Giriş" },
      { type: "emissionCalcNode", icon: "🧮", label: "Emisyon Hesap" },
      { type: "cfMatchingNode",   icon: "⚖️", label: "CFE Eşleştirme" },
      { type: "cbamCalcNode",     icon: "🌍", label: "CBAM Hesap" },
    ],
  },
  {
    label: "Çıktı / Rapor",
    items: [
      { type: "cbamReportNode",  icon: "📄", label: "CBAM Rapor" },
      { type: "ghgReportNode",   icon: "📊", label: "GHG Raporu" },
      { type: "scopeGroupNode",  icon: "⬡",  label: "Scope Grubu" },
    ],
  },
];

function NodePalette({ card: _card, text, sub, border, mode }: {
  card: string; text: string; sub: string; border: string; mode: ViewMode;
}) {
  const visibleTypes = NODE_VISIBILITY[mode];
  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      <div style={{
        padding: "10px 14px", borderBottom: `1px solid ${border}`,
        fontSize: 11, fontWeight: 700, color: sub, textTransform: "uppercase", letterSpacing: "0.05em",
        flexShrink: 0,
      }}>
        Node Kütüphanesi
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 4px 10px" }}>
        {NODE_PALETTE_GROUPS.map(group => {
          const groupVisible = group.items.some(i => visibleTypes.has(i.type));
          return (
            <div key={group.label}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: sub, textTransform: "uppercase",
                letterSpacing: "0.06em", padding: "8px 8px 3px",
                opacity: groupVisible ? 1 : 0.4,
              }}>
                {group.label}
              </div>
              {group.items.map(item => {
                const isVisible = visibleTypes.has(item.type);
                return (
                  <div
                    key={item.type}
                    draggable
                    onDragStart={e => {
                      e.dataTransfer.setData("application/voltfox-node-type", item.type);
                      e.dataTransfer.setData("application/voltfox-node-visible", isVisible ? "1" : "0");
                      e.dataTransfer.effectAllowed = "copy";
                    }}
                    title={isVisible ? undefined : `Bu node mevcut modda (${mode}) görünmez. Organizasyon moduna geçin.`}
                    style={{
                      display: "flex", alignItems: "center", gap: 7,
                      padding: "5px 8px", borderRadius: 5,
                      cursor: "grab", marginBottom: 1,
                      border: "1px solid transparent",
                      opacity: isVisible ? 1 : 0.35,
                      color: text,
                      userSelect: "none" as const,
                    }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = border)}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "transparent")}
                  >
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{item.icon}</span>
                    <span style={{ fontSize: 11.5 }}>{item.label}</span>
                    {!isVisible && (
                      <span style={{ marginLeft: "auto", fontSize: 10, color: sub }}>👁‍🗨</span>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: sub, padding: "8px 8px 0", lineHeight: 1.6 }}>
          Sürükle &amp; bırak ile ekle.<br />
          <span style={{ opacity: 0.7 }}>Soluk görünenler mevcut modda gizli.</span>
        </div>
      </div>
    </div>
  );
}

interface CopilotMessage {
  role: "user" | "assistant";
  text: string;
  addCount?: number;
  connectCount?: number;
  isSetupError?: boolean;
}

const MODEL_OPTIONS = [
  { value: "claude-sonnet-4-6",       label: "Claude Sonnet 4.6",   group: "Anthropic" },
  { value: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5",  group: "Anthropic" },
  { value: "claude-opus-4-7",         label: "Claude Opus 4.7",     group: "Anthropic" },
  { value: "gpt-4o",                  label: "GPT-4o",              group: "OpenAI" },
  { value: "gpt-4o-mini",             label: "GPT-4o Mini",         group: "OpenAI" },
  { value: "gemini-2.0-flash",        label: "Gemini 2.0 Flash",    group: "Google" },
  { value: "gemini-1.5-pro",          label: "Gemini 1.5 Pro",      group: "Google" },
];

function CopilotPanel({ card: _card, text, sub, border, graphId, currentNodes, currentEdges, onApply }: {
  card: string; text: string; sub: string; border: string;
  graphId?: string;
  currentNodes: unknown[];
  currentEdges: unknown[];
  onApply: (addNodes: unknown[], addEdges: unknown[]) => void;
}) {
  const [input,         setInput]         = useState("");
  const [loading,       setLoading]       = useState(false);
  const [messages,      setMessages]      = useState<CopilotMessage[]>([]);
  const [selectedModel, setSelectedModel] = useState("claude-sonnet-4-6");
  const messagesEndRef                     = useRef<HTMLDivElement>(null);

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
        model: selectedModel,
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
    } catch (err: unknown) {
      const status  = (err as { status?: number })?.status;
      const apiMsg  = (err as { body?: { message?: string } })?.body?.message;
      const text    = status === 503
        ? "⚙️ AI yapılandırılmamış — Ayarlar > AI Modeller'den API anahtarı ekleyin."
        : status === 429
        ? (apiMsg ?? "API istek kotası aşıldı. Lütfen sağlayıcınızın planını kontrol edin.")
        : (apiMsg ?? "AI servisi geçici olarak kullanılamıyor. Lütfen tekrar deneyin.");
      const isSetupError = status === 503;
      setMessages(m => [...m, { role: "assistant", text, isSetupError }]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
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
            maxWidth: "92%",
          }}>
            <div style={{
              padding: "7px 10px", borderRadius: msg.role === "user" ? "10px 10px 2px 10px" : "10px 10px 10px 2px",
              background: msg.isSetupError
                ? "rgba(245,158,11,0.12)"
                : msg.role === "user" ? "#3b82f6" : "rgba(100,116,139,0.15)",
              border: msg.isSetupError ? "1px solid rgba(245,158,11,0.4)" : "none",
              color: msg.role === "user" ? "#fff" : text,
              fontSize: 12, lineHeight: 1.5,
              wordBreak: "break-word", overflowWrap: "anywhere",
            }}>
              {msg.text}
              {msg.isSetupError && (
                <div style={{ marginTop: 6 }}>
                  <a
                    href="/settings"
                    onClick={e => { e.preventDefault(); window.location.href = "/settings"; }}
                    style={{
                      display: "inline-block", fontSize: 11, fontWeight: 600,
                      color: "#f59e0b", textDecoration: "underline", cursor: "pointer",
                    }}
                  >
                    → Ayarlar &gt; AI Modeller'e git
                  </a>
                </div>
              )}
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

      {/* Model seçici */}
      <div style={{ padding: "4px 10px", borderTop: `1px solid ${border}`, display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
        <span style={{ fontSize: 10, color: sub, whiteSpace: "nowrap" as const }}>Model:</span>
        <select
          value={selectedModel}
          onChange={e => setSelectedModel(e.target.value)}
          style={{
            flex: 1, fontSize: 11, color: text, background: "transparent",
            border: `1px solid ${border}`, borderRadius: 4, padding: "2px 4px", cursor: "pointer",
          }}
        >
          {["Anthropic", "OpenAI", "Google"].map(group => (
            <optgroup key={group} label={group}>
              {MODEL_OPTIONS.filter(m => m.group === group).map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </optgroup>
          ))}
        </select>
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

const SOURCE_TYPE_LABELS: Record<string, { label: string; path: (id: string) => string }> = {
  installation: { label: "Tesis (CBAM)", path: id => `/installations/${id}` },
  cbamFacility: { label: "CBAM Tesisi",  path: id => `/cbam/facilities/${id}` },
  cbamProduct:  { label: "CBAM Ürünü",   path: () => "/cbam" },
};

function NodePropertiesPanel({ node, text, sub, border, onChange, onDelete }: {
  node: Node;
  text: string; sub: string; border: string;
  onChange: (id: string, data: Record<string, unknown>) => void;
  onDelete: (id: string) => void;
}) {
  const [facilityForm, setFacilityForm] = useState<{ facilityName: string; facilityCountry: string; operator: string; sector: string } | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<{ productName: string; cnCode: string } | null>(null);
  const [productLoading, setProductLoading] = useState(false);
  const [productError, setProductError] = useState<string | null>(null);

  const inputStyle = {
    width: "100%", padding: "5px 8px", borderRadius: 5,
    border: `1px solid ${border}`, background: "transparent",
    color: text, fontSize: 12, boxSizing: "border-box" as const,
  };

  const sourceId   = node.data?.sourceId   as string | undefined;
  const sourceType = node.data?.sourceType as string | undefined;
  const sourceMeta = sourceType ? SOURCE_TYPE_LABELS[sourceType] : undefined;

  const isFacilityNode = node.type === "facilityNode";
  const isProductNode  = node.type === "productNode";

  async function saveFacility(e: React.FormEvent) {
    e.preventDefault();
    if (!facilityForm) return;
    setFacilityLoading(true);
    setFacilityError(null);
    try {
      if (sourceId && sourceType === "installation") {
        await api.installations.update(sourceId, {
          facilityName: facilityForm.facilityName,
          facilityCountry: facilityForm.facilityCountry,
          operator: facilityForm.operator,
        });
        onChange(node.id, { label: facilityForm.facilityName });
        dispatchResourceUpdate("installation", sourceId, { name: facilityForm.facilityName });
      } else {
        const created = await api.installations.create({
          facilityName:    facilityForm.facilityName,
          facilityCountry: facilityForm.facilityCountry,
          operator:        facilityForm.operator || facilityForm.facilityName,
          sector:          facilityForm.sector || "other",
          facilityRef:     undefined,
        });
        onChange(node.id, {
          label:      facilityForm.facilityName,
          sourceId:   created.id,
          sourceType: "installation",
        });
      }
      setFacilityForm(null);
    } catch (err) {
      setFacilityError(err instanceof Error ? err.message : "Kayıt silinemedi");
    } finally {
      setFacilityLoading(false);
    }
  }

  async function saveProduct(e: React.FormEvent) {
    e.preventDefault();
    if (!productForm) return;
    setProductLoading(true);
    setProductError(null);
    try {
      if (sourceId && sourceType === "cbamProduct") {
        const facilityId = node.data?.facilityId as string | undefined;
        if (!facilityId) throw new Error("Tesis ID gerekli");
        await api.cbamProducts.update(facilityId, sourceId, { productName: productForm.productName, cnCode: productForm.cnCode || null });
        onChange(node.id, { label: productForm.productName });
        dispatchResourceUpdate("cbamProduct", sourceId, { name: productForm.productName });
      } else {
        // facilityId — parent facilityNode'dan almaya çalış (node.data'da varsa)
        const facilityId = node.data?.facilityId as string | undefined ?? node.data?.parentFacilityId as string | undefined;
        if (!facilityId) throw new Error("CBAM ürünü oluşturmak için bir CBAM tesisine bağlantı kurun (facilityId gerekli)");
        const created = await api.cbamProducts.create(facilityId, {
          productName: productForm.productName,
          cnCode: productForm.cnCode || null,
          unit: "t",
          isCbamScope: true,
          energyAllocationMode: "facility",
        });
        onChange(node.id, { label: productForm.productName, sourceId: created.product.id, sourceType: "cbamProduct", facilityId });
      }
      setProductForm(null);
    } catch (err) {
      setProductError(err instanceof Error ? err.message : "Kayıt hatası");
    } finally {
      setProductLoading(false);
    }
  }

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ fontSize: 10, color: sub, marginBottom: 12, fontFamily: "monospace" }}>
        {NODE_TYPE_DISPLAY[node.type ?? ""] ?? node.type}
      </div>

      {/* Platform bağlantısı */}
      {sourceId && sourceMeta ? (
        <div style={{
          marginBottom: 12, padding: "8px 10px", borderRadius: 6,
          background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)",
        }}>
          <div style={{ fontSize: 10, color: "#10b981", fontWeight: 700, marginBottom: 4 }}>
            🔗 Platform Kaynağı
          </div>
          <div style={{ fontSize: 11, color: sub, marginBottom: 6 }}>
            {sourceMeta.label}
          </div>
          <a
            href={sourceMeta.path(sourceId)}
            style={{
              display: "inline-block", fontSize: 11, fontWeight: 600,
              color: "#10b981", textDecoration: "none",
              padding: "3px 8px", borderRadius: 4, border: "1px solid rgba(16,185,129,0.4)",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(16,185,129,0.12)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
          >
            → Platforma Git
          </a>
          {isFacilityNode && (
            <button
              onClick={() => setFacilityForm(facilityForm ? null : {
                facilityName:    String(node.data?.label ?? ""),
                facilityCountry: String(node.data?.country ?? ""),
                operator:        String(node.data?.operator ?? ""),
                sector:          String(node.data?.sector ?? "other"),
              })}
              style={{
                display: "block", width: "100%", marginTop: 6,
                padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`,
                background: "transparent", color: sub, fontSize: 10, cursor: "pointer",
              }}
            >
              {facilityForm ? "İptal" : "✏ Düzenle"}
            </button>
          )}
          <button
            onClick={() => onChange(node.id, { sourceId: undefined, sourceType: undefined })}
            style={{
              display: "block", width: "100%", marginTop: 4,
              padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`,
              background: "transparent", color: sub, fontSize: 10, cursor: "pointer",
            }}
          >
            Bağlantıyı Kaldır
          </button>
        </div>
      ) : (
        <div style={{
          marginBottom: 12, padding: "8px 10px", borderRadius: 6,
          border: `1px dashed ${border}`, fontSize: 11, color: sub,
        }}>
          Platform kaynağına bağlı değil.
          {isFacilityNode && (
            <button
              onClick={() => setFacilityForm(facilityForm ? null : {
                facilityName:    String(node.data?.label ?? ""),
                facilityCountry: "", operator: "", sector: "other",
              })}
              style={{
                display: "block", width: "100%", marginTop: 6,
                padding: "4px 8px", borderRadius: 4, border: "1px solid #10b981",
                background: "rgba(16,185,129,0.08)", color: "#10b981",
                fontSize: 11, cursor: "pointer", fontWeight: 600,
              }}
            >
              {facilityForm ? "İptal" : "+ Bu node'dan tesis oluştur"}
            </button>
          )}
          {!isFacilityNode && (
            <><br /><span style={{ fontSize: 10 }}>Sol panelden "Kaynaklar" sekmesinden sürükleyerek bağlayabilirsiniz.</span></>
          )}
        </div>
      )}

      {/* facilityNode inline form */}
      {facilityForm && isFacilityNode && (
        <form onSubmit={saveFacility} style={{ marginBottom: 12 }}>
          <div style={{
            padding: "10px", borderRadius: 6, border: `1px solid ${border}`,
            background: "rgba(16,185,129,0.04)", marginBottom: 8,
          }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>
              {sourceId ? "Tesisi Düzenle" : "Yeni Tesis Oluştur"}
            </div>
            {[
              { label: "Tesis Adı *", key: "facilityName", placeholder: "Örn: İstanbul Fabrika" },
              { label: "Ülke *", key: "facilityCountry", placeholder: "Örn: TR" },
              { label: "Operatör", key: "operator", placeholder: "Şirket adı" },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 6 }}>
                <label style={{ fontSize: 10, color: sub, display: "block", marginBottom: 2 }}>{f.label}</label>
                <input
                  value={(facilityForm as Record<string, string>)[f.key] ?? ""}
                  onChange={e => setFacilityForm(prev => prev ? { ...prev, [f.key]: e.target.value } : prev)}
                  placeholder={f.placeholder}
                  style={{ ...inputStyle, fontSize: 11, padding: "4px 7px" }}
                />
              </div>
            ))}
            {facilityError && (
              <div style={{ fontSize: 10, color: "#ef4444", marginBottom: 6 }}>{facilityError}</div>
            )}
            <button
              type="submit"
              disabled={facilityLoading || !facilityForm.facilityName || !facilityForm.facilityCountry}
              style={{
                width: "100%", padding: "5px", borderRadius: 5, border: "none",
                background: facilityLoading ? "#6b7280" : "#10b981", color: "#fff",
                fontSize: 11, cursor: facilityLoading ? "default" : "pointer", fontWeight: 600,
              }}
            >
              {facilityLoading ? "Kaydediliyor..." : (sourceId ? "Güncelle" : "Oluştur")}
            </button>
          </div>
        </form>
      )}

      {/* productNode inline form */}
      {isProductNode && !sourceId && (
        <div style={{ marginBottom: 12 }}>
          {!productForm ? (
            <button
              onClick={() => setProductForm({ productName: String(node.data?.label ?? ""), cnCode: "" })}
              style={{
                display: "block", width: "100%",
                padding: "4px 8px", borderRadius: 4, border: "1px solid #10b981",
                background: "rgba(16,185,129,0.08)", color: "#10b981",
                fontSize: 11, cursor: "pointer", fontWeight: 600,
              }}
            >
              + Bu node'dan CBAM ürünü oluştur
            </button>
          ) : (
            <form onSubmit={saveProduct}>
              <div style={{ padding: "10px", borderRadius: 6, border: `1px solid ${border}`, background: "rgba(16,185,129,0.04)" }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>Yeni CBAM Ürünü</div>
                {[
                  { label: "Ürün Adı *", key: "productName", placeholder: "Örn: Çelik Slab" },
                  { label: "CN Kodu", key: "cnCode", placeholder: "Örn: 7207" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 10, color: sub, display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input
                      value={(productForm as Record<string, string>)[f.key] ?? ""}
                      onChange={e => setProductForm(prev => prev ? { ...prev, [f.key]: e.target.value } : prev)}
                      placeholder={f.placeholder}
                      style={{ ...inputStyle, fontSize: 11, padding: "4px 7px" }}
                    />
                  </div>
                ))}
                {productError && <div style={{ fontSize: 10, color: "#ef4444", marginBottom: 6 }}>{productError}</div>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit" disabled={productLoading || !productForm.productName} style={{ flex: 1, padding: "5px", borderRadius: 5, border: "none", background: productLoading ? "#6b7280" : "#10b981", color: "#fff", fontSize: 11, cursor: productLoading ? "default" : "pointer", fontWeight: 600 }}>
                    {productLoading ? "Kaydediliyor..." : "Oluştur"}
                  </button>
                  <button type="button" onClick={() => setProductForm(null)} style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: sub, fontSize: 11, cursor: "pointer" }}>İptal</button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

      {isProductNode && sourceId && sourceType === "cbamProduct" && (
        <div style={{ marginBottom: 12 }}>
          {!productForm ? (
            <button
              onClick={() => setProductForm({ productName: String(node.data?.label ?? ""), cnCode: String(node.data?.cnCode ?? "") })}
              style={{ display: "block", width: "100%", marginTop: 4, padding: "3px 8px", borderRadius: 4, border: `1px solid ${border}`, background: "transparent", color: sub, fontSize: 10, cursor: "pointer" }}
            >
              ✏ Ürünü Düzenle
            </button>
          ) : (
            <form onSubmit={saveProduct}>
              <div style={{ padding: "10px", borderRadius: 6, border: `1px solid ${border}`, background: "rgba(16,185,129,0.04)", marginTop: 4 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: "#10b981", marginBottom: 8 }}>Ürünü Düzenle</div>
                {[
                  { label: "Ürün Adı *", key: "productName" },
                  { label: "CN Kodu", key: "cnCode" },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom: 6 }}>
                    <label style={{ fontSize: 10, color: sub, display: "block", marginBottom: 2 }}>{f.label}</label>
                    <input value={(productForm as Record<string, string>)[f.key] ?? ""} onChange={e => setProductForm(prev => prev ? { ...prev, [f.key]: e.target.value } : prev)} style={{ ...inputStyle, fontSize: 11, padding: "4px 7px" }} />
                  </div>
                ))}
                {productError && <div style={{ fontSize: 10, color: "#ef4444", marginBottom: 6 }}>{productError}</div>}
                <div style={{ display: "flex", gap: 6 }}>
                  <button type="submit" disabled={productLoading} style={{ flex: 1, padding: "5px", borderRadius: 5, border: "none", background: productLoading ? "#6b7280" : "#10b981", color: "#fff", fontSize: 11, cursor: productLoading ? "default" : "pointer", fontWeight: 600 }}>{productLoading ? "..." : "Güncelle"}</button>
                  <button type="button" onClick={() => setProductForm(null)} style={{ padding: "5px 10px", borderRadius: 5, border: `1px solid ${border}`, background: "transparent", color: sub, fontSize: 11, cursor: "pointer" }}>İptal</button>
                </div>
              </div>
            </form>
          )}
        </div>
      )}

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

      {/* emissionCalcNode — Hesaplama Tetikleme */}
      {node.type === "emissionCalcNode" && sourceId && sourceType === "installation" && (
        <EmissionCalcAction nodeId={node.id} installationId={sourceId} sub={sub} border={border} onChange={onChange} />
      )}

      {/* cfMatchingNode — CFE Matching Tetikleme */}
      {node.type === "cfMatchingNode" && sourceId && sourceType === "installation" && (
        <CfeMatchingAction nodeId={node.id} installationId={sourceId} sub={sub} border={border} onChange={onChange} />
      )}

      {/* meterNode — Veri Giriş Linki */}
      {node.type === "meterNode" && (
        <div style={{ marginBottom: 10 }}>
          <a
            href={sourceId ? `/import?installationId=${sourceId}` : "/import"}
            style={{
              display: "block", width: "100%", padding: "6px", borderRadius: 5,
              border: "1px solid #3b82f6", color: "#3b82f6",
              fontSize: 11, cursor: "pointer", textAlign: "center" as const,
              textDecoration: "none", fontWeight: 600,
              boxSizing: "border-box" as const,
            }}
          >
            📊 Veri Gir (Import)
          </a>
          {!!node.data?.lastDataAt && (
            <div style={{ fontSize: 10, color: sub, marginTop: 4, textAlign: "center" as const }}>
              Son veri: {new Date(node.data.lastDataAt as string).toLocaleDateString("tr-TR")}
            </div>
          )}
        </div>
      )}

      <button
        onMouseDown={e => e.preventDefault()}
        onClick={e => { e.preventDefault(); e.stopPropagation(); onDelete(node.id); }}
        style={{
          width: "100%", padding: "8px", borderRadius: 5, border: "1px solid #fecaca",
          background: "rgba(239,68,68,0.08)", color: "#ef4444",
          fontSize: 12, fontWeight: 600, cursor: "pointer",
        }}
      >
        🗑 Node'u Sil
      </button>
    </div>
  );
}

function EmissionCalcAction({ nodeId, installationId, sub, border, onChange }: {
  nodeId: string; installationId: string; sub: string; border: string;
  onChange: (id: string, data: Record<string, unknown>) => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);

  async function run() {
    setRunning(true); setErr(null); setResult(null);
    try {
      // Tüm dönemleri hesapla (son dönem için)
      const detail = await api.installations.get(installationId);
      const lastPeriod = detail.periods?.[0];
      if (!lastPeriod) throw new Error("Hesaplanacak dönem bulunamadı");
      const res = await api.periods.calculate(installationId, lastPeriod.id);
      const val = res.stored?.scope2VoltfoxTco2 ?? res.stored?.reductionTco2;
      setResult(val != null ? `${Number(val).toFixed(2)} tCO₂e` : "Hesaplandı");
      onChange(nodeId, { lastCalculatedAt: new Date().toISOString(), lastEmissionValue: val });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Hesaplama hatası");
    }
    setRunning(false);
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={run} disabled={running}
        style={{
          width: "100%", padding: "6px", borderRadius: 5,
          border: "none", background: running ? "#6b7280" : "#10b981",
          color: "#fff", fontSize: 11, cursor: running ? "default" : "pointer", fontWeight: 600,
        }}
      >
        {running ? "⏳ Hesaplanıyor..." : "▶ Hesaplamayı Çalıştır"}
      </button>
      {result && <div style={{ fontSize: 10, color: "#10b981", marginTop: 4, textAlign: "center" as const }}>{result}</div>}
      {err && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>{err}</div>}
    </div>
  );
}

function CfeMatchingAction({ nodeId, installationId, sub, border, onChange }: {
  nodeId: string; installationId: string; sub: string; border: string;
  onChange: (id: string, data: Record<string, unknown>) => void;
}) {
  const [running, setRunning] = useState(false);
  const [result, setResult]   = useState<string | null>(null);
  const [err, setErr]         = useState<string | null>(null);

  async function run() {
    setRunning(true); setErr(null); setResult(null);
    try {
      const detail = await api.installations.get(installationId);
      const lastPeriod = detail.periods?.[0];
      if (!lastPeriod) throw new Error("Hesaplanacak dönem bulunamadı");
      const existing = await api.cfe.get(installationId, lastPeriod.id).catch(() => null);
      const score = existing?.cfeScore;
      setResult(score != null ? `CFE Skoru: ${Number(score).toFixed(1)}%` : "CFE verisi yüklendi");
      onChange(nodeId, { cfeScore: score, lastRunAt: new Date().toISOString() });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "CFE hesaplama hatası");
    }
    setRunning(false);
  }

  return (
    <div style={{ marginBottom: 10 }}>
      <button
        onClick={run} disabled={running}
        style={{
          width: "100%", padding: "6px", borderRadius: 5,
          border: "none", background: running ? "#6b7280" : "#10b981",
          color: "#fff", fontSize: 11, cursor: running ? "default" : "pointer", fontWeight: 600,
        }}
      >
        {running ? "⏳ Eşleştiriliyor..." : "▶ CFE Matching Çalıştır"}
      </button>
      {result && <div style={{ fontSize: 10, color: "#10b981", marginTop: 4, textAlign: "center" as const }}>{result}</div>}
      {err && <div style={{ fontSize: 10, color: "#ef4444", marginTop: 4 }}>{err}</div>}
    </div>
  );
}

const EDGE_TYPE_DISPLAY: Record<string, string> = {
  energyFlowEdge:  "Enerji Akışı",
  dataFlowEdge:    "Veri Akışı",
  carbonFlowEdge:  "Karbon Akışı",
  certFlowEdge:    "Sertifika Akışı",
  orgEdge:         "Organizasyon Bağlantısı",
};

function EdgePropertiesPanel({ edge, nodes, text, sub, border, onDelete }: {
  edge: Edge;
  nodes: Node[];
  text: string; sub: string; border: string;
  onDelete: (id: string) => void;
}) {
  const sourceNode = nodes.find(n => n.id === edge.source);
  const targetNode = nodes.find(n => n.id === edge.target);

  return (
    <div style={{ padding: "0 16px" }}>
      <div style={{ fontSize: 10, color: sub, marginBottom: 12, fontFamily: "monospace" }}>
        {EDGE_TYPE_DISPLAY[edge.type ?? ""] ?? edge.type ?? "Bağlantı"}
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Kaynak</div>
        <div style={{
          padding: "5px 8px", borderRadius: 5, border: `1px solid ${border}`,
          fontSize: 12, color: text, background: "rgba(0,0,0,0.03)",
        }}>
          {String(sourceNode?.data?.label ?? edge.source).slice(0, 30)}
        </div>
      </div>

      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Hedef</div>
        <div style={{
          padding: "5px 8px", borderRadius: 5, border: `1px solid ${border}`,
          fontSize: 12, color: text, background: "rgba(0,0,0,0.03)",
        }}>
          {String(targetNode?.data?.label ?? edge.target).slice(0, 30)}
        </div>
      </div>

      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, color: sub, marginBottom: 4 }}>Bağlantı Tipi</div>
        <div style={{ fontSize: 11, color: sub, fontFamily: "monospace" }}>
          {EDGE_TYPE_DISPLAY[edge.type ?? ""] ?? edge.type ?? "—"}
        </div>
      </div>

      <button
        onClick={() => onDelete(edge.id)}
        style={{
          width: "100%", padding: "6px", borderRadius: 5, border: "none",
          background: "rgba(239,68,68,0.1)", color: "#ef4444",
          fontSize: 11, cursor: "pointer",
        }}
      >
        🗑 Bağlantıyı Sil
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
