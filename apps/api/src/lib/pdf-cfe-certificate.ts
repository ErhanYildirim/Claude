import PDFDocument from "pdfkit";
import type { Readable } from "stream";

export interface CfeCertData {
  facility: {
    name: string;
    operator: string;
    country: string;
    installationRef: string | null;
  };
  period: {
    name: string;
    startDate: Date;
    endDate: Date;
    reportYear: number;
  };
  result: {
    cfeScore: number;
    totalConsumptionKwh: number;
    totalProductionKwh: number;
    totalMatchedKwh: number;
    matchedHours: number;
    partialHours: number;
    unmatchedHours: number;
    gecDataVersion: string;
    calculatedAt: Date;
    monthlyBreakdown: Array<{
      month: string;
      consumptionKwh: number;
      productionKwh: number;
      matchedKwh: number;
      cfeRate: number;
    }>;
  };
  eacReference?: string | null;
}

const BRAND = "#00b87a";
const DARK  = "#0a1f1a";
const MUTED = "#5c7a72";
const LINE  = "#d4ece4";
const GREEN = "#059669";
const WARN  = "#D97706";
const RED   = "#DC2626";

function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function fmt2(n: number) { return n.toFixed(2); }
function fmtMwh(kwh: number) { return (kwh / 1000).toFixed(1) + " MWh"; }
function scoreColor(s: number) { return s >= 70 ? GREEN : s >= 40 ? WARN : RED; }

export function buildCfeCertificate(data: CfeCertData): Readable {
  const doc = new PDFDocument({
    size:    "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title:   `CFE Certificate — ${data.facility.name}`,
      Author:  "Voltfox Platform",
      Subject: "24/7 Carbon-Free Energy Certificate",
      Keywords: "CFE, GHG Protocol, Scope2, hourly matching",
    },
  });

  const W = doc.page.width - 100;

  // ── Header bar ─────────────────────────────────────────────────────────────
  doc.rect(0, 0, doc.page.width, 8).fill(BRAND);

  doc.fillColor(BRAND).fontSize(22).font("Helvetica-Bold")
     .text("Voltfox", 50, 28);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
     .text("GreenLink Platform  ·  24/7 CFE Certificate", 50, 54);
  doc.fillColor(DARK).fontSize(16).font("Helvetica-Bold")
     .text("24/7 Carbon-Free Energy Certificate", 50, 80);
  doc.fillColor(MUTED).fontSize(9).font("Helvetica")
     .text(`Issued: ${fmtDate(new Date())}  ·  Data version: ${data.result.gecDataVersion}`, 50, 100);

  doc.moveTo(50, 118).lineTo(50 + W, 118).strokeColor(LINE).lineWidth(1).stroke();

  // ── Big CFE Score ──────────────────────────────────────────────────────────
  const scoreStr = data.result.cfeScore.toFixed(1) + "%";
  const color    = scoreColor(data.result.cfeScore);
  const label    = data.result.cfeScore >= 70 ? "EXCELLENT" : data.result.cfeScore >= 40 ? "MODERATE" : "LOW";

  doc.rect(50, 132, W, 64).fill("#f4fbf8");
  doc.fillColor(color).fontSize(36).font("Helvetica-Bold")
     .text(scoreStr, 50, 144, { width: W, align: "center" });
  doc.fillColor(MUTED).fontSize(10).font("Helvetica")
     .text(`CFE Score  ·  ${label}  ·  Hourly Matching`, 50, 184, { width: W, align: "center" });

  let y = 210;

  function section(title: string) {
    y += 10;
    doc.rect(50, y, W, 20).fill("#f0faf5");
    doc.fillColor(BRAND).fontSize(9).font("Helvetica-Bold")
       .text(title.toUpperCase(), 55, y + 6);
    y += 26;
  }

  function row(label: string, value: string, valueColor?: string) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica")
       .text(label, 55, y, { width: 200 });
    doc.fillColor(valueColor ?? DARK).fontSize(9).font("Helvetica-Bold")
       .text(value, 265, y, { width: 260 });
    y += 14;
  }

  function divider() {
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor(LINE).lineWidth(0.4).stroke();
    y += 5;
  }

  // ── 1. Facility ────────────────────────────────────────────────────────────
  section("1 · Facility");
  row("Facility name",     data.facility.name);
  row("Operator",          data.facility.operator);
  row("Country",           data.facility.country);
  if (data.facility.installationRef) row("Installation ref", data.facility.installationRef);
  if (data.eacReference)             row("EAC / I-REC ref",  data.eacReference, BRAND);

  // ── 2. Period ──────────────────────────────────────────────────────────────
  section("2 · Reporting Period");
  row("Period",      data.period.name);
  row("Start – End", `${fmtDate(data.period.startDate)}  →  ${fmtDate(data.period.endDate)}`);
  row("Report year", String(data.period.reportYear));

  // ── 3. CFE Summary ─────────────────────────────────────────────────────────
  section("3 · CFE Matching Summary");
  row("Total electricity consumed",  fmtMwh(data.result.totalConsumptionKwh));
  row("Carbon-free energy matched",  fmtMwh(data.result.totalMatchedKwh), GREEN);
  row("Renewable production (PPA)",  fmtMwh(data.result.totalProductionKwh));
  divider();
  row("Fully matched hours",         `${data.result.matchedHours} h`, GREEN);
  row("Partially matched hours",     `${data.result.partialHours} h`, WARN);
  row("Unmatched hours",             `${data.result.unmatchedHours} h`, RED);

  // ── 4. Monthly Breakdown table ─────────────────────────────────────────────
  if (data.result.monthlyBreakdown.length > 0) {
    section("4 · Monthly Breakdown");

    // Table header
    const cols = { month: 55, cons: 155, matched: 255, rate: 355 };
    doc.fillColor(MUTED).fontSize(7.5).font("Helvetica-Bold")
       .text("Month",          cols.month,   y)
       .text("Consumption",    cols.cons,    y)
       .text("Matched CFE",    cols.matched, y)
       .text("CFE Rate",       cols.rate,    y);
    y += 12;
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor(LINE).lineWidth(0.4).stroke();
    y += 4;

    for (const m of data.result.monthlyBreakdown) {
      const mLabel = m.month.slice(0, 7);
      const rate   = m.cfeRate;
      const rc     = scoreColor(rate);

      doc.fillColor(DARK).fontSize(8).font("Helvetica")
         .text(mLabel,              cols.month,   y)
         .text(fmtMwh(m.consumptionKwh), cols.cons, y)
         .text(fmtMwh(m.matchedKwh),     cols.matched, y);
      doc.fillColor(rc).fontSize(8).font("Helvetica-Bold")
         .text(`${rate.toFixed(1)}%`,    cols.rate,    y);
      y += 12;

      if (y > doc.page.height - 100) {
        doc.addPage();
        y = 60;
      }
    }
  }

  // ── 5. Methodology ────────────────────────────────────────────────────────
  y += 6;
  section("5 · Methodology & Data Lineage");
  row("Standard",          "GHG Protocol Scope 2 Guidance — Market-based (hourly)");
  row("Matching method",   "24/7 CFE — min(consumption, renewable_production) per hour");
  row("Data version",      data.result.gecDataVersion);
  row("Calculated at",     fmtDate(data.result.calculatedAt));

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageBottom = doc.page.height - 40;
  doc.moveTo(50, pageBottom - 14).lineTo(50 + W, pageBottom - 14)
     .strokeColor(LINE).lineWidth(0.5).stroke();
  doc.fillColor(MUTED).fontSize(7.5).font("Helvetica")
     .text(
       "Generated by Voltfox GreenLink Platform  ·  voltfox.io  ·  " +
       "This certificate is based on verified hourly consumption and renewable production data.",
       50, pageBottom - 10, { width: W, align: "center" }
     );
  doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(BRAND);

  doc.end();
  return doc as unknown as Readable;
}
