import type { ReactNode } from "react";

type Variant = "success" | "warning" | "danger" | "accent" | "neutral";

interface BadgeProps {
  variant?: Variant;
  children: ReactNode;
  style?: React.CSSProperties;
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  success: { background: "rgba(34,197,94,0.12)", color: "var(--success)", border: "1px solid rgba(34,197,94,0.25)" },
  warning: { background: "rgba(245,158,11,0.12)", color: "var(--warning)", border: "1px solid rgba(245,158,11,0.25)" },
  danger:  { background: "rgba(239,68,68,0.12)",  color: "var(--danger)",  border: "1px solid rgba(239,68,68,0.25)"  },
  accent:  { background: "var(--accent-bg)",       color: "var(--accent)",  border: "1px solid var(--border-accent)"  },
  neutral: { background: "var(--border)",          color: "var(--text-secondary)", border: "1px solid var(--border)" },
};

export function Badge({ variant = "neutral", children, style }: BadgeProps) {
  return (
    <span
      data-variant={variant}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
        padding: "3px 9px",
        borderRadius: "var(--radius-pill)",
        fontSize: "var(--text-xs)",
        fontWeight: 600,
        letterSpacing: "0.3px",
        fontFamily: "var(--font-sans)",
        ...VARIANT_STYLES[variant],
        ...style,
      }}
    >
      {children}
    </span>
  );
}
