import { useState, useEffect, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";
import { useTheme } from "../contexts/ThemeContext.js";

interface NavItem { icon: string; label: string; path: string; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
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
    ],
  },
  {
    title: "Genel",
    items: [
      { icon: "📊", label: "Dashboard", path: "/dashboard" },
      { icon: "⚙️", label: "Ayarlar",  path: "/settings" },
    ],
  },
];

function isActive(path: string, pathname: string): boolean {
  if (path === "/cbam") return pathname === "/cbam" || pathname.startsWith("/installations");
  if (path === "/gec")  return pathname === "/gec";
  return pathname === path || pathname.startsWith(path + "/");
}

const SIDEBAR_W = 240;
const MOBILE_BP = 768;

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user }  = useAuth();
  const { theme, toggle } = useTheme();
  const [mobile,   setMobile]   = useState(window.innerWidth < MOBILE_BP);
  const [sideOpen, setSideOpen] = useState(false);

  useEffect(() => {
    function onResize() { setMobile(window.innerWidth < MOBILE_BP); }
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Close sidebar on route change (mobile)
  useEffect(() => { setSideOpen(false); }, [location.pathname]);

  const sidebarStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, width: SIDEBAR_W, height: "100vh",
    background: "#0a1f1a", display: "flex", flexDirection: "column",
    overflowY: "auto", zIndex: 200,
    transform: mobile && !sideOpen ? `translateX(-${SIDEBAR_W}px)` : "translateX(0)",
    transition: "transform .22s cubic-bezier(.4,0,.2,1)",
  };
  const logoArea: React.CSSProperties = {
    padding: "20px 16px 14px", borderBottom: "1px solid rgba(255,255,255,.07)",
  };
  const navArea: React.CSSProperties = { flex: 1, padding: "8px 8px" };
  const groupTitle: React.CSSProperties = {
    fontSize: 10, color: "rgba(255,255,255,.3)", textTransform: "uppercase",
    letterSpacing: ".09em", padding: "16px 14px 4px", fontWeight: 700,
  };
  const itemBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
    borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: "pointer",
    textDecoration: "none", color: "rgba(255,255,255,.6)",
    transition: "background .15s, color .15s", marginBottom: 2,
  };
  const itemActive: React.CSSProperties = {
    background: "#00b87a", color: "#fff", fontWeight: 700,
  };
  const bottomArea: React.CSSProperties = {
    padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,.07)",
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {mobile && sideOpen && (
        <div
          onClick={() => setSideOpen(false)}
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.5)", zIndex: 190 }}
        />
      )}

      {/* Mobile top bar */}
      {mobile && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, height: 52,
          background: "#0a1f1a", display: "flex", alignItems: "center",
          padding: "0 16px", zIndex: 180, gap: 12,
        }}>
          <button
            onClick={() => setSideOpen(v => !v)}
            style={{ background: "none", border: "none", cursor: "pointer", padding: 6,
                     color: "#fff", fontSize: 20, lineHeight: 1 }}
          >
            ☰
          </button>
          <div style={{ fontWeight: 800, fontSize: 16, color: "#fff" }}>Voltfox</div>
        </div>
      )}

      <aside style={sidebarStyle}>
        <div style={logoArea}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 9, flexShrink: 0,
              background: "linear-gradient(135deg,#00b87a,#009966)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 15, fontWeight: 900, color: "#fff",
            }}>V</div>
            <div style={{ fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: "-.01em" }}>Voltfox</div>
          </div>
          <div style={{ fontSize: 11, color: "rgba(255,255,255,.35)", fontWeight: 500, paddingLeft: 2 }}>Emisyon Yönetim Platformu</div>
        </div>

        <nav style={navArea}>
          {NAV_GROUPS.map(group => (
            <div key={group.title}>
              <div style={groupTitle}>{group.title}</div>
              {group.items.map(item => {
                const active = isActive(item.path, location.pathname);
                return (
                  <Link
                    key={item.label + item.path}
                    to={item.path}
                    style={{ ...itemBase, ...(active ? itemActive : {}) }}
                    onMouseEnter={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "rgba(0,184,122,.12)"; (e.currentTarget as HTMLElement).style.color = "#fff"; } }}
                    onMouseLeave={e => { if (!active) { (e.currentTarget as HTMLElement).style.background = "transparent"; (e.currentTarget as HTMLElement).style.color = "rgba(255,255,255,.6)"; } }}
                  >
                    <span style={{ width: 18, flexShrink: 0, textAlign: "center" }}>{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div style={bottomArea}>
          {user?.email && (
            <Link
              to="/profile"
              style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8,
                       textDecoration: "none", padding: "6px 8px", borderRadius: 7,
                       transition: "background .12s" }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
            >
              <div style={{
                width: 28, height: 28, borderRadius: "50%", flexShrink: 0,
                background: "#00b87a", display: "flex", alignItems: "center",
                justifyContent: "center", fontSize: 11, fontWeight: 800, color: "#fff",
              }}>
                {((user.user_metadata?.display_name as string | undefined) ?? user.email)
                  .slice(0, 2).toUpperCase()}
              </div>
              <div style={{ overflow: "hidden" }}>
                <div style={{ fontSize: 12, color: "#fff", fontWeight: 600,
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {(user.user_metadata?.display_name as string | undefined) ?? "Profil"}
                </div>
                <div style={{ fontSize: 10, color: "#94A3B8",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {user.email}
                </div>
              </div>
            </Link>
          )}
          <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
            <button
              style={{ flex: 1, padding: "7px 0", background: "rgba(255,255,255,.08)", border: "none",
                       borderRadius: 6, color: "rgba(255,255,255,.65)", fontSize: 12, cursor: "pointer" }}
              onClick={toggle}
              title={theme === "dark" ? "Açık temaya geç" : "Koyu temaya geç"}
            >
              {theme === "dark" ? "☀ Açık" : "☾ Koyu"}
            </button>
            <button
              style={{ flex: 1, padding: "7px 0", background: "rgba(255,255,255,.08)", border: "none",
                       borderRadius: 6, color: "rgba(255,255,255,.65)", fontSize: 12, cursor: "pointer" }}
              onClick={() => supabase.auth.signOut()}
            >
              Çıkış
            </button>
          </div>
        </div>
      </aside>

      <main style={{
        marginLeft: mobile ? 0 : SIDEBAR_W,
        marginTop: mobile ? 52 : 0,
        minHeight: "100vh",
        background: "var(--bg, #f4fbf8)",
        color: "var(--text, #0a1f1a)",
        transition: "background .2s, color .2s",
      }}>
        {children}
      </main>
    </>
  );
}
