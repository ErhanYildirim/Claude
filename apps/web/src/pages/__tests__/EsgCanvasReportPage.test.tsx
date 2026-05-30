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

vi.mock("xlsx", () => ({
  utils: {
    book_new:         vi.fn(() => ({})),
    aoa_to_sheet:     vi.fn(() => ({})),
    book_append_sheet: vi.fn(),
  },
  writeFile: vi.fn(),
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
});
