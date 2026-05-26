import { useState, useRef, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Sun, Moon, Bell, HelpCircle, Search } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";
import { useTheme } from "../contexts/ThemeContext.js";
import NotificationBell from "./NotificationBell.js";
import GlobalSearch from "./GlobalSearch.js";

interface BreadcrumbEntry { label: string; path?: string; }

const ROUTE_MAP: Record<string, { parent?: string; label: string }> = {
  "/dashboard":        { label: "Dashboard" },
  "/gec":              { parent: "Ürünler", label: "GEC Scope 1" },
  "/cbam":             { parent: "Ürünler", label: "CBAM Emissions" },
  "/reports/cbam":     { parent: "CBAM Emissions", label: "Teknik Dosya" },
  "/reports/cdp":      { parent: "Raporlamalar", label: "CDP Raporu" },
  "/reports/iso14064": { parent: "Raporlamalar", label: "ISO 14064" },
  "/reports/ghg":      { parent: "Raporlamalar", label: "GHG Protocol" },
  "/csrd":             { parent: "Raporlamalar", label: "CSRD E1" },
  "/carbon-prices":    { parent: "Araçlar", label: "Karbon Fiyatları" },
  "/comparison":       { parent: "Araçlar", label: "Tesis Karşılaştırma" },
  "/emission-targets": { parent: "Araçlar", label: "Emisyon Hedefleri" },
  "/import":           { parent: "Araçlar", label: "CSV Import" },
  "/benchmark":        { parent: "Araçlar", label: "Sektör Benchmark" },
  "/integrations":     { parent: "Araçlar", label: "Entegrasyonlar" },
  "/api-playground":   { parent: "Araçlar", label: "API Playground" },
  "/settings":         { label: "Ayarlar" },
  "/profile":          { label: "Profil" },
  "/esg-playground":   { parent: "Ürünler", label: "ESG Playground" },
  "/ef-data":          { parent: "Ürünler", label: "EF Veri Servisi" },
  "/live-forecast":    { parent: "Ürünler", label: "Canlı & Tahmin" },
};

function getBreadcrumb(pathname: string): BreadcrumbEntry[] {
  if (pathname.startsWith("/cfe")) return [{ label: "Ürünler" }, { label: "24/7 CFE Matching" }];
  if (pathname.startsWith("/cbam/facilities/") && pathname.includes("/products/")) {
    return [{ label: "Ürünler" }, { label: "CBAM Emissions", path: "/cbam" }, { label: "Ürün Detayı" }];
  }
  if (pathname.startsWith("/cbam/facilities/")) {
    return [{ label: "Ürünler" }, { label: "CBAM Emissions", path: "/cbam" }, { label: "Tesis Detayı" }];
  }
  if (pathname.startsWith("/installations/") && pathname.includes("/periods/")) {
    return [{ label: "Dönem Detayı" }];
  }
  if (pathname.startsWith("/installations/")) {
    return [{ label: "Tesis Detayı" }];
  }
  if (pathname.startsWith("/admin")) return [{ label: "Admin Panel" }];

  if (pathname.match(/^\/esg-playground\/.+\/report$/)) {
    return [{ label: "Ürünler" }, { label: "ESG Playground", path: "/esg-playground" }, { label: "Canvas Raporu" }];
  }
  const entry = ROUTE_MAP[pathname];
  if (!entry) return [{ label: "Voltfox" }];
  if (entry.parent) return [{ label: entry.parent }, { label: entry.label }];
  return [{ label: entry.label }];
}

interface TopBarProps {
  onMenuToggle: () => void;
  mobile: boolean;
}

export default function TopBar({ onMenuToggle, mobile }: TopBarProps) {
  const location = useLocation();
  const { theme, toggle } = useTheme();
  const breadcrumb = getBreadcrumb(location.pathname);
  const [searchOpen, setSearchOpen] = useState(false);

  const iconBtnStyle: React.CSSProperties = {
    width: "32px",
    height: "32px",
    borderRadius: "var(--radius-md)",
    background: "transparent",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--text-secondary)",
    cursor: "pointer",
    transition: "background 0.12s, color 0.12s",
    flexShrink: 0,
  };

  return (
    <header style={{
      height: "52px",
      minHeight: "52px",
      background: "var(--bg-surface)",
      borderBottom: "1px solid var(--border)",
      display: "flex",
      alignItems: "center",
      padding: "0 var(--space-6)",
      gap: "var(--space-3)",
      fontFamily: "var(--font-sans)",
    }}>
      {/* Breadcrumb */}
      <div style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        fontSize: "var(--text-sm)",
        color: "var(--text-muted)",
        flex: 1,
        minWidth: 0,
      }}>
        {breadcrumb.map((entry, i) => (
          <span key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {i > 0 && <span style={{ opacity: 0.4 }}>/</span>}
            <span style={{
              color: i === breadcrumb.length - 1 ? "var(--text-primary)" : "var(--text-muted)",
              fontWeight: i === breadcrumb.length - 1 ? 600 : 400,
              whiteSpace: "nowrap",
            }}>
              {entry.label}
            </span>
          </span>
        ))}
      </div>

      {/* Search trigger */}
      <button
        onClick={() => setSearchOpen(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          background: "var(--bg-base)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-md)",
          padding: "6px 12px",
          color: "var(--text-muted)",
          fontSize: "var(--text-sm)",
          cursor: "pointer",
          width: "200px",
          fontFamily: "var(--font-sans)",
          transition: "border-color 0.12s",
        }}
      >
        <Search size={13} />
        <span style={{ flex: 1, textAlign: "left" }}>Ara...</span>
        <kbd style={{
          background: "var(--border)",
          border: "1px solid var(--border)",
          borderRadius: "4px",
          fontSize: "9px",
          color: "var(--text-muted)",
          padding: "1px 5px",
          fontFamily: "var(--font-mono)",
        }}>
          ⌘K
        </kbd>
      </button>

      {/* Actions */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <NotificationBell />

        <button style={iconBtnStyle} title="Yardım">
          <HelpCircle size={15} />
        </button>

        <button onClick={toggle} style={iconBtnStyle} title="Tema değiştir">
          {theme === "dark" ? <Sun size={15} /> : <Moon size={15} />}
        </button>
      </div>

      {/* Global search modal */}
      {searchOpen && <GlobalSearch onClose={() => setSearchOpen(false)} />}
    </header>
  );
}
