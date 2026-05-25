import { useState, type ReactNode } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Zap, Factory, Leaf, Database,
  Radio, GitBranch, FileText, ShieldCheck, TrendingUp,
  Sliders, Settings, ChevronRight, ChevronsUpDown,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "../hooks/useAuth.js";
import TopBar from "./TopBar.js";

interface SubItem  { icon?: LucideIcon; label: string; path: string; }
interface NavItem  { icon: LucideIcon; label: string; path: string; badge?: string; children?: SubItem[]; }
interface NavGroup { title: string; items: NavItem[]; }

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Ana Menü",
    items: [
      { icon: LayoutDashboard, label: "Dashboard",       path: "/dashboard" },
    ],
  },
  {
    title: "Ürünler",
    items: [
      { icon: Zap,        label: "24/7 CFE Matching", path: "/cfe",
        children: [
          { label: "Portföy",      path: "/cfe" },
          { label: "Eşleştirme",   path: "/cfe/matching" },
          { label: "Veri Girişi",  path: "/cfe/data-entry" },
          { label: "Sertifikalar", path: "/cfe/certificates" },
          { label: "Tesisler",     path: "/cfe/facilities" },
          { label: "Green Assets", path: "/cfe/green-assets" },
        ],
      },
      { icon: Factory,    label: "CBAM Emissions",    path: "/cbam",
        children: [
          { label: "Tesisler",     path: "/cbam" },
          { label: "Teknik Dosya", path: "/reports/cbam" },
        ],
      },
      { icon: Leaf,       label: "GEC Scope 1",       path: "/gec" },
      { icon: Database,   label: "EF Veri Servisi",   path: "/ef-data" },
      { icon: Radio,      label: "Canlı & Tahmin",    path: "/live-forecast", badge: "LIVE" },
      { icon: GitBranch,  label: "ESG Playground",    path: "/esg-playground" },
    ],
  },
  {
    title: "Raporlamalar",
    items: [
      { icon: FileText,    label: "CDP / ISO / GHG",  path: "/reports/cdp" },
      { icon: ShieldCheck, label: "CSRD E1",           path: "/csrd" },
    ],
  },
  {
    title: "Araçlar",
    items: [
      { icon: TrendingUp, label: "Karbon Fiyatları",  path: "/carbon-prices" },
      { icon: Sliders,    label: "Araçlar",            path: "/comparison" },
      { icon: Settings,   label: "Ayarlar",            path: "/settings" },
    ],
  },
];

/* ── Secondary nav ────────────────────────────────────────── */
interface SubNavTab { label: string; path: string; exact?: boolean; }
interface SubNavConfig { prefix: string; tabs: SubNavTab[]; }

const SUBNAVS: SubNavConfig[] = [
  {
    prefix: "/cfe",
    tabs: [
      { label: "Portföy",      path: "/cfe",              exact: true },
      { label: "Eşleştirme",  path: "/cfe/matching" },
      { label: "Veri Girişi", path: "/cfe/data-entry" },
      { label: "Sertifikalar",path: "/cfe/certificates" },
      { label: "Tesisler",    path: "/cfe/facilities" },
      { label: "Green Assets",path: "/cfe/green-assets" },
    ],
  },
  {
    prefix: "/live-forecast",
    tabs: [
      { label: "Piyasa Fiyatları",  path: "/live-forecast",            exact: true },
      { label: "RE Üretimi",        path: "/live-forecast/generation" },
      { label: "Karbon Yoğunluğu", path: "/live-forecast/carbon" },
      { label: "Optimal Pencere",   path: "/live-forecast/optimal" },
    ],
  },
  {
    prefix: "/ef-data",
    tabs: [
      { label: "Dashboard",     path: "/ef-data",         exact: true },
      { label: "Zone Tarayıcı", path: "/ef-data/zones" },
      { label: "Kapsam",        path: "/ef-data/coverage" },
      { label: "API Docs",      path: "/ef-data/api" },
    ],
  },
];

function isActive(path: string, pathname: string, exact?: boolean): boolean {
  if (exact) return pathname === path;
  if (path === "/cbam") return pathname === "/cbam" || pathname.startsWith("/cbam/");
  if (path === "/cfe")  return pathname === "/cfe"  || pathname.startsWith("/cfe/");
  return pathname === path || pathname.startsWith(path + "/");
}

function NavItemRow({ item, depth = 0 }: { item: NavItem; depth?: number }) {
  const location = useLocation();
  const [open, setOpen] = useState(() =>
    item.children?.some(c => isActive(c.path, location.pathname)) ?? false
  );
  const active = isActive(item.path, location.pathname);
  const Icon = item.icon;

  if (!item.children) {
    return (
      <Link
        to={item.path}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "8px 10px",
          borderRadius: "var(--radius-md)",
          color: active ? "var(--accent)" : "var(--text-secondary)",
          background: active ? "var(--accent-bg)" : "transparent",
          border: active ? "1px solid var(--border-accent)" : "1px solid transparent",
          fontSize: "var(--text-sm)",
          fontWeight: active ? 600 : 500,
          textDecoration: "none",
          marginBottom: "1px",
          position: "relative",
          fontFamily: "var(--font-sans)",
          transition: "background 0.12s, color 0.12s",
        }}
      >
        {active && (
          <span style={{
            position: "absolute",
            left: "-10px",
            top: "50%",
            transform: "translateY(-50%)",
            width: "3px",
            height: "18px",
            background: "var(--accent)",
            borderRadius: "0 2px 2px 0",
          }} />
        )}
        <Icon size={15} strokeWidth={2} style={{ flexShrink: 0, opacity: active ? 1 : 0.7 }} />
        <span style={{ flex: 1 }}>{item.label}</span>
        {item.badge && (
          <span style={{
            background: "var(--accent-bg)",
            color: "var(--accent)",
            border: "1px solid var(--border-accent)",
            fontSize: "9px",
            fontWeight: 700,
            padding: "1px 5px",
            borderRadius: "var(--radius-pill)",
            letterSpacing: "0.5px",
          }}>
            {item.badge}
          </span>
        )}
      </Link>
    );
  }

  return (
    <div>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "9px",
          padding: "8px 10px",
          borderRadius: "var(--radius-md)",
          color: active || open ? "var(--text-primary)" : "var(--text-secondary)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          width: "100%",
          fontSize: "var(--text-sm)",
          fontWeight: 500,
          marginBottom: "1px",
          fontFamily: "var(--font-sans)",
          transition: "background 0.12s",
        }}
        onMouseEnter={e => (e.currentTarget.style.background = "var(--border)")}
        onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
      >
        <Icon size={15} strokeWidth={2} style={{ flexShrink: 0, opacity: 0.7 }} />
        <span style={{ flex: 1, textAlign: "left" }}>{item.label}</span>
        <ChevronRight size={13} style={{ transition: "transform 0.2s", transform: open ? "rotate(90deg)" : "rotate(0)" }} />
      </button>

      {open && (
        <div style={{ paddingLeft: "24px", marginBottom: "4px" }}>
          {item.children!.map(child => {
            const childActive = isActive(child.path, location.pathname, child.path === item.path);
            return (
              <Link
                key={child.path}
                to={child.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 10px",
                  borderRadius: "var(--radius-sm)",
                  color: childActive ? "var(--accent)" : "var(--text-muted)",
                  borderLeft: `1px solid ${childActive ? "var(--border-accent)" : "var(--border)"}`,
                  fontSize: "var(--text-sm)",
                  fontWeight: childActive ? 600 : 400,
                  textDecoration: "none",
                  marginBottom: "1px",
                  fontFamily: "var(--font-sans)",
                  transition: "color 0.12s",
                }}
              >
                {child.label}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

interface AppShellProps { children: ReactNode; }

export default function AppShell({ children }: AppShellProps) {
  const location = useLocation();
  const { user } = useAuth();
  const displayName = (user?.user_metadata?.display_name as string | undefined) ?? user?.email ?? "";
  const initials = displayName.slice(0, 2).toUpperCase();

  const activeSubnav = SUBNAVS.find(s => location.pathname.startsWith(s.prefix));

  return (
    <div style={{ display: "flex", height: "100vh", background: "var(--bg-base)", fontFamily: "var(--font-sans)" }}>
      {/* SIDEBAR */}
      <aside style={{
        width: "220px",
        minWidth: "220px",
        background: "var(--bg-sidebar)",
        borderRight: "1px solid rgba(255,255,255,0.06)",
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        overflowY: "auto",
        overflowX: "hidden",
      }}>
        {/* Logo */}
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "18px 16px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{
            width: "30px",
            height: "30px",
            background: "linear-gradient(135deg, var(--accent), var(--accent-muted))",
            borderRadius: "var(--radius-md)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: "14px",
            fontWeight: 800,
            color: "var(--bg-base)",
            flexShrink: 0,
          }}>
            V
          </div>
          <div>
            <div style={{ fontSize: "15px", fontWeight: 700, color: "#e2f0ea", letterSpacing: "-0.3px" }}>
              Voltfox
            </div>
            <div style={{ fontSize: "9px", color: "rgba(255,255,255,0.35)", fontWeight: 500, letterSpacing: "0.5px" }}>
              ESG Platform
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
          {NAV_GROUPS.map(group => (
            <div key={group.title} style={{ marginBottom: "8px" }}>
              <div style={{
                fontSize: "9px",
                fontWeight: 700,
                color: "rgba(255,255,255,0.25)",
                textTransform: "uppercase",
                letterSpacing: "1.5px",
                padding: "6px 10px 4px",
              }}>
                {group.title}
              </div>
              {group.items.map(item => (
                <NavItemRow key={item.path} item={item} />
              ))}
            </div>
          ))}
        </div>

        {/* User footer */}
        <div style={{
          padding: "10px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          flexShrink: 0,
        }}>
          <div style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 10px",
            borderRadius: "var(--radius-md)",
            cursor: "pointer",
            transition: "background 0.12s",
          }}>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "var(--radius-md)",
              background: "linear-gradient(135deg, var(--accent), var(--accent-muted))",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "11px",
              fontWeight: 700,
              color: "var(--bg-base)",
              flexShrink: 0,
            }}>
              {initials || "U"}
            </div>
            <div style={{ overflow: "hidden" }}>
              <div style={{ fontSize: "12px", fontWeight: 600, color: "#e2f0ea", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {displayName || "Kullanıcı"}
              </div>
              <div style={{ fontSize: "10px", color: "rgba(255,255,255,0.3)" }}>Admin</div>
            </div>
            <ChevronsUpDown size={13} style={{ marginLeft: "auto", color: "rgba(255,255,255,0.25)", flexShrink: 0 }} />
          </div>
        </div>
      </aside>

      {/* MAIN */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <TopBar onMenuToggle={() => {}} mobile={false} />

        {/* Secondary subnav */}
        {activeSubnav && (
          <div style={{
            background: "var(--bg-surface)",
            borderBottom: "1px solid var(--border)",
            padding: "0 var(--space-6)",
            display: "flex",
            gap: "2px",
            flexShrink: 0,
          }}>
            {activeSubnav.tabs.map(tab => {
              const tabActive = tab.exact ? location.pathname === tab.path : location.pathname === tab.path;
              return (
                <Link
                  key={tab.path}
                  to={tab.path}
                  style={{
                    padding: "10px var(--space-4)",
                    fontSize: "var(--text-sm)",
                    fontWeight: tabActive ? 600 : 500,
                    color: tabActive ? "var(--accent)" : "var(--text-secondary)",
                    borderBottom: tabActive ? "2px solid var(--accent)" : "2px solid transparent",
                    textDecoration: "none",
                    transition: "color 0.12s",
                    fontFamily: "var(--font-sans)",
                  }}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Page content */}
        <main style={{ flex: 1, overflowY: "auto" }}>
          {children}
        </main>
      </div>
    </div>
  );
}
