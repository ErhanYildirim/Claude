interface Delta {
  value: number;
  direction: "up" | "down";
  label?: string;
}

interface Progress {
  value: number;
  max?: number;
}

interface StatCardProps {
  label: string;
  value: string | number;
  unit?: string;
  delta?: Delta;
  progress?: Progress;
  variant?: "base" | "accent";
  style?: React.CSSProperties;
}

export function StatCard({ label, value, unit, delta, progress, variant = "base", style }: StatCardProps) {
  const isAccent = variant === "accent";

  return (
    <div
      style={{
        background: isAccent
          ? "linear-gradient(135deg, var(--accent-bg), transparent)"
          : "var(--bg-surface)",
        border: `1px solid ${isAccent ? "var(--border-accent)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "var(--space-4) var(--space-4)",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      <div style={{
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        textTransform: "uppercase",
        letterSpacing: "1.5px",
        color: "var(--text-muted)",
        marginBottom: "var(--space-1)",
      }}>
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "5px", lineHeight: 1 }}>
        <span style={{
          fontSize: "var(--text-2xl)",
          fontWeight: 800,
          color: "var(--text-primary)",
          letterSpacing: "-0.5px",
        }}>
          {value}
        </span>
        {unit && (
          <span style={{ fontSize: "var(--text-sm)", color: "var(--text-secondary)", fontWeight: 400 }}>
            {unit}
          </span>
        )}
      </div>

      {delta && (
        <div style={{
          marginTop: "var(--space-1)",
          fontSize: "var(--text-xs)",
          fontWeight: 600,
          color: delta.direction === "up" ? "var(--success)" : "var(--danger)",
        }}>
          {delta.direction === "up" ? "↑" : "↓"} {Math.abs(delta.value)}%
          {delta.label && <span style={{ color: "var(--text-muted)", fontWeight: 400 }}> {delta.label}</span>}
        </div>
      )}

      {progress && (
        <div data-progress style={{ marginTop: "var(--space-2)" }}>
          <div style={{
            background: "var(--bg-subtle)",
            borderRadius: "var(--radius-pill)",
            height: "4px",
            overflow: "hidden",
          }}>
            <div style={{
              height: "100%",
              width: `${Math.min(progress.value, progress.max ?? 100)}%`,
              background: "linear-gradient(90deg, var(--accent), var(--accent-bright))",
              borderRadius: "var(--radius-pill)",
            }} />
          </div>
        </div>
      )}
    </div>
  );
}
