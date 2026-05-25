import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";

export interface ValidationIssue {
  id: string;
  severity: "error" | "warning" | "info";
  message: string;
  nodeId?: string;
  action?: string; // kısa aksiyon etiketi
}

export interface ValidationResult {
  score: number;        // 0–100
  issues: ValidationIssue[];
  passed: number;
  total: number;
}

export function useCanvasValidation(nodes: Node[], edges: Edge[]): ValidationResult {
  return useMemo(() => {
    const issues: ValidationIssue[] = [];
    let passed = 0;
    let total = 0;

    const nodesWithSource = nodes.filter(n => !n.hidden);
    const visibleEdges    = edges.filter(e => !e.hidden);

    // ── Kural 1: Kaynak bağlantısı (facilityNode + productNode) ─────────────
    const resourceNodes = nodesWithSource.filter(n =>
      n.type === "facilityNode" || n.type === "productNode"
    );
    for (const n of resourceNodes) {
      total++;
      if (n.data?.sourceId) {
        passed++;
      } else {
        issues.push({
          id:      `no-source-${n.id}`,
          severity: "warning",
          message: `"${n.data?.label ?? n.id}" platform kaynağına bağlı değil`,
          nodeId:  n.id,
          action:  "Kaynak Bağla",
        });
      }
    }

    // ── Kural 2: Kopuk node'lar (edge'i olmayan) ─────────────────────────────
    const connectedIds = new Set<string>();
    for (const e of visibleEdges) {
      connectedIds.add(e.source);
      connectedIds.add(e.target);
    }
    const isolatedNodes = nodesWithSource.filter(n =>
      !connectedIds.has(n.id) && n.type !== "scopeGroupNode"
    );
    total++;
    if (isolatedNodes.length === 0) {
      passed++;
    } else {
      for (const n of isolatedNodes) {
        issues.push({
          id:      `isolated-${n.id}`,
          severity: "warning",
          message: `"${n.data?.label ?? n.id}" akışa bağlı değil — silin veya bağlayın`,
          nodeId:  n.id,
          action:  "Bağla / Sil",
        });
      }
    }

    // ── Kural 3: CBAM zinciri eksiksiz mi? ───────────────────────────────────
    const hasCbamReport = nodesWithSource.some(n => n.type === "cbamReportNode");
    if (hasCbamReport) {
      total++;
      const hasEmCalc  = nodesWithSource.some(n => n.type === "emissionCalcNode");
      const hasCbamCalc = nodesWithSource.some(n => n.type === "cbamCalcNode");
      if (hasEmCalc && hasCbamCalc) {
        passed++;
      } else {
        if (!hasEmCalc) issues.push({
          id: "cbam-no-emcalc", severity: "error",
          message: "CBAM raporu için emissionCalcNode gerekli — akışa ekleyin",
          action: "Node Ekle",
        });
        if (!hasCbamCalc) issues.push({
          id: "cbam-no-cbamcalc", severity: "error",
          message: "CBAM raporu için cbamCalcNode gerekli — akışa ekleyin",
          action: "Node Ekle",
        });
      }
    }

    // ── Kural 4: CFE Matching için üretim kaynağı var mı? ────────────────────
    const hasCfeMatch = nodesWithSource.some(n => n.type === "cfMatchingNode");
    if (hasCfeMatch) {
      total++;
      const hasProduction = nodesWithSource.some(n =>
        n.type === "solarNode" || n.type === "windNode" ||
        n.type === "hydroNode" || n.type === "ppaContractNode"
      );
      if (hasProduction) {
        passed++;
      } else {
        issues.push({
          id: "cfe-no-production", severity: "warning",
          message: "CFE eşleştirme için üretim kaynağı ekleyin (solar, rüzgar veya PPA)",
          action: "Node Ekle",
        });
      }
    }

    // ── Kural 5: GHG raporunda tüm scope'lar kapsanıyor mu? ──────────────────
    const hasGhgReport = nodesWithSource.some(n => n.type === "ghgReportNode");
    if (hasGhgReport) {
      total++;
      const scopeGroups = nodesWithSource.filter(n => n.type === "scopeGroupNode");
      const scopes = new Set(scopeGroups.map(n => n.data?.scope));
      if (scopes.has(1) && scopes.has(2)) {
        passed++;
      } else {
        if (!scopes.has(1)) issues.push({
          id: "ghg-no-scope1", severity: "info",
          message: "GHG raporunda Scope 1 grubu yok — doğrudan emisyonlar eksik olabilir",
          action: "Scope 1 Ekle",
        });
        if (!scopes.has(2)) issues.push({
          id: "ghg-no-scope2", severity: "info",
          message: "GHG raporunda Scope 2 grubu yok — dolaylı enerji emisyonları eksik",
          action: "Scope 2 Ekle",
        });
      }
    }

    // Hiç kural yoksa (boş canvas) — geçer
    if (total === 0) { passed = 1; total = 1; }

    const score = Math.round((passed / total) * 100);
    return { score, issues, passed, total };
  }, [nodes, edges]);
}
