import { type ReactNode, useState } from "react";
import { Link, useLocation, Navigate, useNavigate } from "react-router-dom";
import { useSuperAdmin } from "../hooks/useSuperAdmin.js";
import { supabase } from "../lib/supabase.js";

interface AdminNavItem { icon: string; label: string; path: string; }

const ADMIN_NAV: AdminNavItem[] = [
  { icon: "📊", label: "Genel Bakış",  path: "/admin" },
  { icon: "🏢", label: "Tenant'lar",   path: "/admin/tenants" },
  { icon: "👥", label: "Kullanıcılar", path: "/admin/users" },
  { icon: "📡", label: "EF Verisi",    path: "/admin/ef-data" },
  { icon: "📢", label: "Duyurular",    path: "/admin/announcements" },
  { icon: "🔗", label: "Webhook Log",  path: "/admin/webhooks" },
];

const PAGE_NAMES: Record<string, string> = {
  "/admin":               "Genel Bakış",
  "/admin/tenants":       "Tenant'lar",
  "/admin/users":         "Kullanıcılar",
  "/admin/ef-data":       "EF Verisi",
  "/admin/announcements": "Duyurular",
  "/admin/webhooks":      "Webhook Log",
};

const SQL_CMD = `UPDATE auth.users
SET raw_app_meta_data = raw_app_meta_data || '{"is_super_admin": true}'
WHERE email = 'your-email@example.com';`;

function NotSuperAdminScreen() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(SQL_CMD).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "#0f172a",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: 24,
      fontFamily: "system-ui, sans-serif",
    }}>
      <div style={{
        maxWidth: 560,
        width: "100%",
        background: "#1e293b",
        borderRadius: 16,
        border: "1px solid #334155",
        padding: "44px 40px",
        boxShadow: "0 20px 60px rgba(0,0,0,.5)",
      }}>
        <div style={{ fontSize: 40, marginBottom: 16, textAlign: "center" }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f1f5f9", marginBottom: 8, textAlign: "center" }}>
          Super Admin Yetkisi Gerekli
        </h1>
        <p style={{ fontSize: 14, color: "#94a3b8", textAlign: "center", lineHeight: 1.7, marginBottom: 28 }}>
          Bu panele erişmek için Supabase'de <code style={{ background: "#0f172a", padding: "1px 6px", borderRadius: 4, color: "#7dd3fc", fontSize: 13 }}>is_super_admin</code> bayrağı gereklidir.
        </p>

        <div style={{ background: "#0f172a", borderRadius: 10, border: "1px solid #334155", overflow: "hidden", marginBottom: 20 }}>
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 14px", borderBottom: "1px solid #334155",
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#64748b", fontFamily: "monospace" }}>
              Supabase SQL Editor
            </span>
            <button
              onClick={copy}
              style={{
                background: copied ? "#065F46" : "#1e293b",
                color: copied ? "#6ee7b7" : "#94a3b8",
                border: "1px solid #334155",
                borderRadius: 6, padding: "3px 10px", fontSize: 11,
                fontWeight: 600, cursor: "pointer", transition: "all .2s",
              }}
            >
              {copied ? "✓ Kopyalandı" : "Kopyala"}
            </button>
          </div>
          <pre style={{
            margin: 0, padding: "14px 16px",
            fontFamily: "monospace", fontSize: 12, lineHeight: 1.7,
            color: "#e2e8f0", whiteSpace: "pre-wrap" as const, wordBreak: "break-all" as const,
          }}>
            <span style={{ color: "#7dd3fc" }}>UPDATE</span> auth.users{"\n"}
            <span style={{ color: "#7dd3fc" }}>SET</span> raw_app_meta_data = raw_app_meta_data || <span style={{ color: "#86efac" }}>'{`{"is_super_admin": true}`}'</span>{"\n"}
            <span style={{ color: "#7dd3fc" }}>WHERE</span> email = <span style={{ color: "#fbbf24" }}>'your-email@example.com'</span>;
          </pre>
        </div>

        <div style={{ fontSize: 12, color: "#64748b", lineHeight: 1.7, marginBottom: 28 }}>
          <div style={{ fontWeight: 600, color: "#94a3b8", marginBottom: 6 }}>Adımlar:</div>
          <ol style={{ margin: 0, paddingLeft: 18, display: "flex", flexDirection: "column", gap: 4 }}>
            <li>Supabase Dashboard → SQL Editor'ı açın</li>
            <li>Yukarıdaki SQL'i email adresinizle güncelleyip çalıştırın</li>
            <li>Sayfayı yenileyin ve tekrar deneyin</li>
          </ol>
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={() => window.location.reload()}
            style={{
              flex: 1, padding: "10px", borderRadius: 8, border: "none",
              background: "#3b82f6", color: "#fff", fontWeight: 700,
              fontSize: 14, cursor: "pointer",
            }}
          >
            Sayfayı Yenile
          </button>
          <button
            onClick={() => navigate("/dashboard")}
            style={{
              flex: 1, padding: "10px", borderRadius: 8,
              border: "1px solid #334155", background: "transparent",
              color: "#94a3b8", fontWeight: 600, fontSize: 14, cursor: "pointer",
            }}
          >
            Platforma Dön
          </button>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            onClick={() => supabase.auth.signOut()}
            style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer" }}
          >
            Farklı hesapla giriş yap
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdminShell({ children }: { children: ReactNode }) {
  const { isSuperAdmin, loading } = useSuperAdmin();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        height: "100vh", background: "#0f172a", color: "#64748b",
        fontFamily: "system-ui, sans-serif", fontSize: 14,
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 24, marginBottom: 8 }}>⏳</div>
          Doğrulanıyor...
        </div>
      </div>
    );
  }

  if (!isSuperAdmin) {
    return <NotSuperAdminScreen />;
  }

  const pageName = PAGE_NAMES[location.pathname] ?? "Admin";

  return (
    <div style={{ display: "flex", height: "100vh", overflow: "hidden", fontFamily: "system-ui, -apple-system, sans-serif" }}>
      {/* Sidebar */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "#0f172a",
        color: "#f8fafc",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Branding */}
        <div style={{ padding: "20px 16px 16px", borderBottom: "1px solid #1e293b" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "linear-gradient(135deg,#00b87a,#009966)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 14, fontWeight: 900, color: "#fff", flexShrink: 0,
            }}>
              V
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#f1f5f9" }}>Voltfox</div>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#00b87a", letterSpacing: "0.08em", textTransform: "uppercase" }}>
                Admin Panel
              </div>
            </div>
          </div>
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
                  borderRadius: 7,
                  marginBottom: 2,
                  fontSize: 13,
                  fontWeight: active ? 600 : 400,
                  color: active ? "#f1f5f9" : "#94a3b8",
                  background: active ? "#1e293b" : "transparent",
                  textDecoration: "none",
                  transition: "background 0.12s, color 0.12s",
                  borderLeft: active ? "2px solid #00b87a" : "2px solid transparent",
                }}
                onMouseEnter={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "#1e293b";
                    (e.currentTarget as HTMLElement).style.color = "#f1f5f9";
                  }
                }}
                onMouseLeave={e => {
                  if (!active) {
                    (e.currentTarget as HTMLElement).style.background = "transparent";
                    (e.currentTarget as HTMLElement).style.color = "#94a3b8";
                  }
                }}
              >
                <span style={{ fontSize: 15, width: 20, textAlign: "center", flexShrink: 0 }}>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div style={{ padding: "12px 16px", borderTop: "1px solid #1e293b" }}>
          <Link
            to="/dashboard"
            style={{ fontSize: 12, color: "#64748b", textDecoration: "none", display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#94a3b8"}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#64748b"}
          >
            ← Platforma dön
          </Link>
        </div>
      </aside>

      {/* Main area */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Top bar */}
        <header style={{
          height: 52,
          background: "#fff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex",
          alignItems: "center",
          padding: "0 28px",
          gap: 12,
          flexShrink: 0,
          boxShadow: "0 1px 3px rgba(0,0,0,.06)",
        }}>
          {/* Breadcrumb */}
          <nav style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, flex: 1 }}>
            <Link to="/admin" style={{ color: "#64748b", textDecoration: "none", fontWeight: 500 }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = "#374151"}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = "#64748b"}
            >
              Admin
            </Link>
            {location.pathname !== "/admin" && (
              <>
                <span style={{ color: "#d1d5db" }}>/</span>
                <span style={{ color: "#111827", fontWeight: 600 }}>{pageName}</span>
              </>
            )}
          </nav>

          {/* Admin badge */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "#fef3c7", color: "#92400e",
            padding: "4px 10px", borderRadius: 99,
            fontSize: 11, fontWeight: 700, letterSpacing: "0.04em",
            border: "1px solid #fde68a",
          }}>
            ⚡ SUPER ADMIN
          </div>

          {/* Sign out */}
          <button
            onClick={() => supabase.auth.signOut()}
            style={{
              background: "none", border: "1px solid #e2e8f0",
              borderRadius: 7, padding: "5px 12px",
              fontSize: 12, fontWeight: 600, color: "#64748b",
              cursor: "pointer", transition: "all .15s",
            }}
            onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = "#ef4444"; (e.currentTarget as HTMLElement).style.color = "#ef4444"; }}
            onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = "#e2e8f0"; (e.currentTarget as HTMLElement).style.color = "#64748b"; }}
          >
            Çıkış
          </button>
        </header>

        {/* Scrollable content */}
        <main style={{
          flex: 1,
          overflow: "auto",
          background: "#f8fafc",
        }}>
          {children}
        </main>
      </div>
    </div>
  );
}
