import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import type { NotificationItem } from "../lib/api.js";

const POLL_INTERVAL = 30_000;

const TYPE_ICON: Record<string, string> = {
  calculation_done: "📊",
  cfe_done:         "⚡",
  member_invited:   "👤",
  period_created:   "📅",
};

interface NotificationBellProps {
  topBar?: boolean;
  isDark?: boolean;
}

export default function NotificationBell({ topBar = false, isDark = false }: NotificationBellProps) {
  const [items,   setItems]   = useState<NotificationItem[]>([]);
  const [unread,  setUnread]  = useState(0);
  const [open,    setOpen]    = useState(false);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate    = useNavigate();

  async function load(silent = false) {
    if (!silent) setLoading(true);
    try {
      const res = await api.notifications.list();
      setItems(res.notifications);
      setUnread(res.unreadCount);
    } catch { /* ignore */ }
    if (!silent) setLoading(false);
  }

  useEffect(() => {
    load();
    const id = setInterval(() => load(true), POLL_INTERVAL);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function markRead(id: string) {
    await api.notifications.markRead(id).catch(() => {});
    setItems(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  }

  async function markAllRead() {
    await api.notifications.markAllRead().catch(() => {});
    setItems(prev => prev.map(n => ({ ...n, read: true })));
    setUnread(0);
  }

  async function remove(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    await api.notifications.delete(id).catch(() => {});
    const removed = items.find(n => n.id === id);
    setItems(prev => prev.filter(n => n.id !== id));
    if (removed && !removed.read) setUnread(prev => Math.max(0, prev - 1));
  }

  function handleClick(n: NotificationItem) {
    if (!n.read) markRead(n.id);
    if (n.resource === "Installation" && n.resourceId) {
      navigate(`/installations/${n.resourceId}`);
    } else if (n.resource === "ReportingPeriod") {
      navigate("/cbam");
    } else if (n.resource === "CFEMatchingResult") {
      navigate("/cfe");
    }
    setOpen(false);
  }

  function relativeTime(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return "şimdi";
    if (m < 60) return `${m}dk önce`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}sa önce`;
    return `${Math.floor(h / 24)}g önce`;
  }

  // Button color depends on context (topbar=light, sidebar=dark)
  const btnColor = topBar
    ? (isDark ? "rgba(255,255,255,.65)" : "#5c7a72")
    : "rgba(255,255,255,.7)";

  const btnHoverColor = topBar ? (isDark ? "#fff" : "#009966") : "#fff";
  const btnHoverBg    = topBar ? (isDark ? "rgba(255,255,255,.08)" : "#f0faf5") : "rgba(255,255,255,.1)";

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => { setOpen(v => !v); if (!open) load(); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          padding: "7px 8px", borderRadius: 8, position: "relative",
          fontSize: 18, lineHeight: 1, color: btnColor,
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background .15s, color .15s",
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.color = btnHoverColor; (e.currentTarget as HTMLElement).style.background = btnHoverBg; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.color = btnColor; (e.currentTarget as HTMLElement).style.background = "none"; }}
        title="Bildirimler"
      >
        🔔
        {unread > 0 && (
          <span style={{
            position: "absolute", top: 2, right: 2,
            background: "#ef4444", color: "#fff",
            borderRadius: "99px", fontSize: 9, fontWeight: 800,
            minWidth: 15, height: 15, lineHeight: "15px",
            textAlign: "center", padding: "0 3px",
          }}>
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: "absolute",
          top: "calc(100% + 10px)",
          right: 0,
          width: 320,
          background: isDark ? "#162820" : "#fff",
          borderRadius: 12,
          boxShadow: "0 12px 40px rgba(0,0,0,.18)",
          border: `1px solid ${isDark ? "rgba(255,255,255,.08)" : "#d4ece4"}`,
          zIndex: 500,
          overflow: "hidden",
        }}>
          <div style={{
            display: "flex", justifyContent: "space-between", alignItems: "center",
            padding: "12px 16px", borderBottom: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#eef7f3"}`,
          }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: isDark ? "#e2efe9" : "#0a1f1a" }}>
              Bildirimler{" "}
              {unread > 0 && (
                <span style={{ background: "#ef4444", color: "#fff", borderRadius: 99, fontSize: 10, padding: "1px 6px", marginLeft: 4 }}>
                  {unread}
                </span>
              )}
            </div>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                style={{ fontSize: 11, color: "#00b87a", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
              >
                Tümünü okundu işaretle
              </button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {loading && items.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: isDark ? "#7dab97" : "#5c7a72", fontSize: 13 }}>
                Yükleniyor…
              </div>
            ) : items.length === 0 ? (
              <div style={{ padding: "32px 16px", textAlign: "center" }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 13, color: isDark ? "#7dab97" : "#5c7a72" }}>Henüz bildirim yok</div>
              </div>
            ) : (
              items.map(n => (
                <div
                  key={n.id}
                  onClick={() => handleClick(n)}
                  style={{
                    display: "flex", gap: 10, padding: "12px 16px", cursor: "pointer",
                    background: n.read ? "transparent" : (isDark ? "rgba(0,184,122,.08)" : "#f0fdf8"),
                    borderBottom: `1px solid ${isDark ? "rgba(255,255,255,.05)" : "#f0f9f5"}`,
                    transition: "background .12s",
                  }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,.05)" : "#eef7f3"}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = n.read ? "transparent" : (isDark ? "rgba(0,184,122,.08)" : "#f0fdf8")}
                >
                  <div style={{ fontSize: 20, flexShrink: 0, marginTop: 1 }}>
                    {TYPE_ICON[n.type] ?? "📌"}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 13,
                      fontWeight: n.read ? 400 : 700,
                      color: isDark ? "#e2efe9" : "#0a1f1a",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {n.title}
                    </div>
                    {n.body && (
                      <div style={{ fontSize: 11, color: isDark ? "#7dab97" : "#5c7a72", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                      {relativeTime(n.createdAt)}
                    </div>
                  </div>
                  <button
                    onClick={e => remove(n.id, e)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      color: "#d1d5db", fontSize: 14, padding: "0 2px", flexShrink: 0, alignSelf: "flex-start",
                    }}
                    title="Bildirimi sil"
                  >✕</button>
                </div>
              ))
            )}
          </div>

          <div style={{ padding: "8px 16px", borderTop: `1px solid ${isDark ? "rgba(255,255,255,.07)" : "#eef7f3"}`, textAlign: "center" }}>
            <button
              onClick={() => { navigate("/profile"); setOpen(false); }}
              style={{ fontSize: 11, color: isDark ? "#7dab97" : "#5c7a72", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}
            >
              Bildirim tercihlerini yönet →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
