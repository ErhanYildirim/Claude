import { render, screen, fireEvent } from "@testing-library/react";
import { Button } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Kaydet</Button>);
    expect(screen.getByText("Kaydet")).toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Tıkla</Button>);
    fireEvent.click(screen.getByText("Tıkla"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", () => {
    const onClick = vi.fn();
    render(<Button disabled onClick={onClick}>Tıkla</Button>);
    fireEvent.click(screen.getByText("Tıkla"));
    expect(onClick).not.toHaveBeenCalled();
  });

  it("applies variant class", () => {
    const { container } = render(<Button variant="danger">Sil</Button>);
    expect(container.firstChild).toHaveAttribute("data-variant", "danger");
  });
});
