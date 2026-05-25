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
// gridNode/solarNode/windNode → batch API polling (30sn)
// emissionCalcNode/cfMatchingNode/meterNode → node.data'dan türetilir (komponentlerde render edilir)
export function useCanvasLiveData(
  nodes: Array<{ id: string; type?: string; data: Record<string, unknown> }>,
  enabled = true,
): Map<string, LiveData> {
  const [dataMap, setDataMap] = useState<Map<string, LiveData>>(new Map());

  useEffect(() => {
    if (!enabled) return;

    const ZONE_TYPES = new Set(["gridNode", "solarNode", "windNode"]);
    const zoneNodes = nodes.filter(n => ZONE_TYPES.has(n.type ?? ""));
    if (zoneNodes.length === 0) return;

    // Benzersiz zone'ları topla
    const zones = [...new Set(
      zoneNodes.map(n => (n.data.zone as string | undefined) ?? "DE")
    )];

    async function fetchAll() {
      try {
        // Tek batch çağrısıyla tüm zone CI verisi
        const batchRes = await api.esgPlayground.liveData(zones);
        const zoneData = batchRes.zones;

        // Her node için liveData oluştur
        const results: Array<{ id: string; data: LiveData }> = [];

        for (const n of zoneNodes) {
          const zone = (n.data.zone as string | undefined) ?? "DE";
          const zd   = zoneData[zone];
          if (!zd) continue;

          if (n.type === "gridNode") {
            results.push({
              id: n.id,
              data: {
                liveValue:  zd.ci != null  ? `${zd.ci.toFixed(0)} gCO₂/kWh` : undefined,
                subLabel:   `${zone} şebekesi`,
                lastFetched: new Date(),
              },
            });
          } else {
            // solarNode / windNode — RE% göster
            results.push({
              id: n.id,
              data: {
                liveValue:  zd.rePct != null ? `${zd.rePct.toFixed(1)}% RE` : undefined,
                subLabel:   `${zone} • ${n.type === "solarNode" ? "Güneş" : "Rüzgar"}`,
                lastFetched: new Date(),
              },
            });
          }
        }

        if (results.length === 0) return;
        setDataMap(prev => {
          const next = new Map(prev);
          for (const r of results) next.set(r.id, r.data);
          return next;
        });
      } catch {
        // API erişilemezse eski verileri koru
      }
    }

    fetchAll();
    const timer = setInterval(fetchAll, 30_000);
    return () => clearInterval(timer);
  }, [nodes, enabled]);  // eslint-disable-line react-hooks/exhaustive-deps

  return dataMap;
}
