import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import type { SearchResult } from "../lib/api.js";

const SECTOR_LABELS: Record<string, string> = {
  steel: "Çelik", aluminium: "Alüminyum", cement: "Çimento",
  fertilizer: "Gübre", electricity: "Elektrik", chemicals: "Kimyasal", hydrogen: "Hidrojen",
};

// Tüm uygulama sayfaları — metin aramasında eşleşir
const ALL_PAGES = [
  { label: "Dashboard",           sub: "Ana sayfa",                    href: "/dashboard",        icon: "📊", tags: "ana sayfa genel" },
  { label: "Granüler Hesaplama",  sub: "GEC — saatlik emisyon hesabı", href: "/gec",               icon: "🔬", tags: "gec hesaplama emisyon scope2" },
  { label: "24/7 CFE Matching",   sub: "Temiz enerji eşleştirme",      href: "/cfe",               icon: "⚡", tags: "cfe temiz enerji yenilenebilir matching" },
  { label: "CBAM Emissions",      sub: "Gömülü emisyon hesaplama",     href: "/cbam",              icon: "🏛️", tags: "cbam see tesis installation" },
  { label: "EF Veri Servisi",     sub: "Emisyon faktörü veri API",     href: "/ef-data",           icon: "📡", tags: "ef emisyon faktörü veri" },
  { label: "CBAM Teknik Dosya",   sub: "Rapor üretme",                 href: "/reports/cbam",      icon: "📄", tags: "rapor cbam teknik dosya" },
  { label: "CDP Raporu",          sub: "Carbon Disclosure Project",    href: "/reports/cdp",       icon: "📄", tags: "rapor cdp iklim" },
  { label: "ISO 14064",           sub: "GHG doğrulama raporu",         href: "/reports/iso14064",  icon: "📄", tags: "rapor iso standart" },
  { label: "GHG Protocol",        sub: "Sera gazı protokol raporu",    href: "/reports/ghg",       icon: "📄", tags: "rapor ghg protocol sera" },
  { label: "CSRD E1",             sub: "Sürdürülebilirlik raporu",     href: "/csrd",              icon: "🌍", tags: "rapor csrd sürdürülebilirlik" },
  { label: "Karbon Fiyatları",    sub: "EU ETS ve karbon borsası",     href: "/carbon-prices",     icon: "💶", tags: "karbon fiyat ets borsa eu" },
  { label: "Tesis Karşılaştırma", sub: "SEE değerlerini kıyasla",      href: "/comparison",        icon: "⚖️", tags: "karşılaştır kıyas benchmark" },
  { label: "Emisyon Hedefleri",   sub: "Yıllık azaltım hedefleri",     href: "/emission-targets",  icon: "🎯", tags: "hedef azaltım emisyon takip" },
  { label: "CSV Import",          sub: "Toplu veri yükleme",           href: "/import",            icon: "📥", tags: "import yükle csv excel toplu" },
  { label: "Sektör Benchmark",    sub: "Sektör SEE kıyaslaması",       href: "/benchmark",         icon: "📊", tags: "benchmark sektör kıyaslama" },
  { label: "API Playground",      sub: "API uç noktalarını test et",   href: "/api-playground",    icon: "🧪", tags: "api test playground geliştirici" },
  { label: "Ayarlar",             sub: "Hesap ve organizasyon",        href: "/settings",          icon: "⚙️", tags: "ayarlar organizasyon webhook api key" },
  { label: "Profil",              sub: "Kullanıcı bilgileri",          href: "/profile",           icon: "👤", tags: "profil kullanıcı hesap" },
];

function searchPages(q: string) {
  if (!q.trim()) return [];
  const lq = q.toLowerCase();
  return ALL_PAGES.filter(p =>
    p.label.toLowerCase().includes(lq) ||
    p.sub.toLowerCase().includes(lq) ||
    p.tags.toLowerCase().includes(lq)
  ).slice(0, 5);
}

type ResultItem =
  | { kind: "installation"; id: string; label: string; sub: string; href: string }
  | { kind: "period";       id: string; label: string; sub: string; href: string }
  | { kind: "page";         id: string; label: string; sub: string; href: string; icon: string };

function buildItems(data: SearchResult | null, pages: typeof ALL_PAGES): ResultItem[] {
  const items: ResultItem[] = [];
  if (data) {
    for (const inst of data.installations) {
      items.push({
        kind:  "installation",
        id:    inst.id,
        label: inst.facilityName,
        sub:   `${inst.operator} · ${inst.facilityCountry} · ${SECTOR_LABELS[inst.sector] ?? inst.sector} · ${inst._count.periods} dönem`,
        href:  `/installations/${inst.id}`,
      });
    }
    for (const p of data.periods) {
      items.push({
        kind:  "period",
        id:    p.id,
        label: p.periodName,
        sub:   `${p.installation.facilityName} · CN ${p.cnCode} · ${p.importCountry}`,
        href:  `/installations/${p.installation.id}/periods/${p.id}`,
      });
    }
  }
  for (const p of pages) {
    items.push({ kind: "page", id: p.href, label: p.label, sub: p.sub, href: p.href, icon: p.icon });
  }
  return items;
}

interface GlobalSearchProps {
  topBar?: boolean;
  isDark?: boolean;
}

export default function GlobalSearch({ topBar = false, isDark = false }: GlobalSearchProps) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState("");
  const [data,    setData]    = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [cursor,  setCursor]  = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const navigate = useNavigate();

  // Cmd+K / Ctrl+K
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") { e.preventDefault(); setOpen(v => !v); }
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
        const res = await api.search.query({ q, limit: 8 });
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

  const matchedPages = searchPages(query);
  const items        = buildItems(data, matchedPages);

  function go(href: string) {
    setOpen(false);
    navigate(href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setCursor(c => Math.min(c + 1, items.length - 1)); }
    if (e.key === "ArrowUp")   { e.preventDefault(); setCursor(c => Math.max(c - 1, 0)); }
    if (e.key === "Enter" && items[cursor]) go(items[cursor].href);
  }

  // ─── Trigger button ───────────────────────────────────────────────────────
  const triggerStyle: React.CSSProperties = topBar
    ? {
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "7px 14px",
        borderRadius: 8,
        border: `1px solid ${isDark ? "rgba(255,255,255,.12)" : "#d4ece4"}`,
        background: isDark ? "rgba(255,255,255,.05)" : "#f4fbf8",
        color: isDark ? "rgba(255,255,255,.5)" : "#7dab97",
        cursor: "pointer",
        fontSize: 13,
        fontFamily: "inherit",
        minWidth: 220,
        maxWidth: 400,
        width: "100%",
        transition: "border-color .15s, background .15s",
      }
    : {
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "7px 10px",
        borderRadius: 7,
        border: "1px solid rgba(255,255,255,.12)",
        background: "rgba(255,255,255,.07)",
        color: "rgba(255,255,255,.55)",
        cursor: "pointer",
        fontSize: 12,
        fontFamily: "inherit",
        width: "100%",
      };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        title="Ara (Ctrl+K)"
        style={triggerStyle}
        onMouseEnter={e => {
          if (topBar) {
            (e.currentTarget as HTMLElement).style.borderColor = isDark ? "rgba(255,255,255,.25)" : "#00b87a";
            (e.currentTarget as HTMLElement).style.background  = isDark ? "rgba(255,255,255,.08)" : "#eef7f3";
          }
        }}
        onMouseLeave={e => {
          if (topBar) {
            (e.currentTarget as HTMLElement).style.borderColor = isDark ? "rgba(255,255,255,.12)" : "#d4ece4";
            (e.currentTarget as HTMLElement).style.background  = isDark ? "rgba(255,255,255,.05)" : "#f4fbf8";
          }
        }}
      >
        <span style={{ fontSize: topBar ? 14 : 12 }}>🔍</span>
        <span style={{ flex: 1, textAlign: "left" }}>Ara…</span>
        <kbd style={{
          fontSize: 10,
          background: isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)",
          border: `1px solid ${isDark ? "rgba(255,255,255,.1)" : "rgba(0,0,0,.1)"}`,
          borderRadius: 5,
          padding: "2px 6px",
          color: isDark ? "rgba(255,255,255,.4)" : "#9ca3af",
        }}>
          ⌘K
        </kbd>
      </button>
    );
  }

  // ─── Search palette (modal) ──────────────────────────────────────────────
  const bgCard    = isDark ? "#0f1e1a" : "#fff";
  const bgHover   = isDark ? "rgba(0,184,122,.1)" : "#e6f9f2";
  const textMain  = isDark ? "#e2efe9" : "#0a1f1a";
  const textMuted = isDark ? "#7dab97" : "#5c7a72";
  const borderClr = isDark ? "rgba(255,255,255,.07)" : "#eef7f3";

  return (
    <>
      <div
        onClick={() => setOpen(false)}
        style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.45)", zIndex: 900, backdropFilter: "blur(3px)" }}
      />
      <div style={{
        position: "fixed",
        top: "12%",
        left: "50%",
        transform: "translateX(-50%)",
        width: "min(600px,94vw)",
        background: bgCard,
        borderRadius: 16,
        boxShadow: isDark ? "0 24px 80px rgba(0,0,0,.5)" : "0 24px 80px rgba(0,0,0,.18)",
        border: `1px solid ${isDark ? "rgba(255,255,255,.08)" : "#d4ece4"}`,
        zIndex: 901,
        overflow: "hidden",
      }}>
        {/* Input */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 16px", borderBottom: `1px solid ${borderClr}` }}>
          <span style={{ fontSize: 16, color: textMuted }}>🔍</span>
          <input
            ref={inputRef}
            value={query}
            onChange={onInput}
            onKeyDown={onKeyDown}
            placeholder="Tesis, dönem, CN kodu, sayfa adı…"
            style={{
              flex: 1, border: "none", outline: "none", fontSize: 15,
              color: textMain, background: "transparent", fontFamily: "inherit",
            }}
          />
          {loading && <span style={{ fontSize: 12, color: textMuted }}>…</span>}
          <kbd style={{
            fontSize: 11,
            background: isDark ? "rgba(255,255,255,.07)" : "#f4fbf8",
            border: `1px solid ${isDark ? "rgba(255,255,255,.1)" : "#d4ece4"}`,
            borderRadius: 5,
            padding: "2px 6px",
            color: textMuted,
          }}>Esc</kbd>
        </div>

        {/* Empty state — quick links */}
        {items.length === 0 && !query.trim() && (
          <div style={{ padding: "12px 16px 16px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: textMuted, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
              Hızlı Erişim
            </div>
            {ALL_PAGES.slice(0, 7).map(item => (
              <div
                key={item.href}
                onClick={() => go(item.href)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "8px 10px", borderRadius: 8, cursor: "pointer",
                  marginBottom: 2, transition: "background .1s",
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = isDark ? "rgba(255,255,255,.06)" : "#f4fbf8"}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = "transparent"}
              >
                <span style={{ fontSize: 16, width: 22, textAlign: "center" }}>{item.icon}</span>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 500, color: textMain }}>{item.label}</div>
                  <div style={{ fontSize: 11, color: textMuted }}>{item.sub}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* No results */}
        {items.length === 0 && query.trim() && !loading && (
          <div style={{ padding: "28px 16px", textAlign: "center", color: textMuted, fontSize: 13 }}>
            "<strong>{query}</strong>" için sonuç bulunamadı
          </div>
        )}

        {/* Results */}
        {items.length > 0 && (
          <div style={{ maxHeight: 400, overflowY: "auto" }}>
            {/* Group headers */}
            {(() => {
              let lastKind = "";
              return items.map((item, i) => {
                const showHeader = item.kind !== lastKind;
                lastKind = item.kind;
                const groupLabel =
                  item.kind === "installation" ? `Tesisler (${data?.installations.length})` :
                  item.kind === "period"       ? `Dönemler (${data?.periods.length})` :
                  "Sayfalar";
                const groupIcon =
                  item.kind === "installation" ? "🏭" :
                  item.kind === "period"       ? "📅" : null;

                return (
                  <div key={item.id + i}>
                    {showHeader && (
                      <div style={{
                        padding: "8px 16px 4px",
                        fontSize: 10,
                        fontWeight: 700,
                        color: textMuted,
                        textTransform: "uppercase" as const,
                        letterSpacing: ".08em",
                        borderTop: i > 0 ? `1px solid ${borderClr}` : undefined,
                      }}>
                        {groupLabel}
                      </div>
                    )}
                    <div
                      onClick={() => go(item.href)}
                      style={{
                        display: "flex", alignItems: "center", gap: 12,
                        padding: "10px 16px", cursor: "pointer",
                        background: cursor === i ? bgHover : "transparent",
                        transition: "background .1s",
                      }}
                      onMouseEnter={() => setCursor(i)}
                    >
                      <span style={{ fontSize: 18, flexShrink: 0, width: 22, textAlign: "center" }}>
                        {item.kind === "page"
                          ? (item as { kind: "page"; icon: string } & typeof item).icon
                          : groupIcon}
                      </span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontSize: 13, fontWeight: 600,
                          color: cursor === i ? "#00b87a" : textMain,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.label}
                        </div>
                        <div style={{
                          fontSize: 11, color: textMuted,
                          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                        }}>
                          {item.sub}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, color: textMuted, flexShrink: 0 }}>
                        {item.kind === "installation" ? "Tesis" : item.kind === "period" ? "Dönem" : "Sayfa"}
                      </span>
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        )}

        <div style={{
          padding: "8px 16px", borderTop: `1px solid ${borderClr}`,
          display: "flex", gap: 16, fontSize: 11, color: textMuted,
        }}>
          <span>↑↓ Gezin</span>
          <span>↵ Aç</span>
          <span>Esc Kapat</span>
        </div>
      </div>
    </>
  );
}
