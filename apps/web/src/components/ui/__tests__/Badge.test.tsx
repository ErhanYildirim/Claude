import { render, screen } from "@testing-library/react";
import { Badge } from "../Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Aktif</Badge>);
    expect(screen.getByText("Aktif")).toBeInTheDocument();
  });

  it("applies variant attribute", () => {
    const { container } = render(<Badge variant="success">OK</Badge>);
    expect(container.firstChild).toHaveAttribute("data-variant", "success");
  });

  it("defaults to neutral variant", () => {
    const { container } = render(<Badge>Taslak</Badge>);
    expect(container.firstChild).toHaveAttribute("data-variant", "neutral");
  });
});
