import { useState, useEffect } from "react";
import { api } from "../../lib/api.js";
import type { Installation, CbamFacility, CbamProduct } from "../../lib/api.js";

interface ResourceItem {
  id: string;
  name: string;
  sub: string;
  nodeType: string;
  sourceType: "installation" | "cbamFacility" | "cbamProduct";
  icon: string;
}

type TabKey = "all" | "installations" | "cbam" | "products";

export function PlatformResourcesPanel({ text, sub, border }: {
  text: string; sub: string; border: string;
}) {
  const [items, setItems]       = useState<ResourceItem[]>([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState<string | null>(null);
  const [tab, setTab]           = useState<TabKey>("all");
  const [query, setQuery]       = useState("");

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const [installs, cbamRes] = await Promise.all([
          api.installations.list(),
          api.cbamFacilities.list(),
        ]);

        const installItems: ResourceItem[] = (installs ?? []).map((i: Installation) => ({
          id:         i.id,
          name:       i.facilityName,
          sub:        `${i.facilityCountry} · ${i.sector}`,
          nodeType:   "facilityNode",
          sourceType: "installation",
          icon:       "🏭",
        }));

        const cbamFacilities: CbamFacility[] = cbamRes?.facilities ?? [];
        const cbamItems: ResourceItem[] = cbamFacilities.map((f: CbamFacility) => ({
          id:         f.id,
          name:       f.facilityName,
          sub:        `CBAM · ${f.facilityCountry}`,
          nodeType:   "facilityNode",
          sourceType: "cbamFacility",
          icon:       "🌍",
        }));

        const productItems: ResourceItem[] = cbamFacilities.flatMap((f: CbamFacility) =>
          (f.products ?? []).map((p: CbamProduct) => ({
            id:         p.id,
            name:       p.productName,
            sub:        `${f.facilityName} · ${p.cnCode ?? "—"}`,
            nodeType:   "productNode",
            sourceType: "cbamProduct" as const,
            icon:       "📦",
          }))
        );

        setItems([...installItems, ...cbamItems, ...productItems]);
      } catch {
        setError("Kaynaklar yüklenemedi.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filtered = items.filter(item => {
    const matchesTab =
      tab === "all"           ? true :
      tab === "installations" ? item.sourceType === "installation" :
      tab === "cbam"          ? item.sourceType === "cbamFacility" :
      tab === "products"      ? item.sourceType === "cbamProduct"  : true;
    const matchesQuery = query.trim() === "" ||
      item.name.toLowerCase().includes(query.toLowerCase()) ||
      item.sub.toLowerCase().includes(query.toLowerCase());
    return matchesTab && matchesQuery;
  });

  const counts: Record<TabKey, number> = {
    all:           items.length,
    installations: items.filter(i => i.sourceType === "installation").length,
    cbam:          items.filter(i => i.sourceType === "cbamFacility").length,
    products:      items.filter(i => i.sourceType === "cbamProduct").length,
  };

  const tabs: Array<{ key: TabKey; label: string }> = [
    { key: "all",           label: "Tümü" },
    { key: "installations", label: "Tesisler" },
    { key: "cbam",          label: "CBAM" },
    { key: "products",      label: "Ürünler" },
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0, overflow: "hidden" }}>
      {/* Header */}
      <div style={{
        padding: "10px 14px", borderBottom: `1px solid ${border}`,
        fontSize: 11, fontWeight: 700, color: sub,
        textTransform: "uppercase", letterSpacing: "0.05em", flexShrink: 0,
      }}>
        Platform Kaynakları
      </div>

      {/* Search */}
      <div style={{ padding: "8px 10px", borderBottom: `1px solid ${border}`, flexShrink: 0 }}>
        <input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Kaynak ara..."
          style={{
            width: "100%", padding: "5px 8px", borderRadius: 5,
            border: `1px solid ${border}`, background: "transparent",
            color: text, fontSize: 11, outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", borderBottom: `1px solid ${border}`,
        flexShrink: 0, overflowX: "auto",
      }}>
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              flex: 1, padding: "6px 4px", border: "none",
              borderBottom: tab === t.key ? "2px solid #10b981" : "2px solid transparent",
              background: "transparent",
              color: tab === t.key ? "#10b981" : sub,
              fontSize: 10, fontWeight: tab === t.key ? 700 : 400,
              cursor: "pointer", whiteSpace: "nowrap",
            }}
          >
            {t.label}
            {counts[t.key] > 0 && (
              <span style={{
                marginLeft: 3, fontSize: 9,
                background: tab === t.key ? "#10b981" : border,
                color: tab === t.key ? "#fff" : sub,
                borderRadius: 8, padding: "1px 4px",
              }}>
                {counts[t.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "4px 6px 10px" }}>
        {loading && (
          <div style={{ fontSize: 11, color: sub, padding: "16px 8px", textAlign: "center" }}>
            Yükleniyor...
          </div>
        )}
        {!loading && error && (
          <div style={{ fontSize: 11, color: "#ef4444", padding: "10px 8px" }}>{error}</div>
        )}
        {!loading && !error && filtered.length === 0 && (
          <div style={{ fontSize: 11, color: sub, padding: "16px 8px", textAlign: "center", lineHeight: 1.6 }}>
            {query ? "Arama sonucu bulunamadı." : "Bu kategoride kaynak yok."}
          </div>
        )}
        {!loading && filtered.map(item => (
          <div
            key={`${item.sourceType}-${item.id}`}
            draggable
            onDragStart={e => {
              e.dataTransfer.setData("application/voltfox-node-type",    item.nodeType);
              e.dataTransfer.setData("application/voltfox-source-id",    item.id);
              e.dataTransfer.setData("application/voltfox-source-type",  item.sourceType);
              e.dataTransfer.setData("application/voltfox-source-name",  item.name);
              e.dataTransfer.effectAllowed = "copy";
            }}
            title={`Sürükle → Canvas'a ekle\n${item.sub}`}
            style={{
              display: "flex", alignItems: "flex-start", gap: 7,
              padding: "6px 8px", borderRadius: 6, cursor: "grab",
              marginBottom: 2, border: "1px solid transparent",
              userSelect: "none",
            }}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = border;
              e.currentTarget.style.background = "rgba(16,185,129,0.05)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = "transparent";
              e.currentTarget.style.background = "transparent";
            }}
          >
            <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>{item.icon}</span>
            <div style={{ minWidth: 0 }}>
              <div style={{
                fontSize: 11.5, color: text, fontWeight: 500,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.name}
              </div>
              <div style={{
                fontSize: 10, color: sub,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
              }}>
                {item.sub}
              </div>
            </div>
            <span style={{ marginLeft: "auto", fontSize: 10, color: sub, flexShrink: 0, paddingTop: 2 }}>⠿</span>
          </div>
        ))}
      </div>

      {/* Footer hint */}
      <div style={{
        padding: "6px 10px", borderTop: `1px solid ${border}`,
        fontSize: 10, color: sub, lineHeight: 1.5, flexShrink: 0,
      }}>
        Sürükle &amp; bırak ile canvas'a ekle.
      </div>
    </div>
  );
}
