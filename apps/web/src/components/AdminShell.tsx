import { type ReactNode } from "react";
import { Link, useLocation, Navigate } from "react-router-dom";
import { useSuperAdmin } from "../hooks/useSuperAdmin.js";

interface AdminNavItem { icon: string; label: string; path: string; }

const ADMIN_NAV: AdminNavItem[] = [
  { icon: "📊", label: "Genel Bakış",  path: "/admin" },
  { icon: "🏢", label: "Tenant'lar",   path: "/admin/tenants" },
  { icon: "👥", label: "Kullanıcılar", path: "/admin/users" },
  { icon: "📡", label: "EF Verisi",    path: "/admin/ef-data" },
  { icon: "📢", label: "Duyurular",    path: "/admin/announcements" },
  { icon: "🔗", label: "Webhook Log",  path: "/admin/webhooks" },
];

export default function AdminShell({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", color: "#6b7280" }}>
        Doğrulanıyor...
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <Navigate to="/dashboard" replace />;
  }

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "system-ui, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "#111827",
        color: "#f9fafb",
        display: "flex",
        flexDirection: "column",
        padding: "0",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1f2937" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#6b7280", textTransform: "uppercase", marginBottom: 4 }}>
            Voltfox
          </div>
          <div style={{ fontSize: 15, fontWeight: 600, color: "#f9fafb" }}>Admin Panel</div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 8px" }}>
          {ADMIN_NAV.map(item => {
            const active = item.path === "/admin"
              ? location.pathname === "/admin"
              : location.pathname.startsWith(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 10px",
                  borderRadius: 6,
                  marginBottom: 2,
                  fontSize: 14,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#f9fafb" : "#9ca3af",
                  background: active ? "#1f2937" : "transparent",
                  textDecoration: "none",
                  transition: "background 0.15s, color 0.15s",
                }}
              >
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1f2937" }}>
          <Link to="/gec" style={{ fontSize: 13, color: "#6b7280", textDecoration: "none" }}>
            ← Platforma dön
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main style={{
        flex: 1,
        overflow: "auto",
        background: "#f3f4f6",
        display: "flex",
        flexDirection: "column",
      }}>
        {children}
      </main>
    </div>
  );
}
