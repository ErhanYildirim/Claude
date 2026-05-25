import { useState, useCallback, useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";

export interface SimulatorScenario {
  id:        string;
  name:      string;
  nodes:     Node[];
  edges:     Edge[];
  createdAt: Date;
}

export interface SimulatorDelta {
  nodeId:   string;
  label:    string;
  field:    string;
  baseline: number;
  scenario: number;
  delta:    number;
  deltaPct: number;
}

// Baseline CO2 tahmini: emissionCalcNode'larındaki liveValue değerlerini topla
function estimateCo2(nodes: Node[]): number {
  let total = 0;
  for (const n of nodes) {
    if (n.type === "emissionCalcNode" || n.type === "cbamCalcNode") {
      const lv = n.data?.liveValue as string | undefined;
      if (lv) {
        const match = lv.match(/[\d.]+/);
        if (match) total += parseFloat(match[0]);
      }
      // Eğer liveValue yoksa simüle et: node sayısına göre tahmin
      else {
        total += 120; // placeholder tCO₂e
      }
    }
  }
  return total || nodes.filter(n => n.type === "facilityNode").length * 250;
}

export function useSimulator(baselineNodes: Node[], baselineEdges: Edge[]) {
  const [scenarios, setScenarios] = useState<SimulatorScenario[]>([]);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(null);
  const [simulatorNodes, setSimulatorNodes] = useState<Node[] | null>(null);
  const [simulatorEdges, setSimulatorEdges] = useState<Edge[] | null>(null);
  const [isSimulating, setIsSimulating] = useState(false);

  const baselineCo2 = useMemo(() => estimateCo2(baselineNodes), [baselineNodes]);

  // Simülasyonu başlat — baseline fork
  const startSimulation = useCallback(() => {
    setSimulatorNodes(JSON.parse(JSON.stringify(baselineNodes)));
    setSimulatorEdges(JSON.parse(JSON.stringify(baselineEdges)));
    setIsSimulating(true);
  }, [baselineNodes, baselineEdges]);

  // Simülasyonu iptal et
  const cancelSimulation = useCallback(() => {
    setSimulatorNodes(null);
    setSimulatorEdges(null);
    setIsSimulating(false);
    setActiveScenarioId(null);
  }, []);

  // Senaryo kaydet
  const saveScenario = useCallback((name: string) => {
    if (!simulatorNodes || !simulatorEdges) return;
    const scenario: SimulatorScenario = {
      id:        crypto.randomUUID(),
      name,
      nodes:     simulatorNodes,
      edges:     simulatorEdges,
      createdAt: new Date(),
    };
    setScenarios(prev => [...prev, scenario]);
    setActiveScenarioId(scenario.id);
    return scenario;
  }, [simulatorNodes, simulatorEdges]);

  // Senaryo karşılaştırma delta'sı
  const getDelta = useCallback((scenarioId: string): SimulatorDelta[] => {
    const scenario = scenarios.find(s => s.id === scenarioId);
    if (!scenario) return [];

    const deltas: SimulatorDelta[] = [];
    const scenarioCo2 = estimateCo2(scenario.nodes);
    const delta = scenarioCo2 - baselineCo2;

    // Toplam delta
    if (delta !== 0) {
      deltas.push({
        nodeId:   "total",
        label:    "Toplam Emisyon",
        field:    "tCO₂e",
        baseline: baselineCo2,
        scenario: scenarioCo2,
        delta,
        deltaPct: baselineCo2 > 0 ? (delta / baselineCo2) * 100 : 0,
      });
    }

    // Node seviyesinde delta
    for (const sNode of scenario.nodes) {
      const bNode = baselineNodes.find(n => n.id === sNode.id);
      if (!bNode) {
        deltas.push({
          nodeId:   sNode.id,
          label:    String(sNode.data?.label ?? sNode.type ?? sNode.id),
          field:    "eklendi",
          baseline: 0,
          scenario: 1,
          delta:    1,
          deltaPct: 100,
        });
      }
    }
    for (const bNode of baselineNodes) {
      if (!scenario.nodes.find(n => n.id === bNode.id)) {
        deltas.push({
          nodeId:   bNode.id,
          label:    String(bNode.data?.label ?? bNode.type ?? bNode.id),
          field:    "kaldırıldı",
          baseline: 1,
          scenario: 0,
          delta:    -1,
          deltaPct: -100,
        });
      }
    }

    return deltas;
  }, [scenarios, baselineNodes, baselineCo2]);

  const scenarioCo2 = useMemo(() => {
    if (!simulatorNodes) return null;
    return estimateCo2(simulatorNodes);
  }, [simulatorNodes]);

  const liveDelta = scenarioCo2 != null ? scenarioCo2 - baselineCo2 : null;

  return {
    isSimulating,
    scenarios,
    activeScenarioId,
    simulatorNodes: simulatorNodes ?? baselineNodes,
    simulatorEdges: simulatorEdges ?? baselineEdges,
    baselineCo2,
    scenarioCo2,
    liveDelta,
    startSimulation,
    cancelSimulation,
    saveScenario,
    getDelta,
    setSimulatorNodes,
    setSimulatorEdges,
    setActiveScenarioId,
  };
}
