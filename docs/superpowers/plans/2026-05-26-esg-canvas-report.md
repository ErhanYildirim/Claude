# ESG Canvas Raporu Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ESG Playground canvas'larını canlı verilerle doldurup KPI kartları halinde gösteren, PDF + Excel export destekleyen `/esg-playground/:graphId/report` sayfası.

**Architecture:** Yeni `EsgCanvasReportPage.tsx` sayfası canvas'ı API'den çeker, node'ları output (KPI kartı) ve energy (canlı veri satırı) olarak parse eder, 30 saniyede bir liveData yeniler. Tüm sub-bileşenler tek dosyada, dışa aktarım yok.

**Tech Stack:** React 18, TypeScript, react-router-dom v6, xlsx (yeni frontend bağımlılık), vitest + @testing-library/react

---

## Dosya Haritası

| Dosya | İşlem | Ne Yapıyor |
|---|---|---|
| `apps/web/src/pages/EsgCanvasReportPage.tsx` | Oluştur | Ana rapor sayfası (tüm sub-bileşenlerle) |
| `apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx` | Oluştur | Sayfa testleri |
| `apps/web/src/App.tsx` | Değiştir | Yeni route + lazy import |
| `apps/web/src/components/TopBar.tsx` | Değiştir | Dynamic route breadcrumb desteği |
| `apps/web/src/pages/EsgPlaygroundPage.tsx` | Değiştir | Liste kartı + editör toolbar butonları |

---

## Task 1: xlsx Bağımlılığı + Route + Breadcrumb

**Files:**
- Modify: `apps/web/package.json` (npm install ile)
- Modify: `apps/web/src/App.tsx:14-48,170-210`
- Modify: `apps/web/src/components/TopBar.tsx:35-55`

- [ ] **Step 1: xlsx paketini yükle**

```bash
cd "C:\Users\erhan\Downloads\Claude"
npm install xlsx --workspace=apps/web
```

Beklenen çıktı: `added 1 package` (veya `up to date` eğer zaten yüklüyse)

- [ ] **Step 2: App.tsx'e lazy import ekle**

`apps/web/src/App.tsx` dosyasındaki mevcut `EsgPlaygroundPage` lazy import satırının hemen altına ekle (47. satırdan sonra):

```tsx
const EsgCanvasReportPage    = lazy(() => import("./pages/EsgCanvasReportPage.js"));
```

- [ ] **Step 3: App.tsx'e route ekle**

`apps/web/src/App.tsx`'deki şu satırları bul:

```tsx
          <Route path="/esg-playground/:graphId"                           element={<EsgPlaygroundPage />} />
```

Ve hemen altına ekle:

```tsx
          <Route path="/esg-playground/:graphId/report"                   element={<EsgCanvasReportPage />} />
```

- [ ] **Step 4: TopBar breadcrumb — dynamic route desteği**

`apps/web/src/components/TopBar.tsx` dosyasındaki `getBreadcrumb` fonksiyonunu bul (35. satır civarı). Şu kontrol bloğunu, `const entry = ROUTE_MAP[pathname];` satırından ÖNCE ekle:

```tsx
  if (pathname.match(/^\/esg-playground\/.+\/report$/)) {
    return [{ label: "Ürünler" }, { label: "ESG Playground", path: "/esg-playground" }, { label: "Canvas Raporu" }];
  }
```

- [ ] **Step 5: TypeScript kontrolü**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

Beklenen çıktı: hata yok (boş çıktı)

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/package.json apps/web/package-lock.json apps/web/src/App.tsx apps/web/src/components/TopBar.tsx
git commit -m "feat(esg-report): route + breadcrumb + xlsx bağımlılığı"
```

---

## Task 2: EsgCanvasReportPage — Veri Yükleme + Boş Durum

**Files:**
- Create: `apps/web/src/pages/EsgCanvasReportPage.tsx`
- Create: `apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx`

Bu görevde sayfanın iskeleti oluşturulur: canvas verisi çekilir, node'lar parse edilir, output node yoksa boş durum, canvas bulunamazsa yönlendirme yapılır.

- [ ] **Step 1: Test dosyası oluştur ve ilk testi yaz**

`apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx` dosyasını oluştur:

```tsx
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import EsgCanvasReportPage from "../EsgCanvasReportPage";

vi.mock("../../lib/api.js", () => ({
  api: {
    esgPlayground: {
      get: vi.fn(),
      liveData: vi.fn().mockResolvedValue({ zones: {} }),
    },
  },
}));

import { api } from "../../lib/api.js";

function renderPage(graphId = "test-id") {
  return render(
    <MemoryRouter initialEntries={[`/esg-playground/${graphId}/report`]}>
      <Routes>
        <Route path="/esg-playground/:graphId/report" element={<EsgCanvasReportPage />} />
        <Route path="/esg-playground" element={<div>Playground</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe("EsgCanvasReportPage", () => {
  beforeEach(() => vi.clearAllMocks());

  it("output node yoksa boş durum gösterir", async () => {
    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test Canvas", description: null,
      nodesJson: [{ id: "1", type: "facilityNode", data: { label: "Tesis" } }],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/rapor node'u bulunmuyor/i)).toBeInTheDocument();
    });
  });
});
```

- [ ] **Step 2: Testi çalıştır, hatalı olduğunu doğrula**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: `FAIL` — `EsgCanvasReportPage` dosyası henüz yok

- [ ] **Step 3: EsgCanvasReportPage iskeletini oluştur**

`apps/web/src/pages/EsgCanvasReportPage.tsx` dosyasını oluştur:

```tsx
import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { api } from "../lib/api.js";
import type { EsgGraph } from "../lib/api.js";

interface CanvasNode {
  id: string;
  type?: string;
  data: {
    label?: string;
    liveValue?: string;
    subLabel?: string;
    zone?: string;
    color?: string;
    sourceType?: string;
    sourceId?: string;
    [key: string]: unknown;
  };
}

const OUTPUT_NODE_TYPES = new Set([
  "emissionCalcNode", "cbamCalcNode", "cfMatchingNode", "ghgReportNode", "cbamReportNode",
]);
const ENERGY_NODE_TYPES = new Set(["gridNode", "solarNode", "windNode"]);

const OUTPUT_CONFIG: Record<string, { title: string; unit: string; color: string }> = {
  emissionCalcNode: { title: "Emisyon Hesabı",       unit: "tCO₂e", color: "#ef4444" },
  cbamCalcNode:     { title: "CBAM Karbon Maliyeti",  unit: "€",     color: "#dc2626" },
  cfMatchingNode:   { title: "CFE Eşleştirme Skoru",  unit: "%",     color: "#16a34a" },
  ghgReportNode:    { title: "GHG Toplam Emisyon",    unit: "tCO₂e", color: "#7c3aed" },
  cbamReportNode:   { title: "CBAM Teknik Dosya",     unit: "",      color: "#b91c1c" },
};

interface LiveZoneData {
  ci: number;
  rePct: number;
  updatedAt: string;
}

function parseNodes(nodesJson: unknown): { outputNodes: CanvasNode[]; energyNodes: CanvasNode[] } {
  const nodes = Array.isArray(nodesJson) ? (nodesJson as CanvasNode[]) : [];
  return {
    outputNodes: nodes.filter(n => OUTPUT_NODE_TYPES.has(n.type ?? "")),
    energyNodes: nodes.filter(n => ENERGY_NODE_TYPES.has(n.type ?? "")),
  };
}

export default function EsgCanvasReportPage() {
  const { graphId } = useParams<{ graphId: string }>();
  const navigate = useNavigate();

  const [graph, setGraph]         = useState<EsgGraph | null>(null);
  const [loading, setLoading]     = useState(true);
  const [liveZones, setLiveZones] = useState<Record<string, LiveZoneData>>({});
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const { outputNodes, energyNodes } = graph
    ? parseNodes(graph.nodesJson)
    : { outputNodes: [], energyNodes: [] };

  const fetchLive = useCallback(async (enNodes: CanvasNode[]) => {
    const zones = [...new Set(enNodes.map(n => n.data.zone).filter(Boolean) as string[])];
    if (zones.length === 0) return;
    try {
      const res = await api.esgPlayground.liveData(zones);
      setLiveZones((res as { zones: Record<string, LiveZoneData> }).zones ?? {});
      setLastUpdated(new Date());
    } catch {
      // enerji satırı gizlenir, sessiz hata
    }
  }, []);

  useEffect(() => {
    if (!graphId) return;
    setLoading(true);
    api.esgPlayground.get(graphId)
      .then(g => {
        setGraph(g);
        const { energyNodes: en } = parseNodes(g.nodesJson);
        fetchLive(en);
      })
      .catch(() => navigate("/esg-playground"))
      .finally(() => setLoading(false));
  }, [graphId, navigate, fetchLive]);

  useEffect(() => {
    if (!graph) return;
    const { energyNodes: en } = parseNodes(graph.nodesJson);
    const id = setInterval(() => fetchLive(en), 30_000);
    return () => clearInterval(id);
  }, [graph, fetchLive]);

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)" }}>
        Yükleniyor...
      </div>
    );
  }

  if (outputNodes.length === 0) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: 12, color: "var(--text-muted)" }}>
        <div style={{ fontSize: 48 }}>📊</div>
        <div style={{ fontSize: 16, fontWeight: 600, color: "var(--text-primary)" }}>Bu canvas'ta rapor node'u bulunmuyor</div>
        <div style={{ fontSize: 13 }}>Emisyon Hesabı, CBAM, CFE veya GHG rapor node'u ekleyin</div>
        <button
          onClick={() => navigate(`/esg-playground/${graphId}`)}
          style={{ marginTop: 8, padding: "8px 18px", borderRadius: 8, border: "none", background: "var(--accent)", color: "#fff", fontWeight: 600, cursor: "pointer", fontSize: 13 }}
        >
          Canvas'a Dön
        </button>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px", fontFamily: "var(--font-sans)" }}>
      <ReportHeader graph={graph!} lastUpdated={lastUpdated} onRefresh={() => fetchLive(energyNodes)} outputNodes={outputNodes} energyNodes={energyNodes} liveZones={liveZones} />
      <CanvasMeta graph={graph!} outputCount={outputNodes.length} energyCount={energyNodes.length} />
      <KpiGrid outputNodes={outputNodes} />
      {energyNodes.length > 0 && Object.keys(liveZones).length > 0 && (
        <LiveDataRow energyNodes={energyNodes} liveZones={liveZones} />
      )}
    </div>
  );
}

// ── Placeholder bileşenler — sonraki task'larda implemente edilecek ──────────
function ReportHeader(_: { graph: EsgGraph; lastUpdated: Date | null; onRefresh: () => void; outputNodes: CanvasNode[]; energyNodes: CanvasNode[]; liveZones: Record<string, LiveZoneData> }) {
  return <div data-testid="report-header" />;
}
function CanvasMeta(_: { graph: EsgGraph; outputCount: number; energyCount: number }) {
  return <div data-testid="canvas-meta" />;
}
function KpiGrid({ outputNodes }: { outputNodes: CanvasNode[] }) {
  return (
    <div data-testid="kpi-grid">
      {outputNodes.map(n => <KpiCard key={n.id} node={n} />)}
    </div>
  );
}
function KpiCard({ node }: { node: CanvasNode }) {
  const cfg = OUTPUT_CONFIG[node.type ?? ""] ?? { title: node.data.label ?? "", unit: "", color: "#64748b" };
  const displayValue = node.type === "cbamReportNode"
    ? (node.data.subLabel || null)
    : (node.data.liveValue || null);
  return (
    <div data-testid="kpi-card" style={{ marginBottom: 12 }}>
      <div>{node.data.label ?? cfg.title}</div>
      <div data-testid="kpi-value">{displayValue ?? "—"}</div>
    </div>
  );
}
function LiveDataRow(_: { energyNodes: CanvasNode[]; liveZones: Record<string, LiveZoneData> }) {
  return <div data-testid="live-data-row" />;
}
```

- [ ] **Step 4: Testi çalıştır, geçtiğini doğrula**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: `PASS` — 1 test geçer

- [ ] **Step 5: 404 yönlendirme ve 5 kart testlerini ekle**

`apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx` dosyasına `describe` bloğu içine ekle:

```tsx
  it("5 output node varsa 5 KPI kartı render eder", async () => {
    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test", description: null,
      nodesJson: [
        { id: "1", type: "emissionCalcNode", data: { label: "Emisyon", liveValue: "8.4 tCO₂e" } },
        { id: "2", type: "cbamCalcNode",     data: { label: "CBAM",    liveValue: "€4320" } },
        { id: "3", type: "cfMatchingNode",   data: { label: "CFE",     liveValue: "95%" } },
        { id: "4", type: "ghgReportNode",    data: { label: "GHG",     liveValue: "1240 tCO₂e" } },
        { id: "5", type: "cbamReportNode",   data: { label: "Teknik Dosya", subLabel: "2 ürün" } },
      ],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getAllByTestId("kpi-card")).toHaveLength(5);
    });
  });

  it("canvas bulunamazsa /esg-playground'a yönlendirir", async () => {
    vi.mocked(api.esgPlayground.get).mockRejectedValue(new Error("not found"));

    renderPage("bad-id");

    await waitFor(() => {
      expect(screen.getByText("Playground")).toBeInTheDocument();
    });
  });

  it("liveValue null ise kart değer alanında — gösterir", async () => {
    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test", description: null,
      nodesJson: [{ id: "1", type: "emissionCalcNode", data: { label: "Emisyon", liveValue: "" } }],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("kpi-value")).toHaveTextContent("—");
    });
  });
```

- [ ] **Step 6: Testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: `PASS` — 4 test geçer

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/EsgCanvasReportPage.tsx apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx
git commit -m "feat(esg-report): sayfa iskeleti — veri yükleme, boş durum, KpiCard"
```

---

## Task 3: KpiCard + KpiGrid — Tam İmplementasyon

**Files:**
- Modify: `apps/web/src/pages/EsgCanvasReportPage.tsx` (KpiCard ve KpiGrid fonksiyonlarını değiştir)

Bu görevde Task 2'deki placeholder `KpiCard` ve `KpiGrid` bileşenleri tam görsel implementasyonla değiştirilir.

- [ ] **Step 1: KpiCard fonksiyonunu değiştir**

`EsgCanvasReportPage.tsx` dosyasındaki mevcut `KpiCard` fonksiyonunu bul ve şununla değiştir:

```tsx
function KpiCard({ node }: { node: CanvasNode }) {
  const cfg = OUTPUT_CONFIG[node.type ?? ""] ?? { title: node.data.label ?? "", unit: "", color: "#64748b" };
  const displayValue = node.type === "cbamReportNode"
    ? (node.data.subLabel || null)
    : (node.data.liveValue || null);
  const hasValue = displayValue !== null && displayValue !== "";
  const link = sourceLink(node.data.sourceType, node.data.sourceId);

  return (
    <div
      data-testid="kpi-card"
      style={{
        background: "var(--bg-surface)",
        border: `1px solid ${hasValue ? "var(--border)" : "var(--border)"}`,
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{
        position: "absolute", top: 0, left: 0, right: 0, height: "3px",
        background: hasValue ? cfg.color : "var(--border)",
      }} />
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 8 }}>
        {node.data.label ?? cfg.title}
      </div>
      <div
        data-testid="kpi-value"
        style={{ fontSize: 32, fontWeight: 800, color: hasValue ? "var(--text-primary)" : "var(--text-muted)", lineHeight: 1 }}
      >
        {displayValue ?? "—"}
      </div>
      {cfg.unit && hasValue && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>{cfg.unit}</div>
      )}
      {link && (
        <a
          href={link}
          data-testid="kpi-platform-link"
          style={{ display: "block", marginTop: 12, fontSize: 11, color: "var(--accent)", textDecoration: "none" }}
        >
          → Platform sayfasına git
        </a>
      )}
    </div>
  );
}
```

- [ ] **Step 2: KpiGrid fonksiyonunu değiştir**

Mevcut `KpiGrid` placeholder'ını şununla değiştir:

```tsx
function KpiGrid({ outputNodes }: { outputNodes: CanvasNode[] }) {
  return (
    <div
      data-testid="kpi-grid"
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
        gap: 16,
        marginBottom: 20,
      }}
    >
      {outputNodes.map(n => <KpiCard key={n.id} node={n} />)}
    </div>
  );
}
```

- [ ] **Step 3: sourceLink yardımcı fonksiyonu ekle**

`OUTPUT_CONFIG` sabitinin hemen altına ekle:

```tsx
function sourceLink(sourceType?: string, sourceId?: string): string | null {
  if (!sourceType || !sourceId) return null;
  if (sourceType === "installation") return `/installations/${sourceId}`;
  if (sourceType === "cbamFacility") return `/cbam/facilities/${sourceId}`;
  return null;
}
```

- [ ] **Step 4: Platform link testini ekle**

`apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx` dosyasındaki `describe` bloğuna ekle:

```tsx
  it("sourceType=installation olan node platform linkini gösterir", async () => {
    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test", description: null,
      nodesJson: [{
        id: "1", type: "emissionCalcNode",
        data: { label: "Emisyon", liveValue: "8.4 t", sourceType: "installation", sourceId: "inst-123" },
      }],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      const link = screen.getByTestId("kpi-platform-link") as HTMLAnchorElement;
      expect(link.href).toContain("/installations/inst-123");
    });
  });
```

- [ ] **Step 5: Testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: `PASS` — 5 test geçer

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/EsgCanvasReportPage.tsx apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx
git commit -m "feat(esg-report): KpiCard tam implementasyonu — değer, birim, platform linki"
```

---

## Task 4: LiveDataRow + CanvasMeta + ReportHeader

**Files:**
- Modify: `apps/web/src/pages/EsgCanvasReportPage.tsx`

- [ ] **Step 1: LiveDataRow testini yaz**

`apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx` dosyasına ekle:

```tsx
  it("enerji node'u yoksa live-data-row render edilmez", async () => {
    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test", description: null,
      nodesJson: [{ id: "1", type: "emissionCalcNode", data: { label: "E", liveValue: "1 t" } }],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.queryByTestId("live-data-row")).not.toBeInTheDocument();
    });
  });

  it("liveData API başarısız olursa sayfa çökmez", async () => {
    vi.mocked(api.esgPlayground.liveData).mockRejectedValue(new Error("network error"));
    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test", description: null,
      nodesJson: [
        { id: "1", type: "emissionCalcNode", data: { label: "E", liveValue: "1 t" } },
        { id: "2", type: "gridNode", data: { label: "Grid", zone: "TR" } },
      ],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    renderPage();

    await waitFor(() => {
      expect(screen.getByTestId("kpi-card")).toBeInTheDocument();
    });
    expect(screen.queryByTestId("live-data-row")).not.toBeInTheDocument();
  });
```

- [ ] **Step 2: Testleri çalıştır, hatalı olduğunu doğrula**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: `FAIL` — live-data-row testi başarısız (şu an her zaman render ediyor)

- [ ] **Step 3: LiveDataRow fonksiyonunu implement et**

`EsgCanvasReportPage.tsx`'deki `LiveDataRow` placeholder'ını değiştir:

```tsx
const ENERGY_ICONS: Record<string, string> = { gridNode: "🔌", solarNode: "☀️", windNode: "💨" };
const ENERGY_LABELS: Record<string, string> = { gridNode: "CI", solarNode: "RE%", windNode: "RE%" };

function LiveDataRow({ energyNodes, liveZones }: { energyNodes: CanvasNode[]; liveZones: Record<string, LiveZoneData> }) {
  const items = energyNodes.filter(n => n.data.zone && liveZones[n.data.zone as string]);
  if (items.length === 0) return null;

  return (
    <div
      data-testid="live-data-row"
      style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 12, marginBottom: 20 }}
    >
      {items.map(n => {
        const zone = n.data.zone as string;
        const live = liveZones[zone];
        const isGrid = n.type === "gridNode";
        const value = isGrid ? `${live.ci} gCO₂/kWh` : `${live.rePct.toFixed(1)}% RE`;
        return (
          <div
            key={n.id}
            style={{
              background: "var(--bg-surface)", border: "1px solid var(--border)",
              borderRadius: "var(--radius-md)", padding: "12px 16px",
              display: "flex", alignItems: "center", gap: 12,
            }}
          >
            <span style={{ fontSize: 20 }}>{ENERGY_ICONS[n.type ?? ""] ?? "⚡"}</span>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>
                {n.data.label ?? n.type} · {ENERGY_LABELS[n.type ?? ""] ?? ""}
              </div>
              <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: CanvasMeta fonksiyonunu implement et**

`CanvasMeta` placeholder'ını değiştir:

```tsx
const CATEGORY_LABELS: Record<string, { label: string; color: string }> = {
  cfe:  { label: "24/7 CFE", color: "#16a34a" },
  cbam: { label: "CBAM",     color: "#dc2626" },
  ghg:  { label: "GHG Protocol", color: "#7c3aed" },
  org:  { label: "Organizasyon", color: "#64748b" },
};

function CanvasMeta({ graph, outputCount, energyCount }: { graph: EsgGraph; outputCount: number; energyCount: number }) {
  const cat = graph.templateCategory ? CATEGORY_LABELS[graph.templateCategory] : null;
  return (
    <div
      data-testid="canvas-meta"
      style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20, flexWrap: "wrap" }}
    >
      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
        {outputCount} çıktı node'u · {energyCount} enerji kaynağı
      </span>
      {cat && (
        <span style={{
          background: `${cat.color}22`, color: cat.color,
          border: `1px solid ${cat.color}44`, borderRadius: "var(--radius-pill)",
          fontSize: 10, fontWeight: 700, padding: "2px 8px",
        }}>
          {cat.label}
        </span>
      )}
    </div>
  );
}
```

- [ ] **Step 5: ReportHeader fonksiyonunu implement et**

`ReportHeader` placeholder'ını değiştir (import satırı `useNavigate` zaten var, buna ek olarak `useNavigate` kullanılmıyor ama `navigate` kapsamda var):

```tsx
function ReportHeader({
  graph, lastUpdated, onRefresh,
}: {
  graph: EsgGraph;
  lastUpdated: Date | null;
  onRefresh: () => void;
  outputNodes: CanvasNode[];
  energyNodes: CanvasNode[];
  liveZones: Record<string, LiveZoneData>;
}) {
  const navigate = useNavigate();
  const ago = lastUpdated
    ? Math.floor((Date.now() - lastUpdated.getTime()) / 60_000)
    : null;

  return (
    <div
      data-testid="report-header"
      style={{
        display: "flex", alignItems: "center", gap: 12,
        marginBottom: 16, flexWrap: "wrap",
      }}
    >
      <button
        onClick={() => navigate(`/esg-playground/${graph.id}`)}
        style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: 13, padding: 0 }}
      >
        ← Playground
      </button>
      <span style={{ color: "var(--border)" }}>|</span>
      <span style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>{graph.name}</span>
      <span style={{
        background: "var(--accent-bg)", color: "var(--accent)",
        border: "1px solid var(--border-accent)", borderRadius: "var(--radius-pill)",
        fontSize: 10, fontWeight: 600, padding: "2px 8px",
      }}>
        ● CANLI
      </span>
      {ago !== null && (
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Son: {ago === 0 ? "az önce" : `${ago} dk önce`}</span>
      )}
      <button
        onClick={onRefresh}
        style={{ background: "none", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", color: "var(--text-muted)", cursor: "pointer", fontSize: 11, padding: "3px 8px" }}
      >
        ↻ Yenile
      </button>
      <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
        <button
          data-testid="excel-btn"
          onClick={() => {/* Task 5'te implemente edilecek */}}
          style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)", color: "var(--text-secondary)", borderRadius: "var(--radius-md)", padding: "6px 12px", fontSize: 12, cursor: "pointer" }}
        >
          📊 Excel
        </button>
        <button
          data-testid="pdf-btn"
          onClick={() => window.print()}
          style={{ background: "var(--accent)", border: "none", color: "#fff", borderRadius: "var(--radius-md)", padding: "6px 14px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >
          📄 PDF İndir
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: `PASS` — 7 test geçer

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/EsgCanvasReportPage.tsx apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx
git commit -m "feat(esg-report): LiveDataRow, CanvasMeta, ReportHeader bileşenleri"
```

---

## Task 5: Excel Export + Print CSS

**Files:**
- Modify: `apps/web/src/pages/EsgCanvasReportPage.tsx`

- [ ] **Step 1: Excel export testini yaz**

`apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx` dosyasının başına mock ekle (diğer `vi.mock` çağrılarından sonra):

```tsx
vi.mock("xlsx", () => ({
  utils: {
    book_new:         vi.fn(() => ({})),
    aoa_to_sheet:     vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
}));
```

Sonra `describe` bloğuna test ekle:

```tsx
  it("Excel butonuna tıklanınca xlsx.writeFile çağrılır", async () => {
    const { writeFile } = await import("xlsx");

    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test Canvas", description: null,
      nodesJson: [{ id: "1", type: "emissionCalcNode", data: { label: "Emisyon", liveValue: "8 t" } }],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    const { getByTestId } = renderPage();
    await waitFor(() => screen.getByTestId("excel-btn"));
    (getByTestId("excel-btn") as HTMLButtonElement).click();
    expect(writeFile).toHaveBeenCalled();
  });

  it("PDF butonuna tıklanınca window.print çağrılır", async () => {
    const printSpy = vi.spyOn(window, "print").mockImplementation(() => {});
    vi.mocked(api.esgPlayground.get).mockResolvedValue({
      id: "test-id", name: "Test", description: null,
      nodesJson: [{ id: "1", type: "emissionCalcNode", data: { label: "E", liveValue: "1 t" } }],
      edgesJson: [], viewport: {}, createdBy: "u1", updatedBy: null,
      isTemplate: false, templateKey: null, templateCategory: null,
      tenantId: "t1", createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });

    const { getByTestId } = renderPage();
    await waitFor(() => screen.getByTestId("pdf-btn"));
    (getByTestId("pdf-btn") as HTMLButtonElement).click();
    expect(printSpy).toHaveBeenCalled();
    printSpy.mockRestore();
  });
```

- [ ] **Step 2: Testleri çalıştır, hatalı olduğunu doğrula**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: Excel testi `FAIL` (onClick henüz boş)

- [ ] **Step 3: exportExcel fonksiyonu ekle + ReportHeader'ı güncelle**

`EsgCanvasReportPage.tsx` dosyasının en üstüne import ekle:

```tsx
import * as XLSX from "xlsx";
```

`parseNodes` fonksiyonunun hemen üstüne `exportExcel` fonksiyonu ekle:

```tsx
function exportExcel(graph: EsgGraph, outputNodes: CanvasNode[], liveZones: Record<string, LiveZoneData>) {
  const wb = XLSX.utils.book_new();

  const reportRows = [
    ["Canvas", graph.name],
    ["Tarih",  new Date(graph.updatedAt).toLocaleString("tr-TR")],
    [],
    ["Node Adı", "Değer", "Birim", "Son Güncelleme"],
    ...outputNodes.map(n => {
      const cfg = OUTPUT_CONFIG[n.type ?? ""] ?? { title: n.data.label ?? "", unit: "" };
      const val = n.type === "cbamReportNode" ? (n.data.subLabel ?? "") : (n.data.liveValue ?? "");
      return [n.data.label ?? cfg.title, val, cfg.unit, new Date().toLocaleString("tr-TR")];
    }),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(reportRows), "Rapor");

  const energyRows = [
    ["Zone", "CI (gCO₂/kWh)", "RE%"],
    ...Object.entries(liveZones).map(([zone, v]) => [zone, v.ci, v.rePct]),
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(energyRows), "Enerji");

  XLSX.writeFile(wb, `${graph.name.replace(/[^a-z0-9ğüşıöçA-ZĞÜŞİÖÇ\s]/gi, "")}-rapor.xlsx`);
}
```

`ReportHeader` içindeki `excel-btn` onClick'ini güncelle. Bunun için `ReportHeader` fonksiyonuna `liveZones` ve `outputNodes` prop'larını artık kullanacağız — onClick'i şu şekilde değiştir:

```tsx
onClick={() => exportExcel(graph, outputNodes, liveZones)}
```

Tam `ReportHeader` imzası (değişen kısım sadece onClick):

```tsx
      <button
        data-testid="excel-btn"
        onClick={() => exportExcel(graph, outputNodes, liveZones)}
        ...
```

- [ ] **Step 4: Print CSS ekle**

`EsgCanvasReportPage` bileşeninin `return` bloğundaki en üst `<div>`'den önce `<style>` etiketi ekle:

```tsx
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "24px 28px", fontFamily: "var(--font-sans)" }}>
      <style media="print">{`
        [data-testid="excel-btn"], [data-testid="pdf-btn"] { display: none !important; }
        * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        [data-testid="kpi-card"] { page-break-inside: avoid; }
      `}</style>
      <ReportHeader ... />
```

- [ ] **Step 5: Testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run src/pages/__tests__/EsgCanvasReportPage.test.tsx --reporter=verbose
```

Beklenen: `PASS` — 9 test geçer

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/EsgCanvasReportPage.tsx apps/web/src/pages/__tests__/EsgCanvasReportPage.test.tsx
git commit -m "feat(esg-report): Excel + PDF export, print CSS"
```

---

## Task 6: EsgPlaygroundPage — Navigasyon Butonları

**Files:**
- Modify: `apps/web/src/pages/EsgPlaygroundPage.tsx:541-608` (liste kartı)
- Modify: `apps/web/src/pages/EsgPlaygroundPage.tsx:847-870` (editör toolbar)

- [ ] **Step 1: Liste kartına "Raporu Görüntüle" butonu ekle**

`apps/web/src/pages/EsgPlaygroundPage.tsx` dosyasında canvas kartının alt kısmını bul. Şu satırı ara:

```tsx
                <div style={{ fontSize: 11, color: sub }}>
                  {new Date(g.updatedAt).toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}
                </div>
```

Bu satırın hemen ALTINA, kapatan `</div>`'dan önce ekle:

```tsx
                <button
                  data-testid="report-btn"
                  onClick={e => { e.stopPropagation(); navigate(`/esg-playground/${g.id}/report`); }}
                  style={{
                    marginTop: 10, width: "100%",
                    padding: "5px 0", borderRadius: 6,
                    border: `1px solid ${border}`, background: "transparent",
                    color: sub, fontSize: 11, fontWeight: 600, cursor: "pointer",
                    transition: "border-color 0.12s, color 0.12s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = "#10b981"; e.currentTarget.style.color = "#10b981"; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = border; e.currentTarget.style.color = sub; }}
                >
                  📊 Raporu Görüntüle
                </button>
```

- [ ] **Step 2: Editör toolbar'a "Rapor" butonu ekle**

`EsgPlaygroundPage.tsx`'de editör toolbar'ında JSON export butonunu ara:

```tsx
          <button
            onClick={exportJson}
            title="JSON Export"
```

Bu bloktan hemen ÖNCE ekle:

```tsx
          <button
            onClick={() => graphId && navigate(`/esg-playground/${graphId}/report`)}
            title="Canvas Raporu"
            data-testid="toolbar-report-btn"
            style={{ padding: "4px 8px", borderRadius: 6, fontSize: 13, border: `1px solid ${border}`, background: card, color: text, cursor: "pointer" }}
          >
            📊
          </button>
```

- [ ] **Step 3: TypeScript kontrolü**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx tsc --noEmit
```

Beklenen: hata yok

- [ ] **Step 4: Tüm testleri çalıştır**

```bash
cd "C:\Users\erhan\Downloads\Claude\apps\web"
npx vitest run --reporter=verbose
```

Beklenen: tüm testler `PASS`

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\erhan\Downloads\Claude"
git add apps/web/src/pages/EsgPlaygroundPage.tsx
git commit -m "feat(esg-report): playground liste kartı + editör toolbar navigasyon butonları"
```

---

## Self-Review Notları

**Spec coverage:**
- ✅ `/esg-playground/:graphId/report` route (Task 1)
- ✅ 5 output node → KPI kart (Task 2–3)
- ✅ Enerji canlı veri satırı (Task 4)
- ✅ PDF export (Task 4)
- ✅ Excel export (Task 5)
- ✅ Playground listesinden navigasyon (Task 6)
- ✅ Editör toolbar'dan navigasyon (Task 6)
- ✅ Breadcrumb dynamic route (Task 1)
- ✅ 404 → yönlendirme (Task 2)
- ✅ liveData API fail → sayfa çökmez (Task 4)

**Tip tutarlılığı:**
- `CanvasNode` interface Task 2'de tanımlanır, tüm görevlerde aynı şekilde kullanılır
- `LiveZoneData` interface Task 2'de tanımlanır, `exportExcel` de aynı tipi kullanır
- `OUTPUT_CONFIG` Task 2'de tanımlanır, `exportExcel` de aynı map'i kullanır
- `sourceLink` fonksiyonu Task 3'te tanımlanır, `KpiCard` kullanır
