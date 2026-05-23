import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext.js";
import TopBar from "./TopBar.js";

interface NavItem  { icon: string; label: string; path: string; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Ana Menü",
    items: [
      { icon: "📊", label: "Dashboard",        path: "/dashboard" },
    ],
  },
  {
    title: "Ürünler",
    items: [
      { icon: "🔬", label: "Granüler Hesaplama", path: "/gec" },
      { icon: "⚡", label: "24/7 CFE Matching",  path: "/cfe" },
      { icon: "🏛️", label: "CBAM Emissions",     path: "/cbam" },
      { icon: "📡", label: "EF Veri Servisi",    path: "/ef-data" },
    ],
  },
  {
    title: "Raporlama",
    items: [
      { icon: "📄", label: "CBAM Teknik Dosya", path: "/reports/cbam" },
      { icon: "📄", label: "CDP Raporu",         path: "/reports/cdp" },
      { icon: "📄", label: "ISO 14064",          path: "/reports/iso14064" },
      { icon: "📄", label: "GHG Protocol",       path: "/reports/ghg" },
      { icon: "🌍", label: "CSRD E1",            path: "/csrd" },
    ],
  },
  {
    title: "Araçlar",
    items: [
      { icon: "💶", label: "Karbon Fiyatları",  path: "/carbon-prices" },
      { icon: "⚖️", label: "Tesis Kıyasla",     path: "/comparison" },
      { icon: "🎯", label: "Emisyon Hedefleri", path: "/emission-targets" },
      { icon: "📥", label: "CSV Import",         path: "/import" },
      { icon: "📊", label: "Sektör Benchmark",  path: "/benchmark" },
      { icon: "🧪", label: "API Playground",    path: "/api-playground" },
    ],
  },
];

function isActive(path: string, pathname: string): boolean {
  if (path === "/cbam") return pathname === "/cbam" || pathname.startsWith("/installations");
  if (path === "/gec")  return pathname === "/gec";
  return pathname === path || pathname.startsWith(path + "/");
}

const SIDEBAR_W = 240;
const TOPBAR_H  = 56;
const MOBILE_BP = 768;

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { theme } = useTheme();
  const [mobile,   setMobile]   = useState(window.innerWidth < MOBILE_BP);
  const [sideOpen, setSideOpen] = useState(false);
  const isDark = theme === "dark";

  useEffect(() => {
    function onResize() { setMobile(window.innerWidth < MOBILE_BP); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  useEffect(() => { setSideOpen(false); }, [location.pathname]);

  const sidebarBg = isDark ? "#080f0e" : "#0a1f1a";

  const sidebarStyle: React.CSSProperties = {
    position: "fixed",
    top: mobile ? TOPBAR_H : 0,
    left: 0,
    width: SIDEBAR_W,
    height: mobile ? `calc(100vh - ${TOPBAR_H}px)` : "100vh",
    background: sidebarBg,
    display: "flex",
    flexDirection: "column",
    overflowY: "auto",
    zIndex: 180,
    transform: mobile && !sideOpen ? `translateX(-${SIDEBAR_W}px)` : "translateX(0)",
    transition: "transform .22s cubic-bezier(.4,0,.2,1)",
    boxShadow: isDark ? "none" : "2px 0 12px rgba(0,0,0,.12)",
  };

  const itemBase: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "8px 12px",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
    textDecoration: "none",
    color: "rgba(255,255,255,.55)",
    transition: "background .15s, color .15s",
    marginBottom: 1,
  };

  const itemActive: React.CSSProperties = {
    background: "rgba(0,184,122,.18)",
    color: "#00e096",
    fontWeight: 600,
  };

  return (
    <>
      {/* Mobile backdrop — below TopBar (z:200), above sidebar (z:180) */}
      {mobile && sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{
            position: "fixed",
            top: TOPBAR_H,
            left: 0,
            right: 0,
            bottom: 0,
            background: "rgba(0,0,0,.5)",
            zIndex: 170,
            backdropFilter: "blur(2px)",
          }}
        />
      )}

      {/* Top bar */}
      <TopBar
        onMenuToggle={() => setSideOpen(v => !v)}
        mobile={mobile}
      />

      {/* Sidebar */}
      <aside style={sidebarStyle}>
        {/* Logo */}
        <div style={{
          padding: "18px 16px 14px",
          borderBottom: "1px solid rgba(255,255,255,.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: "linear-gradient(135deg,#00b87a,#009966)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 14,
              fontWeight: 900,
              color: "#fff",
              flexShrink: 0,
            }}>V</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15, color: "#fff", letterSpacing: "-.01em" }}>Voltfox</div>
              <div style={{ fontSize: 10, color: "rgba(255,255,255,.3)", fontWeight: 500, marginTop: 1 }}>Emisyon Yönetim Platformu</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "8px 10px", overflowY: "auto" }}>
          {NAV_GROUPS.map(group => (
            <div key={group.title}>
              <div style={{
                fontSize: 10,
                color: "rgba(255,255,255,.25)",
                textTransform: "uppercase",
                letterSpacing: ".09em",
                padding: "14px 12px 4px",
                fontWeight: 700,
              }}>
                {group.title}
              </div>
              {group.items.map(item => {
                const active = isActive(item.path, location.pathname);
                return (
                  <Link
                    key={item.label + item.path}
                    to={item.path}
                    style={{ ...itemBase, ...(active ? itemActive : {}) }}
                    onMouseEnter={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "rgba(0,184,122,.1)";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.9)";
                      }
                    }}
                    onMouseLeave={e => {
                      if (!active) {
                        (e.currentTarget as HTMLElement).style.background = "transparent";
                        (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.55)";
                      }
                    }}
                  >
                    <span style={{ width: 18, flexShrink: 0, textAlign: "center", fontSize: 14 }}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Sidebar bottom — Ayarlar */}
        <div style={{ padding: "10px 10px 16px", borderTop: "1px solid rgba(255,255,255,.06)" }}>
          <Link
            to="/settings"
            style={{
              ...itemBase,
              ...(isActive("/settings", location.pathname) ? itemActive : {}),
            }}
            onMouseEnter={e => {
              if (!isActive("/settings", location.pathname)) {
                (e.currentTarget as HTMLElement).style.background = "rgba(0,184,122,.1)";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.9)";
              }
            }}
            onMouseLeave={e => {
              if (!isActive("/settings", location.pathname)) {
                (e.currentTarget as HTMLElement).style.background = "transparent";
                (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.55)";
              }
            }}
          >
            <span style={{ width: 18, flexShrink: 0, textAlign: "center", fontSize: 14 }}>⚙️</span>
            Ayarlar
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        marginLeft: mobile ? 0 : SIDEBAR_W,
        marginTop: TOPBAR_H,
        minHeight: `calc(100vh - ${TOPBAR_H}px)`,
        background: "var(--bg, #f4fbf8)",
        color: "var(--text, #0a1f1a)",
        transition: "background .2s, color .2s",
      }}>
        {children}
      </main>
    </>
  );
}
