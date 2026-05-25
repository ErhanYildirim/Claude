import { render, screen, fireEvent } from "@testing-library/react";
import { DataTable } from "../DataTable";

const columns = [
  { key: "name" as const, header: "Tesis" },
  { key: "emission" as const, header: "Emisyon" },
  { key: "status" as const, header: "Durum" },
];

const data = [
  { name: "İzmir Fabrikası", emission: "8,420 t", status: "Aktif" },
  { name: "Ankara Depo", emission: "3,240 t", status: "İncelemede" },
];

describe("DataTable", () => {
  it("renders column headers", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("Tesis")).toBeInTheDocument();
    expect(screen.getByText("Emisyon")).toBeInTheDocument();
  });

  it("renders row data", () => {
    render(<DataTable columns={columns} data={data} />);
    expect(screen.getByText("İzmir Fabrikası")).toBeInTheDocument();
    expect(screen.getByText("3,240 t")).toBeInTheDocument();
  });

  it("calls onRowClick with row data when clicked", () => {
    const onRowClick = vi.fn();
    render(<DataTable columns={columns} data={data} onRowClick={onRowClick} />);
    fireEvent.click(screen.getByText("Ankara Depo"));
    expect(onRowClick).toHaveBeenCalledWith(data[1]);
  });
});
