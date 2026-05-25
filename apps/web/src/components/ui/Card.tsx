import type { HTMLAttributes, ReactNode } from "react";

type Variant = "base" | "accent" | "flat";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  base: {
    background: "var(--bg-surface)",
    border: "1px solid var(--border)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-4)",
  },
  accent: {
    background: "linear-gradient(135deg, var(--accent-bg), transparent)",
    border: "1px solid var(--border-accent)",
    borderRadius: "var(--radius-lg)",
    padding: "var(--space-4)",
  },
  flat: {
    background: "var(--bg-elevated)",
    borderRadius: "var(--radius-md)",
    padding: "var(--space-3)",
  },
};

export function Card({ variant = "base", style, children, ...props }: CardProps) {
  return (
    <div
      data-variant={variant}
      style={{ ...VARIANT_STYLES[variant], ...style }}
      {...props}
    >
      {children}
    </div>
  );
}
