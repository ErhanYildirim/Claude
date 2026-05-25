import { render, screen } from "@testing-library/react";
import { Input } from "../Input";

describe("Input", () => {
  it("renders with placeholder", () => {
    render(<Input placeholder="Ara..." />);
    expect(screen.getByPlaceholderText("Ara...")).toBeInTheDocument();
  });

  it("renders label when provided", () => {
    render(<Input label="Tesis Adı" />);
    expect(screen.getByText("Tesis Adı")).toBeInTheDocument();
  });

  it("renders error message when provided", () => {
    render(<Input error="Bu alan zorunludur" />);
    expect(screen.getByText("Bu alan zorunludur")).toBeInTheDocument();
  });

  it("passes id from label to input", () => {
    render(<Input label="Email" id="email-input" />);
    const label = screen.getByText("Email");
    expect(label).toHaveAttribute("for", "email-input");
  });
});
