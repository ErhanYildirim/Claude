export const CHART_COLORS = {
  primary: "#00b87a", green: "#059669", red: "#DC2626",
  orange: "#D97706", purple: "#7C3AED", teal: "#0D9488",
  gray: "#5c7a72",
};

export const SECTOR_COLORS: Record<string, string> = {
  steel: "#6366F1", aluminium: "#0D9488", cement: "#D97706",
  fertilizer: "#059669", electricity: "#00b87a",
  hydrogen: "#2563EB", chemicals: "#9333EA",
};

export const SECTOR_LABELS: Record<string, string> = {
  steel: "Çelik", aluminium: "Alüminyum", cement: "Çimento",
  fertilizer: "Gübre", electricity: "Elektrik",
  hydrogen: "Hidrojen", chemicals: "Kimyasallar",
};

export function fmt(n: number, decimals = 2) {
  return n.toLocaleString("tr-TR", { maximumFractionDigits: decimals });
}
export function fmtTco2(n: number) { return `${fmt(n, 2)} tCO₂`; }
export function fmtSee(n: number)  { return `${fmt(n, 4)} tCO₂e/t`; }
export function fmtEur(n: number)  { return `€${fmt(n, 0)}`; }
export function fmtPct(n: number)  { return `%${fmt(n, 1)}`; }
