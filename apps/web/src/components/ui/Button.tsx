import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
}

const BASE: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "6px",
  border: "none",
  borderRadius: "var(--radius-md)",
  fontFamily: "var(--font-sans)",
  fontWeight: 500,
  cursor: "pointer",
  transition: "opacity 0.15s, background 0.15s",
  whiteSpace: "nowrap",
};

const SIZE_STYLES: Record<Size, React.CSSProperties> = {
  sm: { padding: "5px 10px", fontSize: "var(--text-xs)" },
  md: { padding: "8px 16px", fontSize: "var(--text-sm)" },
  lg: { padding: "11px 22px", fontSize: "var(--text-md)", fontWeight: 600 },
};

const VARIANT_STYLES: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--accent)",
    color: "var(--bg-base)",
  },
  secondary: {
    background: "var(--bg-elevated)",
    color: "var(--text-primary)",
    border: "1px solid var(--border)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text-secondary)",
    border: "1px solid var(--border)",
  },
  danger: {
    background: "rgba(239,68,68,0.10)",
    color: "var(--danger)",
    border: "1px solid rgba(239,68,68,0.25)",
  },
};

export function Button({
  variant = "primary",
  size = "md",
  disabled,
  style,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      data-variant={variant}
      disabled={disabled}
      style={{
        ...BASE,
        ...SIZE_STYLES[size],
        ...VARIANT_STYLES[variant],
        ...(disabled ? { opacity: 0.4, cursor: "not-allowed" } : {}),
        ...style,
      }}
      {...props}
    >
      {children}
    </button>
  );
}
