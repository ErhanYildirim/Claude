import { ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../hooks/useAuth.js";

interface NavItem { icon: string; label: string; path: string; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Veri Girişi",
    items: [
      { icon: "🏭", label: "Tesisler", path: "/cbam" },
      { icon: "🌿", label: "CBAM",     path: "/cbam" },
    ],
  },
  {
    title: "Analiz & İzleme",
    items: [
      { icon: "📊", label: "Dashboard", path: "/dashboard" },
      { icon: "⚡", label: "24/7 CFE",  path: "/cfe" },
      { icon: "🌍", label: "EF Veri",   path: "/ef-data" },
    ],
  },
  {
    title: "Raporlama",
    items: [
      { icon: "📋", label: "CBAM Raporu",  path: "/reports/cbam" },
      { icon: "📋", label: "CDP Raporu",   path: "/reports/cdp" },
      { icon: "📋", label: "ISO 14064",    path: "/reports/iso14064" },
      { icon: "📋", label: "GHG Protocol", path: "/reports/ghg" },
    ],
  },
  {
    title: "Sistem",
    items: [
      { icon: "⚙️", label: "Ayarlar", path: "/settings" },
    ],
  },
];

function isActive(path: string, pathname: string): boolean {
  if (path === "/cbam") return pathname === "/cbam" || pathname.startsWith("/installations");
  return pathname === path || pathname.startsWith(path + "/");
}

export default function AppShell({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();

  const sidebarStyle: React.CSSProperties = {
    position: "fixed", top: 0, left: 0, width: 240, height: "100vh",
    background: "#0F172A", display: "flex", flexDirection: "column",
    overflowY: "auto", zIndex: 50,
  };
  const logoArea: React.CSSProperties = {
    padding: "20px 16px 12px", borderBottom: "1px solid rgba(255,255,255,.08)",
  };
  const navArea: React.CSSProperties = { flex: 1, padding: "8px 8px" };
  const groupTitle: React.CSSProperties = {
    fontSize: 10, color: "rgba(255,255,255,.35)", textTransform: "uppercase",
    letterSpacing: ".08em", padding: "16px 14px 4px",
  };
  const itemBase: React.CSSProperties = {
    display: "flex", alignItems: "center", gap: 10, padding: "9px 14px",
    borderRadius: 7, fontSize: 14, cursor: "pointer", textDecoration: "none",
    color: "rgba(255,255,255,.65)", transition: "background .15s",
    marginBottom: 2,
  };
  const itemActive: React.CSSProperties = {
    background: "#0066CC", color: "#fff", fontWeight: 600,
  };
  const bottomArea: React.CSSProperties = {
    padding: "12px 14px", borderTop: "1px solid rgba(255,255,255,.08)",
  };

  return (
    <>
      <aside style={sidebarStyle}>
        <div style={logoArea}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#fff" }}>Voltfox</div>
          <div style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>CBAM Platform</div>
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
                    onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,.08)"; }}
                    onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = "transparent"; }}
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
            <div style={{ fontSize: 11, color: "#94A3B8", marginBottom: 8, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
              {user.email}
            </div>
          )}
          <button
            style={{ width: "100%", padding: "7px 0", background: "rgba(255,255,255,.08)", border: "none", borderRadius: 6, color: "rgba(255,255,255,.65)", fontSize: 13, cursor: "pointer" }}
            onClick={() => supabase.auth.signOut()}
          >
            Çıkış
          </button>
        </div>
      </aside>

      <main style={{ marginLeft: 240, minHeight: "100vh", background: "#F8FAFC" }}>
        {children}
      </main>
    </>
  );
}
