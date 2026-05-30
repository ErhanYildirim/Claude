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
});
