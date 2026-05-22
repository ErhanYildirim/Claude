import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

type Theme = "light" | "dark";

interface ThemeContextValue {
  theme: Theme;
  toggle: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: "light", toggle: () => {} });

const LIGHT: Record<string, string> = {
  "--bg":          "#f4fbf8",
  "--bg-card":     "#ffffff",
  "--bg-sidebar":  "#0a1f1a",
  "--text":        "#0a1f1a",
  "--text-muted":  "#5c7a72",
  "--border":      "#d4ece4",
  "--accent":      "#00b87a",
  "--accent-dark": "#009966",
};

const DARK: Record<string, string> = {
  "--bg":          "#0d1f1b",
  "--bg-card":     "#162820",
  "--bg-sidebar":  "#070f0d",
  "--text":        "#e2efe9",
  "--text-muted":  "#7dab97",
  "--border":      "#1e3d33",
  "--accent":      "#00b87a",
  "--accent-dark": "#00c98a",
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
