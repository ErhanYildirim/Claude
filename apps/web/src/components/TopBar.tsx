import { useState, useRef, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";
import { useTheme } from "../contexts/ThemeContext.js";
import NotificationBell from "./NotificationBell.js";
import GlobalSearch from "./GlobalSearch.js";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard":        "Dashboard",
  "/gec":              "Granüler Hesaplama",
  "/cfe":              "24/7 CFE Matching",
  "/cbam":             "CBAM Emissions",
  "/ef-data":          "EF Veri Servisi",
  "/reports/cbam":     "CBAM Teknik Dosya",
  "/reports/cdp":      "CDP Raporu",
  "/reports/iso14064": "ISO 14064",
  "/reports/ghg":      "GHG Protocol",
  "/csrd":             "CSRD E1",
  "/carbon-prices":    "Karbon Fiyatları",
  "/comparison":       "Tesis Karşılaştırma",
  "/emission-targets": "Emisyon Hedefleri",
  "/import":           "CSV Import",
  "/benchmark":        "Sektör Benchmark",
  "/api-playground":   "API Playground",
  "/settings":         "Ayarlar",
  "/profile":          "Profil",
};

function getPageTitle(pathname: string): string {
  if (PAGE_TITLES[pathname]) return PAGE_TITLES[pathname];
  if (pathname.startsWith("/installations/") && pathname.includes("/periods/")) return "Dönem Detayı";
  if (pathname.startsWith("/cbam/facilities/") && pathname.includes("/products/")) return "CBAM Ürün Detayı";
  if (pathname.startsWith("/cbam/facilities/")) return "CBAM Tesis Detayı";
  if (pathname.startsWith("/installations/")) return "Tesis Detayı";
  if (pathname.startsWith("/admin")) return "Admin Panel";
  return "Voltfox";
}

interface TopBarProps {
  onMenuToggle: () => void;
  mobile: boolean;
}

export default function TopBar({ onMenuToggle, mobile }: TopBarProps) {
  const location  = useLocation();
  const navigate  = useNavigate();
  const { user }  = useAuth();
  const { theme, toggle } = useTheme();
  const [userOpen, setUserOpen] = useState(false);
  const dropRef = useRef<HTMLDivElement>(null);

  const pageTitle  = getPageTitle(location.pathname);
  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "";
  const initials   = displayName.slice(0, 2).toUpperCase();

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropRef.current && !dropRef.current.contains(e.target as Node)) {
        setUserOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Close dropdown on route change
  useEffect(() => { setUserOpen(false); }, [location.pathname]);

  const isDark = theme === "dark";

  const bar: React.CSSProperties = {
    position: "fixed",
    top: 0,
    left: mobile ? 0 : 240,
    right: 0,
    height: 56,
    background: isDark ? "var(--bg-card, #162820)" : "#ffffff",
    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#e5efea"}`,
    display: "flex",
    alignItems: "center",
    padding: "0 20px",
    gap: 12,
    zIndex: 200,
    boxShadow: isDark ? "none" : "0 1px 3px rgba(10,31,26,.06)",
  };

  const iconBtn: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "7px 8px",
    borderRadius: 8,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    color: isDark ? "rgba(255,255,255,.65)" : "#5c7a72",
    fontSize: 18,
    lineHeight: 1,
    transition: "background .15s, color .15s",
    flexShrink: 0,
  };

  return (
    <div style={bar}>
      {/* Left — hamburger (mobile) or page title */}
      {mobile ? (
        <button
          onClick={onMenuToggle}
          style={{ ...iconBtn, fontSize: 20 }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,.08)" : "#f0faf5"; (e.currentTarget as HTMLElement).style.color = isDark ? "#fff" : "#009966"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = isDark ? "rgba(255,255,255,.65)" : "#5c7a72"; }}
        >
          ☰
        </button>
      ) : (
        <div style={{ fontSize: 15, fontWeight: 700, color: isDark ? "#e2efe9" : "#0a1f1a", flexShrink: 0, letterSpacing: "-.01em" }}>
          {pageTitle}
        </div>
      )}

      {/* Center — Global search */}
      <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
        <GlobalSearch topBar isDark={isDark} />
      </div>

      {/* Right — actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {/* Dark mode toggle */}
        <button
          onClick={toggle}
          title={isDark ? "Açık tema" : "Koyu tema"}
          style={iconBtn}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,.08)" : "#f0faf5"; (e.currentTarget as HTMLElement).style.color = isDark ? "#fff" : "#009966"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "none"; (e.currentTarget as HTMLElement).style.color = isDark ? "rgba(255,255,255,.65)" : "#5c7a72"; }}
        >
          {isDark ? "☀" : "☾"}
        </button>

        {/* Notification bell */}
        <NotificationBell topBar isDark={isDark} />

        {/* User avatar + dropdown */}
        <div ref={dropRef} style={{ position: "relative", marginLeft: 4 }}>
          <button
            onClick={() => setUserOpen(v => !v)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: 0,
              borderRadius: "50%",
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <div style={{
              width: 34,
              height: 34,
              borderRadius: "50%",
              background: "linear-gradient(135deg,#00b87a,#009966)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 12,
              fontWeight: 800,
              color: "#fff",
              flexShrink: 0,
              boxShadow: "0 2px 6px rgba(0,184,122,.3)",
            }}>
              {initials}
            </div>
          </button>

          {userOpen && (
            <div style={{
              position: "absolute",
              top: "calc(100% + 10px)",
              right: 0,
              width: 224,
              background: isDark ? "#162820" : "#fff",
              borderRadius: 12,
              boxShadow: "0 12px 40px rgba(0,0,0,.18)",
              border: `1px solid ${isDark ? "rgba(255,255,255,.08)" : "#e5efea"}`,
              zIndex: 600,
              overflow: "hidden",
            }}>
              {/* User info */}
              <div style={{
                padding: "14px 16px 12px",
                borderBottom: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#eef7f3"}`,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: "linear-gradient(135deg,#00b87a,#009966)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 13,
                    fontWeight: 800,
                    color: "#fff",
                    flexShrink: 0,
                  }}>
                    {initials}
                  </div>
                  <div style={{ overflow: "hidden" }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: isDark ? "#e2efe9" : "#0a1f1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {(user?.user_metadata?.display_name as string | undefined) ?? "Kullanıcı"}
                    </div>
                    <div style={{ fontSize: 11, color: isDark ? "#7dab97" : "#5c7a72", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {user?.email}
                    </div>
                  </div>
                </div>
              </div>

              {/* Menu items */}
              {[
                { icon: "👤", label: "Profil",  to: "/profile" },
                { icon: "⚙️", label: "Ayarlar", to: "/settings" },
              ].map(item => (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "9px 16px",
                    fontSize: 13,
                    color: isDark ? "rgba(255,255,255,.75)" : "#374151",
                    textDecoration: "none",
                    transition: "background .1s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,.06)" : "#f4fbf8"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
                >
                  <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{item.icon}</span>
                  {item.label}
                </Link>
              ))}

              <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#eef7f3"}`, margin: "4px 0" }} />

              {/* Dark mode toggle in dropdown */}
              <button
                onClick={() => { toggle(); setUserOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px",
                  fontSize: 13,
                  color: isDark ? "rgba(255,255,255,.75)" : "#374151",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  transition: "background .1s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,.06)" : "#f4fbf8"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>{isDark ? "☀" : "☾"}</span>
                {isDark ? "Açık Tema" : "Koyu Tema"}
              </button>

              <div style={{ borderTop: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#eef7f3"}`, margin: "4px 0" }} />

              {/* Sign out */}
              <button
                onClick={() => supabase.auth.signOut()}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 16px 13px",
                  fontSize: 13,
                  color: "#ef4444",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  width: "100%",
                  textAlign: "left",
                  transition: "background .1s",
                  fontFamily: "inherit",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(239,68,68,.1)" : "#fef2f2"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: "center" }}>🚪</span>
                Çıkış Yap
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
