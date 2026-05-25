import { useMemo } from "react";
import type { Node, Edge } from "@xyflow/react";

export type Severity = "critical" | "warning" | "suggestion";

export interface ValidationIssue {
  id:       string;
  nodeId?:  string;
  severity: Severity;
  code:     string;
  message:  string;
}

export interface ValidationResult {
  score:    number; // 0–100
  issues:   ValidationIssue[];
  critical: ValidationIssue[];
  warnings: ValidationIssue[];
  suggestions: ValidationIssue[];
}

export function useValidationEngine(nodes: Node[], edges: Edge[]): ValidationResult {
  return useMemo(() => {
    const issues: ValidationIssue[] = [];
    const connectedTargets = new Set(edges.map(e => e.target));
    const connectedSources = new Set(edges.map(e => e.source));

    for (const node of nodes) {
      const type = node.type ?? "";
      const id   = node.id;

      // ── CRITICAL ────────────────────────────────────────────────────────
      if (type === "emissionCalcNode" || type === "cbamCalcNode") {
        // Hesaplama nodunun en az bir kaynak bağlantısı olmalı
        if (!connectedTargets.has(id)) {
          issues.push({
            id: `no-input-${id}`, nodeId: id, severity: "critical",
            code: "CALC_NO_INPUT",
            message: `${node.data?.label ?? type}: Bağlı veri kaynağı yok`,
          });
        }
      }

      if (type === "facilityNode") {
        // Tesis bir Scope grubunda olmalı (parent varsa tamam)
        const inScopeGroup = nodes.some(
          n => n.type === "scopeGroupNode" &&
               (n.id === (node as Node & { parentId?: string }).parentId),
        );
        if (!inScopeGroup && !connectedSources.has(id) && !connectedTargets.has(id)) {
          issues.push({
            id: `facility-no-scope-${id}`, nodeId: id, severity: "critical",
            code: "FACILITY_NO_SCOPE",
            message: `${node.data?.label ?? "Tesis"}: Scope grubuna atanmamış`,
          });
        }
      }

      if (type === "cbamCalcNode") {
        // CBAM hesabının bir ürün node'una bağlı olması gerekir
        const hasProduct = edges.some(e =>
          e.target === id &&
          nodes.find(n => n.id === e.source)?.type === "productNode",
        );
        if (!hasProduct) {
          issues.push({
            id: `cbam-no-product-${id}`, nodeId: id, severity: "critical",
            code: "CBAM_NO_PRODUCT",
            message: `${node.data?.label ?? "CBAM Hesap"}: Bağlı ürün node'u yok`,
          });
        }
      }

      // ── WARNING ──────────────────────────────────────────────────────────
      if (type === "meterNode") {
        const hasSource = edges.some(e => e.target === id);
        if (!hasSource) {
          issues.push({
            id: `meter-no-source-${id}`, nodeId: id, severity: "warning",
            code: "METER_NO_DATA_SOURCE",
            message: `${node.data?.label ?? "Sayaç"}: Veri kaynağına bağlı değil`,
          });
        }
      }

      if (type === "facilityNode") {
        // Sayaç bağlantısı yok mu?
        const hasMeter = edges.some(e =>
          e.source === id &&
          nodes.find(n => n.id === e.target)?.type === "meterNode",
        );
        if (!hasMeter) {
          issues.push({
            id: `facility-no-meter-${id}`, nodeId: id, severity: "warning",
            code: "FACILITY_NO_METER",
            message: `${node.data?.label ?? "Tesis"}: Sayaç bağlantısı yok`,
          });
        }
      }

      // ── SUGGESTION ───────────────────────────────────────────────────────
      if (type === "gridNode") {
        const zone = node.data?.zone as string | undefined;
        if (!zone) {
          issues.push({
            id: `grid-no-zone-${id}`, nodeId: id, severity: "suggestion",
            code: "GRID_NO_ZONE",
            message: `${node.data?.label ?? "Şebeke"}: ENTSO-E zone seçilmemiş`,
          });
        }
      }

      if ((type === "facilityNode" || type === "processNode") && !node.data?.facilityCountry && !node.data?.country) {
        issues.push({
          id: `no-country-${id}`, nodeId: id, severity: "suggestion",
          code: "NODE_NO_COUNTRY",
          message: `${node.data?.label ?? type}: Ülke bilgisi eksik`,
        });
      }
    }

    // Scope 3 var mı?
    const hasScope3 = nodes.some(
      n => n.type === "scopeGroupNode" && (n.data?.scope as number) === 3,
    );
    if (nodes.length > 3 && !hasScope3) {
      issues.push({
        id: "no-scope3", severity: "warning",
        code: "NO_SCOPE3_GROUP",
        message: "Scope 3 grubu tanımlanmamış — değer zinciri emisyonları izlenemiyor",
      });
    }

    // Skor hesabı
    const criticalCount    = issues.filter(i => i.severity === "critical").length;
    const warningCount     = issues.filter(i => i.severity === "warning").length;
    const suggestionCount  = issues.filter(i => i.severity === "suggestion").length;

    let score = 100;
    score -= criticalCount   * 20;
    score -= warningCount    * 8;
    score -= suggestionCount * 3;
    if (nodes.length === 0) score = 0;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      issues,
      critical:    issues.filter(i => i.severity === "critical"),
      warnings:    issues.filter(i => i.severity === "warning"),
      suggestions: issues.filter(i => i.severity === "suggestion"),
    };
  }, [nodes, edges]);
}
