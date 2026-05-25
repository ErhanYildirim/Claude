import { useState } from "react";
import type { ValidationResult, ValidationIssue } from "../../hooks/useCanvasValidation.js";

interface Props {
  result: ValidationResult;
  isDark: boolean;
  onSelectNode?: (nodeId: string) => void;
}

const SEVERITY_COLORS: Record<ValidationIssue["severity"], string> = {
  error:   "#ef4444",
  warning: "#f59e0b",
  info:    "#3b82f6",
};

const SEVERITY_ICONS: Record<ValidationIssue["severity"], string> = {
  error:   "✕",
  warning: "⚠",
  info:    "ℹ",
};

function scoreColor(score: number) {
  if (score >= 80) return "#10b981";
  if (score >= 50) return "#f59e0b";
  return "#ef4444";
}

export function CanvasValidator({ result, isDark, onSelectNode }: Props) {
  const [open, setOpen] = useState(false);

  const card   = isDark ? "#1a1d27" : "#ffffff";
  const text   = isDark ? "#f1f5f9" : "#1e293b";
  const sub    = isDark ? "#94a3b8" : "#64748b";
  const border = isDark ? "#2d3748" : "#e2e8f0";
  const color  = scoreColor(result.score);

  const errorCount   = result.issues.filter(i => i.severity === "error").length;
  const warningCount = result.issues.filter(i => i.severity === "warning").length;

  return (
    <>
      {/* Badge — sağ alt */}
      <button
        onClick={() => setOpen(o => !o)}
        title={`Canvas skoru: ${result.score}% — ${result.issues.length} uyarı`}
        style={{
          position: "absolute", bottom: 48, right: 12, zIndex: 500,
          display: "flex", alignItems: "center", gap: 6,
          background: card, border: `1px solid ${border}`, borderRadius: 20,
          padding: "5px 12px", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
          color: text, fontSize: 12, fontWeight: 600,
        }}
      >
        {/* Score circle */}
        <svg width="20" height="20" viewBox="0 0 20 20" style={{ flexShrink: 0 }}>
          <circle cx="10" cy="10" r="8" fill="none" stroke={border} strokeWidth="2.5" />
          <circle
            cx="10" cy="10" r="8" fill="none" stroke={color} strokeWidth="2.5"
            strokeDasharray={`${(result.score / 100) * 50.3} 50.3`}
            strokeLinecap="round"
            transform="rotate(-90 10 10)"
          />
        </svg>
        <span style={{ color }}>{result.score}%</span>
        {result.issues.length > 0 && (
          <span style={{
            background: errorCount > 0 ? "#fef2f2" : "#fffbeb",
            color:      errorCount > 0 ? "#ef4444" : "#f59e0b",
            borderRadius: 10, padding: "1px 6px", fontSize: 10,
          }}>
            {errorCount > 0 ? `${errorCount} hata` : `${warningCount} uyarı`}
          </span>
        )}
      </button>

      {/* Drawer */}
      {open && (
        <div style={{
          position: "absolute", bottom: 80, right: 12, zIndex: 600,
          width: 320, background: card, border: `1px solid ${border}`,
          borderRadius: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            padding: "12px 14px", borderBottom: `1px solid ${border}`,
            display: "flex", alignItems: "center", justifyContent: "space-between",
          }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: text }}>
              Canvas Skoru
              <span style={{ marginLeft: 8, color, fontWeight: 700 }}>{result.score}%</span>
              <span style={{ marginLeft: 6, fontSize: 11, color: sub, fontWeight: 400 }}>
                ({result.passed}/{result.total} kural geçti)
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              style={{ background: "none", border: "none", cursor: "pointer", color: sub, fontSize: 18, lineHeight: 1 }}
            >×</button>
          </div>

          {/* Issue list */}
          <div style={{ maxHeight: 320, overflowY: "auto", padding: "8px 0" }}>
            {result.issues.length === 0 ? (
              <div style={{ padding: "20px 16px", textAlign: "center", color: "#10b981", fontSize: 13 }}>
                ✓ Tüm kurallar geçti — akış sağlıklı
              </div>
            ) : (
              result.issues.map(issue => (
                <div
                  key={issue.id}
                  style={{
                    padding: "8px 14px", borderBottom: `1px solid ${border}`,
                    display: "flex", gap: 8, alignItems: "flex-start",
                  }}
                >
                  <span style={{
                    flexShrink: 0, fontSize: 12, fontWeight: 700, marginTop: 1,
                    color: SEVERITY_COLORS[issue.severity],
                  }}>
                    {SEVERITY_ICONS[issue.severity]}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, color: text, lineHeight: 1.4 }}>{issue.message}</div>
                    {issue.nodeId && onSelectNode && (
                      <button
                        onClick={() => { onSelectNode(issue.nodeId!); setOpen(false); }}
                        style={{
                          marginTop: 4, background: "none", border: "none",
                          color: "#10b981", fontSize: 11, cursor: "pointer",
                          padding: 0, fontWeight: 600,
                        }}
                      >
                        → Node'a Git
                      </button>
                    )}
                  </div>
                  <span style={{
                    flexShrink: 0, fontSize: 10, color: sub,
                    background: isDark ? "#2d3748" : "#f1f5f9",
                    borderRadius: 4, padding: "2px 5px",
                    alignSelf: "flex-start",
                  }}>
                    {issue.severity}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </>
  );
}
