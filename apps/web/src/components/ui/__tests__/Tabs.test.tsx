import { render, screen, fireEvent } from "@testing-library/react";
import { Tabs } from "../Tabs";

const items = [
  { key: "overview", label: "Genel Bakış" },
  { key: "emissions", label: "Emisyonlar" },
  { key: "facilities", label: "Tesisler" },
];

describe("Tabs", () => {
  it("renders all tab labels", () => {
    render(<Tabs items={items} activeKey="overview" onChange={() => {}} />);
    expect(screen.getByText("Genel Bakış")).toBeInTheDocument();
    expect(screen.getByText("Emisyonlar")).toBeInTheDocument();
    expect(screen.getByText("Tesisler")).toBeInTheDocument();
  });

  it("calls onChange with correct key on click", () => {
    const onChange = vi.fn();
    render(<Tabs items={items} activeKey="overview" onChange={onChange} />);
    fireEvent.click(screen.getByText("Emisyonlar"));
    expect(onChange).toHaveBeenCalledWith("emissions");
  });

  it("marks active tab with data-active attribute", () => {
    render(<Tabs items={items} activeKey="facilities" onChange={() => {}} />);
    const activeTab = screen.getByText("Tesisler").closest("[data-tab]");
    expect(activeTab).toHaveAttribute("data-active", "true");
  });
});
