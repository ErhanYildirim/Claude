import { useState, useEffect, useCallback } from "react";
import { api } from "../lib/api.js";

// Hangi node tipinin hangi API endpoint'ine bağlandığı
// Her 30 sn polling (WS upgrade #147'de)

interface LiveData {
  liveValue?: string;
  badge?:     string;
  badgeColor?: string;
  subLabel?:  string;
  lastFetched?: Date;
}

// Zone bilgisi node datasından alınır (sourceId veya zone alanı)
async function fetchForNodeType(nodeType: string, data: Record<string, unknown>): Promise<LiveData | null> {
  try {
    if (nodeType === "gridNode") {
      const zone = (data.zone as string) ?? "DE";
      const ef = await api.efLive.getLive(zone);
      if (!ef) return null;
      const ci = ef.currentCi;
      return {
        liveValue: ci != null ? `${ci.toFixed(0)} gCO₂/kWh` : undefined,
        badge:     ef.trend1h != null ? (ef.trend1h > 0 ? `↑ ${ef.trend1h.toFixed(0)}` : `↓ ${Math.abs(ef.trend1h).toFixed(0)}`) : undefined,
        badgeColor: ef.trend1h != null ? (ef.trend1h > 0 ? "#ef4444" : "#10b981") : undefined,
        subLabel:  `${zone} şebekesi`,
        lastFetched: new Date(),
      };
    }

    if (nodeType === "solarNode" || nodeType === "windNode") {
      const zone = (data.zone as string) ?? "DE";
      const psrType = nodeType === "solarNode" ? "B16" : "B19";
      const summary = await api.generation.getSummary(zone);
      if (!summary) return null;
      return {
        liveValue: `${summary.summary.avgRePct?.toFixed(1) ?? "–"}% RE`,
        subLabel:  `${zone} • ${psrType === "B16" ? "Güneş" : "Rüzgar"}`,
        lastFetched: new Date(),
      };
    }

    return null;
  } catch {
    return null;
  }
}

// Hook: belirli bir node için canlı veri polling
export function useEsgNodeData(
  nodeId: string,
  nodeType: string,
  nodeData: Record<string, unknown>,
  enabled = true,
): LiveData {
  const [liveData, setLiveData] = useState<LiveData>({});

  const fetch = useCallback(async () => {
    const result = await fetchForNodeType(nodeType, nodeData);
    if (result) setLiveData(result);
  }, [nodeType, nodeData]);

  useEffect(() => {
    if (!enabled) return;
    // Sadece veri olan node tipleri için polling yap
    const LIVE_NODE_TYPES = new Set(["gridNode", "solarNode", "windNode"]);
    if (!LIVE_NODE_TYPES.has(nodeType)) return;

    fetch();
    const timer = setInterval(fetch, 30_000);
    return () => clearInterval(timer);
  }, [nodeId, nodeType, fetch, enabled]);

  return liveData;
}

// Hook: tüm canvas node'larının canlı verisini birleştiren harita
export function useCanvasLiveData(
  nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>,
  enabled = true,
): Map<string, LiveData> {
  const [dataMap, setDataMap] = useState<Map<string, LiveData>>(new Map());

  const LIVE_TYPES = new Set(["gridNode", "solarNode", "windNode"]);

  useEffect(() => {
    if (!enabled) return;

    async function fetchAll() {
      const liveNodes = nodes.filter(n => LIVE_TYPES.has(n.type ?? ""));
      if (liveNodes.length === 0) return;

      const results = await Promise.allSettled(
        liveNodes.map(n => fetchForNodeType(n.type!, n.data).then(d => ({ id: n.id, data: d }))),
      );

      setDataMap(prev => {
        const next = new Map(prev);
        for (const r of results) {
          if (r.status === "fulfilled" && r.value.data) {
            next.set(r.value.id, r.value.data);
          }
        }
        return next;
      });
    }

    fetchAll();
    const timer = setInterval(fetchAll, 30_000);
    return () => clearInterval(timer);
  }, [nodes, enabled]);  // eslint-disable-line react-hooks/exhaustive-deps

  return dataMap;
}
