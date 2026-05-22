import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import type { SearchResult } from "../lib/api.js";

const SECTOR_LABELS: Record<string, string> = {
  steel: "Çelik", aluminium: "Alüminyum", cement: "Çimento",
  fertilizer: "Gübre", electricity: "Elektrik", chemicals: "Kimyasal", hydrogen: "Hidrojen",
};

type ResultItem =
  | { kind: "installation"; id: string; label: string; sub: string; href: string }
  | { kind: "period"; id: string; label: string; sub: string; href: string };

function buildItems(data: SearchResult | null): ResultItem[] {
  if (!data) return [];
  const items: ResultItem[] = [];
  for (const inst of data.installations) {
    items.push({
      kind: "installation",
      id:   inst.id,
      label: inst.facilityName,
      sub:  `${inst.operator} · ${inst.facilityCountry} · ${SECTOR_LABELS[inst.sector] ?? inst.sector} · ${inst._count.periods} dönem`,
      href: `/installations/${inst.id}`,
    });
  }
  for (const p of data.periods) {
    items.push({
      kind: "period",
      id:   p.id,
      label: p.periodName,
      sub:  `${p.installation.facilityName} · CN ${p.cnCode} · ${p.importCountry}`,
      href: `/installations/${p.installation.id}/periods/${p.id}`,
    });
  }
  return items;
}

export default function GlobalSearch() {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [data,    setData]    = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor,  setCursor]  = useState(0);
  const inputRef  = useRef<HTMLInputElement>(null);
  const timerRef  = useRef<ReturnType<typeof setTimeout>>();
  const navigate  = useNavigate();

  // Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
      setQuery("");
      setData(null);
      setCursor(0);
    }
  }, [open]);

  const search = useCallback((q: string) => {
    clearTimeout(timerRef.current);
    if (!q.trim()) { setData(null); setLoading(false); return; }
    setLoading(true);
    timerRef.current = setTimeout(async () => {
      try {
        const res = await api.search.query({ q, limit: 10 });
        setData(res);
        setCursor(0);
      } catch {
        setData(null);
      }
      setLoading(false);
    }, 280);
  }, []);

  function onInput(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value;
    setQuery(v);
    search(v);
  }

  const items = buildItems(data);

  function go(href: string) {
    setOpen(false);
    navigate(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && items[cursor]) go(items[cursor].href);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ara (Ctrl+K)"
        style={{
          display: "flex", alignItems: "center", gap: 6,
          padding: "5px 10px", borderRadius: 7, border: "1px solid rgba(255,255,255,.15)",
          background: "rgba(255,255,255,.08)", color: "rgba(255,255,255,.65)",
          cursor: "pointer", fontSize: 12, fontFamily: "inherit",
        }}
      >
        🔍 <span>Ara</span>
        <span style={{ fontSize: 10, opacity: 0.6, marginLeft: 4 }}>⌘K</span>
      </button>
    );
  }

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={() => setOpen(false)}
        style={{
          position: "fixed", inset: 0, background: "rgba(0,0,0,.45)",
          zIndex: 900, backdropFilter: "blur(2px)",
        }}
      />

      {/* Palette */}
      <div style={{
        position: "fixed", top: "14%", left: "50%", transform: "translateX(-50%)",
        width: "min(580px,92vw)", background: "#fff", borderRadius: 14,
        boxShadow: "0 24px 80px rgba(0,0,0,.2)", zIndex: 901, overflow: "hidden",
      }}>
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: "1px solid #eef7f3" }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder="Tesis adı, dönem, CN kodu..."
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 15,
              color: "#0a1f1a", background: "transparent", fontFamily: "inherit",
            }}
          />
          {loading && <span style={{ fontSize: 12, color: "#94A3B8" }}>...</span>}
          <kbd style={{ fontSize: 11, background: "#f4fbf8", border: "1px solid #d4ece4", borderRadius: 5, padding: "2px 6px", color: "#5c7a72" }}>Esc</kbd>
        </div>

        {/* Results */}
        {items.length === 0 && query.trim() && !loading && (
          <div style={{ padding: "24px 16px", textAlign: "center", color: "#94A3B8", fontSize: 13 }}>
            "{query}" için sonuç bulunamadı
          </div>
        )}

        {items.length === 0 && !query.trim() && (
          <div style={{ padding: "16px", fontSize: 12, color: "#94A3B8" }}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Hızlı erişim</div>
            {[
              { label: "Tüm Tesisler", href: "/cbam", icon: "🏭" },
              { label: "Dashboard",    href: "/dashboard", icon: "📊" },
              { label: "GEC Hesaplama", href: "/gec", icon: "🔬" },
              { label: "CFE Matching", href: "/cfe", icon: "⚡" },
              { label: "EF Veri Servisi", href: "/ef-data", icon: "📡" },
              { label: "Ayarlar",      href: "/settings", icon: "⚙️" },
            ].map(item => (
              <div
                key={item.href}
                onClick={() => go(item.href)}
                style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", borderRadius: 7, cursor: "pointer", marginBottom: 2, transition: "background .1s" }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = "#f4fbf8"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <span>{item.icon}</span>
                <span style={{ fontSize: 13, color: "#0a1f1a" }}>{item.label}</span>
              </div>
            ))}
          </div>
        )}

        {items.length > 0 && (
          <div style={{ maxHeight: 380, overflowY: "auto" }}>
            {data && data.installations.length > 0 && (
              <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".08em" }}>
                Tesisler ({data.installations.length})
              </div>
            )}
            {items.map((item, i) => {
              const isNewGroup = i > 0 && item.kind !== items[i - 1].kind;
              return (
                <div key={item.id}>
                  {isNewGroup && (
                    <div style={{ padding: "8px 16px 4px", fontSize: 10, fontWeight: 700, color: "#94A3B8", textTransform: "uppercase", letterSpacing: ".08em", borderTop: "1px solid #f0f9f5" }}>
                      Dönemler ({data?.periods.length})
                    </div>
                  )}
                  <div
                    onClick={() => go(item.href)}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      padding: "10px 16px", cursor: "pointer",
                      background: cursor === i ? "#e6f9f2" : "transparent",
                      transition: "background .1s",
                    }}
                    onMouseEnter={() => setCursor(i)}
                  >
                    <span style={{ fontSize: 18, flexShrink: 0 }}>
                      {item.kind === "installation" ? "🏭" : "📅"}
                    </span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: cursor === i ? "#00b87a" : "#0a1f1a", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.label}
                      </div>
                      <div style={{ fontSize: 11, color: "#5c7a72", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.sub}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, color: "#94A3B8", flexShrink: 0 }}>
                      {item.kind === "installation" ? "Tesis" : "Dönem"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div style={{ padding: "8px 16px", borderTop: "1px solid #f0f9f5", display: "flex", gap: 16, fontSize: 11, color: "#94A3B8" }}>
          <span>↑↓ Gezin</span>
          <span>↵ Aç</span>
          <span>Esc Kapat</span>
        </div>
      </div>
    </>
  );
}
