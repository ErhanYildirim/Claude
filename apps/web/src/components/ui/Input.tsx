import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, id, style, ...props }: InputProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-1)" }}>
      {label && (
        <label
          htmlFor={id}
          style={{
            fontSize: "var(--text-xs)",
            fontWeight: 600,
            color: "var(--text-secondary)",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
            fontFamily: "var(--font-sans)",
          }}
        >
          {label}
        </label>
      )}
      <input
        id={id}
        style={{
          background: "var(--bg-surface)",
          border: `1.5px solid ${error ? "var(--danger)" : "var(--border)"}`,
          borderRadius: "var(--radius-md)",
          padding: "9px var(--space-3)",
          color: "var(--text-primary)",
          fontSize: "var(--text-sm)",
          fontFamily: "var(--font-sans)",
          outline: "none",
          transition: "border-color 0.15s, box-shadow 0.15s",
          width: "100%",
          ...style,
        }}
        {...props}
      />
      {error && (
        <span
          style={{
            fontSize: "var(--text-xs)",
            color: "var(--danger)",
            fontFamily: "var(--font-sans)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}
