interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  items: TabItem[];
  activeKey: string;
  onChange: (key: string) => void;
  style?: React.CSSProperties;
}

export function Tabs({ items, activeKey, onChange, style }: TabsProps) {
  return (
    <div
      style={{
        display: "flex",
        gap: "2px",
        background: "var(--bg-surface)",
        border: "1px solid var(--border)",
        borderRadius: "var(--radius-lg)",
        padding: "4px",
        width: "fit-content",
        fontFamily: "var(--font-sans)",
        ...style,
      }}
    >
      {items.map(item => {
        const isActive = item.key === activeKey;
        return (
          <button
            key={item.key}
            data-tab
            data-active={isActive}
            onClick={() => onChange(item.key)}
            style={{
              padding: "7px var(--space-4)",
              borderRadius: "var(--radius-md)",
              fontSize: "var(--text-sm)",
              fontWeight: 500,
              border: isActive ? "1px solid var(--border-accent)" : "1px solid transparent",
              background: isActive ? "var(--accent-bg)" : "transparent",
              color: isActive ? "var(--accent)" : "var(--text-muted)",
              cursor: "pointer",
              transition: "all 0.12s",
              fontFamily: "var(--font-sans)",
            }}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
