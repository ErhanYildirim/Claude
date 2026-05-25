import { render, screen } from "@testing-library/react";
import { StatCard } from "../StatCard";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="CFE Skoru" value="87.3" unit="%" />);
    expect(screen.getByText("CFE Skoru")).toBeInTheDocument();
    expect(screen.getByText("87.3")).toBeInTheDocument();
    expect(screen.getByText("%")).toBeInTheDocument();
  });

  it("renders delta with up direction", () => {
    render(
      <StatCard label="Emisyon" value="24,831" unit="tCO₂e"
        delta={{ value: -12.4, direction: "down", label: "önceki çeyrek" }}
      />
    );
    expect(screen.getByText(/12.4/)).toBeInTheDocument();
  });

  it("renders progress bar when progress provided", () => {
    const { container } = render(
      <StatCard label="Hedef" value="74" unit="%"
        progress={{ value: 74 }}
      />
    );
    expect(container.querySelector("[data-progress]")).toBeInTheDocument();
  });
});
