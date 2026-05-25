import PDFDocument from "pdfkit";
import type { Readable } from "stream";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface FuelRow     { fuelType: string; quantityGJ: number; efTco2PerGj: number }
export interface ProcessRow  { material: string; quantityTonne: number; stoichFactor: number }

export interface WizardPdfData {
  sector:     string;
  cnCode:     string;
  country:    string;
  periodName: string;
  prodVolume: number;
  fuels:      FuelRow[];
  processes:  ProcessRow[];
  elecKwh:    number;
  elecEf:     number;
  gecConnected: boolean;

  // Hesaplanan değerler
  scope1FuelTco2:  number;
  scope1ProcTco2:  number;
  scope1TotalTco2: number;
  scope2Tco2:      number;
  totalTco2:       number;
  seeActual:       number;
  seeDefault:      number | null;
  savingsPerTonne: number | null;
  savingsTco2:     number | null;
  savingsEur:      number | null;
  carbonPrice:     number;

  generatedAt: Date;
}

// ── Stil sabitleri ─────────────────────────────────────────────────────────────

const BRAND  = "#00b87a";
const DARK   = "#0a1f1a";
const MUTED  = "#5c7a72";
const LINE   = "#d4ece4";
const RED    = "#dc2626";
const GREEN  = "#16a34a";

const FUEL_LABELS: Record<string, string> = {
  naturalGas: "Doğalgaz",
  fuelOil:    "Fuel Oil",
  coal:       "Kömür (Taş)",
  other:      "Diğer",
};

const MATERIAL_LABELS: Record<string, string> = {
  CaCO3:    "Kireçtaşı (CaCO₃)",
  dolomite: "Dolomit",
  iron_ore: "Demir Cevheri",
  other:    "Diğer",
};

const SECTOR_LABELS: Record<string, string> = {
  steel:      "Çelik",
  aluminium:  "Alüminyum",
  cement:     "Çimento",
  fertiliser: "Gübre",
};

function fmt2(n: number) { return n.toFixed(2); }
function fmt4(n: number) { return n.toFixed(4); }

// ── Builder ───────────────────────────────────────────────────────────────────

export function buildWizardPdf(d: WizardPdfData): Readable {
  const doc = new PDFDocument({
    size:    "A4",
    margins: { top: 50, bottom: 50, left: 50, right: 50 },
    info: {
      Title:   `CBAM Teknik Dosya — ${d.periodName} — ${d.cnCode}`,
      Author:  "Voltfox Platform",
      Subject: "CBAM Actual Emissions Technical Document (EU 2023/1773 Annex IV Method A)",
      Keywords: "CBAM, Scope1, Scope2, SEE, EU 2023/1773",
    },
  });

  const W = doc.page.width - 100;

  // ── Başlık ─────────────────────────────────────────────────────────────────
  doc.rect(50, 50, W, 70).fill(BRAND);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(16)
     .text("CBAM Teknik Emisyon Dosyası", 66, 62);
  doc.font("Helvetica").fontSize(10)
     .text("EU 2023/1773 Uygulama Tüzüğü — Ek-IV, Yöntem A (Hesaplama Bazlı)", 66, 84);
  doc.text(`Oluşturma: ${d.generatedAt.toLocaleString("tr-TR")}   |   Voltfox Platform`, 66, 100);

  doc.fillColor(DARK);

  let y = 140;

  // ── Yardımcı fonksiyonlar ──────────────────────────────────────────────────
  function section(title: string) {
    if (y > 700) { doc.addPage(); y = 60; }
    doc.rect(50, y, W, 22).fill("#e6f9f2");
    doc.fillColor(BRAND).font("Helvetica-Bold").fontSize(10)
       .text(title.toUpperCase(), 58, y + 6);
    doc.fillColor(DARK);
    y += 30;
  }

  function row2(label: string, value: string, valueColor?: string) {
    if (y > 720) { doc.addPage(); y = 60; }
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(label, 60, y, { width: 220 });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(valueColor ?? DARK)
       .text(value, 290, y, { width: 260 });
    doc.moveTo(50, y + 14).lineTo(50 + W, y + 14).lineWidth(0.4).strokeColor(LINE).stroke();
    y += 18;
  }

  function tableHeader(cols: string[], widths: number[]) {
    let x = 60;
    doc.rect(50, y, W, 18).fill("#f4fbf8");
    cols.forEach((col, i) => {
      doc.fillColor(MUTED).font("Helvetica-Bold").fontSize(8).text(col, x, y + 5, { width: widths[i] });
      x += widths[i];
    });
    y += 22;
  }

  function tableRow(cells: string[], widths: number[], highlight?: boolean) {
    if (y > 720) { doc.addPage(); y = 60; }
    if (highlight) doc.rect(50, y, W, 16).fill("#e6f9f2");
    let x = 60;
    cells.forEach((cell, i) => {
      doc.fillColor(DARK).font("Helvetica").fontSize(8).text(cell, x, y + 4, { width: widths[i] });
      x += widths[i];
    });
    doc.moveTo(50, y + 16).lineTo(50 + W, y + 16).lineWidth(0.3).strokeColor(LINE).stroke();
    y += 20;
  }

  // ── 1. Tesis ve Dönem ──────────────────────────────────────────────────────
  section("1. TESİS VE DÖNEM BİLGİSİ");
  row2("Sektör",                SECTOR_LABELS[d.sector] ?? d.sector);
  row2("CN Kodu",               d.cnCode);
  row2("Menşe Ülke",            d.country);
  row2("Raporlama Dönemi",      d.periodName);
  row2("Üretim Hacmi",          `${d.prodVolume.toLocaleString("tr-TR")} tonne`);
  y += 8;

  // ── 2. Scope 1 — Yakıt Emisyonları ────────────────────────────────────────
  section("2. SCOPE 1 — YAKIT YANMA EMİSYONLARI");
  if (d.fuels.length > 0) {
    tableHeader(["Yakıt Türü", "Miktar (GJ)", "EF (tCO₂/GJ)", "Emisyon (tCO₂)"], [140, 100, 110, 120]);
    d.fuels.forEach(f => {
      const emission = f.quantityGJ * f.efTco2PerGj;
      tableRow([
        FUEL_LABELS[f.fuelType] ?? f.fuelType,
        f.quantityGJ.toLocaleString("tr-TR"),
        fmt4(f.efTco2PerGj),
        fmt2(emission),
      ], [140, 100, 110, 120]);
    });
    row2("Yakıt Yanma Toplamı", `${fmt2(d.scope1FuelTco2)} tCO₂eq`, d.scope1FuelTco2 > 0 ? DARK : MUTED);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Yakıt girişi yok", 60, y); y += 16;
  }
  y += 8;

  // ── 3. Scope 1 — Proses Emisyonları ───────────────────────────────────────
  section("3. SCOPE 1 — PROSES EMİSYONLARI (STOİKİOMETRİK)");
  if (d.processes.length > 0) {
    tableHeader(["Hammadde", "Miktar (tonne)", "Stoikiometrik Faktör", "Emisyon (tCO₂)"], [150, 100, 150, 100]);
    d.processes.forEach(p => {
      const emission = p.quantityTonne * p.stoichFactor;
      tableRow([
        MATERIAL_LABELS[p.material] ?? p.material,
        p.quantityTonne.toLocaleString("tr-TR"),
        fmt4(p.stoichFactor),
        fmt2(emission),
      ], [150, 100, 150, 100]);
    });
    row2("Proses Emisyon Toplamı", `${fmt2(d.scope1ProcTco2)} tCO₂eq`, d.scope1ProcTco2 > 0 ? DARK : MUTED);
  } else {
    doc.font("Helvetica").fontSize(9).fillColor(MUTED).text("Proses emisyon girişi yok", 60, y); y += 16;
  }
  y += 8;

  // ── 4. Scope 2 — Dolaylı Elektrik Emisyonları ─────────────────────────────
  section("4. SCOPE 2 — DOLAYLI ELEKTRİK EMİSYONLARI");
  row2("Elektrik Tüketimi",     `${d.elecKwh.toLocaleString("tr-TR")} kWh`);
  row2("Emisyon Faktörü",       `${fmt4(d.elecEf)} tCO₂/MWh`);
  row2("GEC / Voltfox Bağlı",  d.gecConnected ? "Evet — Granüler EF kullanıldı" : "Hayır — Baseline EF kullanıldı",
                                d.gecConnected ? GREEN : MUTED);
  row2("Scope 2 Emisyon",       `${fmt2(d.scope2Tco2)} tCO₂eq`);
  y += 8;

  // ── 5. Özet Hesap ──────────────────────────────────────────────────────────
  section("5. ÖZET — GÖMÜLÜ EMİSYON HESABI");
  row2("Scope 1 (Yakıt)",       `${fmt2(d.scope1FuelTco2)} tCO₂eq`);
  row2("Scope 1 (Proses)",      `${fmt2(d.scope1ProcTco2)} tCO₂eq`);
  row2("Scope 1 Toplam",        `${fmt2(d.scope1TotalTco2)} tCO₂eq`, DARK);
  row2("Scope 2",               `${fmt2(d.scope2Tco2)} tCO₂eq`);

  // Toplam satırı — vurgulu
  doc.rect(50, y, W, 24).fill(DARK);
  doc.fillColor("#fff").font("Helvetica-Bold").fontSize(10)
     .text("TOPLAM GÖMÜLÜ EMİSYON", 60, y + 7);
  doc.text(`${fmt2(d.totalTco2)} tCO₂eq`, 290, y + 7);
  doc.fillColor(DARK);
  y += 32;

  row2("Özgül Gömülü Emisyon (SEE) — Actual",
       `${fmt4(d.seeActual)} tCO₂/tonne`, BRAND);

  if (d.seeDefault != null) {
    row2("CBAM Varsayılan SEE",  `${fmt4(d.seeDefault)} tCO₂/tonne`, MUTED);
    const savings = d.seeDefault - d.seeActual;
    row2("Actual vs Varsayılan Fark",
         `${savings >= 0 ? "-" : "+"}${fmt4(Math.abs(savings))} tCO₂/tonne`,
         savings >= 0 ? GREEN : RED);
  }
  y += 8;

  // ── 6. Karbon Maliyeti Analizi ─────────────────────────────────────────────
  if (d.savingsEur != null && d.seeDefault != null) {
    section("6. KARBON MALİYETİ ANALİZİ");
    row2("Karbon Fiyatı (referans)",  `${d.carbonPrice} €/tCO₂eq`);
    row2("Toplam Actual Emisyon",     `${fmt2(d.totalTco2)} tCO₂eq`);
    row2("Varsayılan ile Fark (tCO₂)", fmt2(d.savingsTco2 ?? 0),
         (d.savingsTco2 ?? 0) >= 0 ? GREEN : RED);
    row2("Tahmini CBAM Tasarrufu (€)",
         `${d.savingsEur >= 0 ? "" : "-"}${Math.abs(d.savingsEur).toLocaleString("tr-TR", { maximumFractionDigits: 0 })} €`,
         d.savingsEur >= 0 ? GREEN : RED);
    y += 8;
  }

  // ── 7. Metodoloji ve Uyarı ─────────────────────────────────────────────────
  section("7. METODOLOJİ VE YASAL UYARI");
  doc.font("Helvetica").fontSize(8.5).fillColor(MUTED)
     .text(
       "Bu teknik dosya EU 2023/1773 (CBAM Uygulama Tüzüğü) Ek-IV, Yöntem A kapsamında hazırlanmıştır.\n" +
       "Yakıt emisyon faktörleri: IPCC 2006 GL Vol.2 Tablo 1.4. Proses faktörleri: Stoikiometrik hesap.\n" +
       "Scope 2 emisyon faktörü: Menşe ülke ağırlıklı ortalama (Voltfox EF veritabanı).\n\n" +
       "UYARI: Bu belge bilgilendirme amaçlıdır. Resmi CBAM beyanı için akredite doğrulayıcı onayı " +
       "zorunlu olabilir. Voltfox Platform bu belgeye dayanılarak yapılan beyanlardan sorumlu tutulamaz.",
       60, y, { width: W - 20, lineGap: 3 }
     );
  y = (doc as unknown as { y: number }).y + 20;

  // ── Altbilgi (tüm sayfalar için) ───────────────────────────────────────────
  const pageCount = (doc as unknown as { bufferedPageRange: () => { start: number; count: number } }).bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    doc.font("Helvetica").fontSize(8).fillColor(MUTED)
       .text(`Voltfox Platform  |  CBAM Teknik Dosya  |  Sayfa ${i + 1}/${pageCount}`,
             50, doc.page.height - 40, { width: W, align: "center" });
    doc.moveTo(50, doc.page.height - 50).lineTo(50 + W, doc.page.height - 50)
       .lineWidth(0.5).strokeColor(LINE).stroke();
  }

  doc.end();
  return doc;
}
