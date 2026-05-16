import PDFDocument from "pdfkit";
import type { Readable } from "stream";

// ── Types ────────────────────────────────────────────────────────────────────

export interface ReportData {
  installation: {
    facilityName: string;
    operator: string;
    facilityCountry: string;
    facilityRef: string | null;
    sector?: string;
  };
  period: {
    periodName: string;
    startDate: Date;
    endDate: Date;
    reportYear: number;
    importCountry: string;
    cnCode: string;
    prodVolumeTonne: number;
    scope1DirectTco2: number;
    scope1Quality: string;
    scope1AuditNote: string | null;
    electricityKwh: number;
    electricitySource: string;
    baselineEf: number;
    renewableEf: number;
    matchingRatePct: number;
    carbonPriceEur: number | null;
  };
  result: {
    scope2BaselineTco2: number;
    scope2VoltfoxTco2: number;
    reductionTco2: number;
    reductionPct: number;
    seeBaseline: number;
    seeVoltfox: number;
    defaultSee: number | null;
    savingsVsDefaultEur: number | null;
    calcEngineVersion: string;
    calcMethodology: string;
    efDataVersion: string;
    calculatedAt: Date;
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

const BRAND   = "#0066CC";
const DARK    = "#111827";
const MUTED   = "#6B7280";
const LINE    = "#E5E7EB";
const GREEN   = "#059669";
const WARN    = "#D97706";

function fmt2(n: number)  { return n.toFixed(2); }
function fmt4(n: number)  { return n.toFixed(4); }
function fmtEur(n: number){ return "€" + n.toLocaleString("en-GB", { maximumFractionDigits: 0 }); }
function fmtDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" });
}

// ── Builder ──────────────────────────────────────────────────────────────────

export function buildPdfReport(data: ReportData): Readable {
  const doc = new PDFDocument({
    size:    "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title:   `CBAM Technical File — ${data.installation.facilityName}`,
      Author:  "Voltfox Platform",
      Subject: "CBAM Embedded Emissions Technical Document",
      Keywords: "CBAM, Scope2, SEE, EU2023/1773",
    },
  });

  const W = doc.page.width - 100; // usable width

  // ── Cover / Header ─────────────────────────────────────────────────────────
  doc
    .rect(0, 0, doc.page.width, 8).fill(BRAND)
    .fillColor(BRAND).fontSize(22).font("Helvetica-Bold")
    .text("Voltfox", 50, 28)
    .fillColor(MUTED).fontSize(9).font("Helvetica")
    .text("GreenLink Platform  ·  CBAM Technical Document", 50, 54)
    .fillColor(DARK).fontSize(16).font("Helvetica-Bold")
    .text("Embedded Emissions Technical File", 50, 80)
    .fillColor(MUTED).fontSize(9).font("Helvetica")
    .text(`Prepared: ${fmtDate(new Date())}  ·  Calc engine v${data.result.calcEngineVersion}  ·  EF data: ${data.result.efDataVersion}`, 50, 100);

  doc.moveTo(50, 118).lineTo(50 + W, 118).strokeColor(LINE).lineWidth(1).stroke();

  let y = 128;

  // ── Section helper ─────────────────────────────────────────────────────────
  function section(title: string) {
    y += 14;
    doc.rect(50, y, W, 20).fill("#F3F4F6");
    doc.fillColor(BRAND).fontSize(9).font("Helvetica-Bold")
       .text(title.toUpperCase(), 55, y + 6);
    y += 26;
  }

  function row(label: string, value: string, note?: string) {
    doc.fillColor(MUTED).fontSize(8).font("Helvetica")
       .text(label, 55, y, { width: 200 });
    doc.fillColor(DARK).fontSize(9).font("Helvetica-Bold")
       .text(value, 265, y, { width: 260 });
    if (note) {
      doc.fillColor(MUTED).fontSize(7.5).font("Helvetica")
         .text(note, 265, y + 11, { width: 260 });
      y += 22;
    } else {
      y += 14;
    }
  }

  function divider() {
    doc.moveTo(50, y).lineTo(50 + W, y).strokeColor(LINE).lineWidth(0.5).stroke();
    y += 6;
  }

  // ── 1. Tesis ───────────────────────────────────────────────────────────────
  section("1 · Facility & Operator");
  row("Facility name",    data.installation.facilityName);
  row("Operator",         data.installation.operator);
  row("Country",          data.installation.facilityCountry);
  if (data.installation.sector)
    row("CBAM sector",    data.installation.sector.charAt(0).toUpperCase() + data.installation.sector.slice(1));
  if (data.installation.facilityRef)
    row("Installation ref", data.installation.facilityRef);

  // ── 2. Üretim Dönemi ───────────────────────────────────────────────────────
  section("2 · Reporting Period");
  row("Period",           data.period.periodName);
  row("Start – End",      `${fmtDate(data.period.startDate)}  →  ${fmtDate(data.period.endDate)}`);
  row("Report year",      String(data.period.reportYear));
  row("CN code",          data.period.cnCode);
  row("Import country",   data.period.importCountry);
  row("Production volume",`${data.period.prodVolumeTonne.toLocaleString("en")} tonnes`);

  // ── 3. Scope 1 ─────────────────────────────────────────────────────────────
  section("3 · Scope 1 — Direct Emissions (Customer-provided)");
  row("Direct emissions",
    `${fmt2(data.period.scope1DirectTco2)} tCO₂`,
    `Data quality: ${data.period.scope1Quality}`);
  if (data.period.scope1AuditNote)
    row("Source note", data.period.scope1AuditNote);

  // ── 4. Scope 2 ─────────────────────────────────────────────────────────────
  section("4 · Scope 2 — Electricity Indirect Emissions (Voltfox)");
  row("Electricity consumed",      `${(data.period.electricityKwh / 1000).toLocaleString("en")} MWh`,
    `Source: ${data.period.electricitySource}`);
  row("Grid baseline EF",          `${data.period.baselineEf} tCO₂/MWh`);
  row("24/7 CFE matching rate",    `${data.period.matchingRatePct}%`,
    `Renewable EF: ${data.period.renewableEf} tCO₂/MWh`);
  divider();
  row("Baseline Scope 2 (0% CFE)", `${fmt2(data.result.scope2BaselineTco2)} tCO₂`);
  row("Voltfox Scope 2 (with CFE)",`${fmt2(data.result.scope2VoltfoxTco2)} tCO₂`);

  const reductionColor = data.result.reductionPct > 0 ? GREEN : WARN;
  doc.fillColor(MUTED).fontSize(8).font("Helvetica")
     .text("Reduction", 55, y, { width: 200 });
  doc.fillColor(reductionColor).fontSize(9).font("Helvetica-Bold")
     .text(`${fmt2(data.result.reductionTco2)} tCO₂  (${fmt2(data.result.reductionPct)}%)`, 265, y);
  y += 14;

  // ── 5. SEE Sonuçları ───────────────────────────────────────────────────────
  section("5 · Specific Embedded Emission (SEE) — EU 2023/1773 Annex IV Method A");

  doc.fillColor(MUTED).fontSize(8).font("Helvetica")
     .text("SEE Baseline  (without 24/7 CFE)", 55, y, { width: 200 });
  doc.fillColor(DARK).fontSize(11).font("Helvetica-Bold")
     .text(`${fmt4(data.result.seeBaseline)} tCO₂e/t`, 265, y);
  y += 16;

  doc.fillColor(MUTED).fontSize(8).font("Helvetica")
     .text("SEE Voltfox  (with 24/7 CFE matching)", 55, y, { width: 200 });
  doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold")
     .text(`${fmt4(data.result.seeVoltfox)} tCO₂e/t`, 265, y);
  y += 18;

  const seeDiff = data.result.seeBaseline - data.result.seeVoltfox;
  const seeDiffPct = (seeDiff / data.result.seeBaseline) * 100;
  row("SEE reduction via Voltfox",
    `${fmt4(seeDiff)} tCO₂e/t  (${fmt2(seeDiffPct)}%)`);

  // ── 6. CBAM Karşılaştırması ────────────────────────────────────────────────
  if (data.result.defaultSee !== null) {
    section("6 · CBAM Default Value Comparison (Annex IV)");
    row("AB default SEE",    `${fmt4(data.result.defaultSee)} tCO₂e/t`,
      "Source: EU Commission CBAM Implementing Regulation Annex IV");
    row("Actual SEE (Voltfox)", `${fmt4(data.result.seeVoltfox)} tCO₂e/t`);

    const vsDefault = data.result.defaultSee - data.result.seeVoltfox;
    const vsDefaultPct = (vsDefault / data.result.defaultSee) * 100;
    doc.fillColor(MUTED).fontSize(8).font("Helvetica")
       .text("Improvement vs default", 55, y, { width: 200 });
    doc.fillColor(vsDefault > 0 ? GREEN : WARN).fontSize(9).font("Helvetica-Bold")
       .text(`${fmt4(vsDefault)} tCO₂e/t  (${fmt2(vsDefaultPct)}% lower)`, 265, y);
    y += 16;

    if (data.result.savingsVsDefaultEur !== null && data.period.carbonPriceEur) {
      row("EU ETS price used",    `€${data.period.carbonPriceEur}/tCO₂`);
      doc.fillColor(MUTED).fontSize(8).font("Helvetica")
         .text("Annual CBAM savings potential", 55, y, { width: 200 });
      doc.fillColor(GREEN).fontSize(11).font("Helvetica-Bold")
         .text(fmtEur(data.result.savingsVsDefaultEur) + " / year", 265, y);
      y += 18;
    }
  }

  // ── 7. Metodoloji ──────────────────────────────────────────────────────────
  section("7 · Methodology & Data Lineage");
  row("Calculation standard",  "EU Regulation 2023/1773, Annex IV, Method A");
  row("Scope 2 methodology",   "Location-based with 24/7 CFE matching (hourly granularity)");
  row("Baseline EF source",    "Country annual average grid emission factor");
  row("Calc engine version",   data.result.calcEngineVersion);
  row("EF data version",       data.result.efDataVersion);
  row("Calculated at",         fmtDate(data.result.calculatedAt));

  // ── Footer ─────────────────────────────────────────────────────────────────
  const pageBottom = doc.page.height - 40;
  doc.moveTo(50, pageBottom - 14).lineTo(50 + W, pageBottom - 14)
     .strokeColor(LINE).lineWidth(0.5).stroke();
  doc.fillColor(MUTED).fontSize(7.5).font("Helvetica")
     .text(
       "Generated by Voltfox GreenLink Platform  ·  voltfox.io  ·  " +
       "This document is produced using verified hourly consumption and emission factor data. " +
       "For audit purposes, methodology version and data lineage are recorded.",
       50, pageBottom - 10, { width: W, align: "center" }
     );

  // bottom accent
  doc.rect(0, doc.page.height - 6, doc.page.width, 6).fill(BRAND);

  doc.end();
  return doc as unknown as Readable;
}
