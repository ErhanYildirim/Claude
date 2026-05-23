import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "light", toggle: () => {} });

const LIGHT: Record<string, string> = {
  "--bg":           "#f0f7f4",
  "--bg-card":      "#ffffff",
  "--bg-topbar":    "#ffffff",
  "--bg-sidebar":   "#0a1f1a",
  "--text":         "#0d1f1b",
  "--text-muted":   "#5c7a72",
  "--text-subtle":  "#94a3b8",
  "--border":       "#dce8e3",
  "--border-light": "#eef7f3",
  "--accent":       "#00b87a",
  "--accent-dark":  "#009966",
  "--accent-bg":    "#e6f9f2",
  "--shadow-sm":    "0 1px 3px rgba(10,31,26,.07)",
  "--shadow-md":    "0 4px 16px rgba(10,31,26,.09)",
  "--shadow-lg":    "0 12px 40px rgba(10,31,26,.12)",
  "--radius-card":  "12px",
  "--radius-sm":    "8px",
};

const DARK: Record<string, string> = {
  "--bg":           "#0c1a17",
  "--bg-card":      "#132018",
  "--bg-topbar":    "#132018",
  "--bg-sidebar":   "#080f0d",
  "--text":         "#e2efe9",
  "--text-muted":   "#7dab97",
  "--text-subtle":  "#4d7a6a",
  "--border":       "#1e3a2f",
  "--border-light": "#172e24",
  "--accent":       "#00b87a",
  "--accent-dark":  "#00d68a",
  "--accent-bg":    "rgba(0,184,122,.12)",
  "--shadow-sm":    "0 1px 3px rgba(0,0,0,.2)",
  "--shadow-md":    "0 4px 16px rgba(0,0,0,.3)",
  "--shadow-lg":    "0 12px 40px rgba(0,0,0,.5)",
  "--radius-card":  "12px",
  "--radius-sm":    "8px",
};

function applyTheme(theme: Theme) {
  const vars = theme === "dark" ? DARK : LIGHT;
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v);
  }
  root.setAttribute("data-theme", theme);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    const saved = localStorage.getItem("vf-theme") as Theme | null;
    return saved ?? (window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  });

  useEffect(() => {
    applyTheme(theme);
    localStorage.setItem("vf-theme", theme);
  }, [theme]);

  function toggle() {
    setTheme(t => t === "light" ? "dark" : "light");
  }

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
