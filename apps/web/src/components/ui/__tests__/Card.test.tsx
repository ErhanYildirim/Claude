import { render, screen } from "@testing-library/react";
import { Card } from "../Card";

describe("Card", () => {
  it("renders children", () => {
    render(<Card>İçerik</Card>);
    expect(screen.getByText("İçerik")).toBeInTheDocument();
  });

  it("applies variant attribute", () => {
    const { container } = render(<Card variant="accent">İçerik</Card>);
    expect(container.firstChild).toHaveAttribute("data-variant", "accent");
  });

  it("passes className", () => {
    const { container } = render(<Card className="custom">İçerik</Card>);
    expect(container.firstChild).toHaveClass("custom");
  });
});
