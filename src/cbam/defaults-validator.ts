// CBAM default değer veritabanı validasyon aracı
// PRD Açık Soru Q4: 2026 Q2 default değerleri güncel mi?

import * as fs from "fs";
import * as path from "path";

// cbam-defaults.js'i parse et (window.CBAM_DATA= prefix'ini soy)
function loadCbamData(filePath: string): Record<string, unknown> {
  const raw = fs.readFileSync(filePath, "utf-8").replace(/^﻿/, ""); // strip BOM
  const jsonStr = raw.replace(/^window\.CBAM_DATA\s*=\s*/, "").replace(/;\s*$/, "");
  return JSON.parse(jsonStr);
}

interface ValidationReport {
  file: string;
  checkedAt: string;
  findings: Finding[];
  summary: {
    totalCountries: number;
    totalCnCodes: number;
    countriesWithNullValues: string[];
    encodingIssues: string[];
    hasVersionMetadata: boolean;
    hasDateMetadata: boolean;
    recommendedVersion: string;
  };
}

interface Finding {
  severity: "ERROR" | "WARNING" | "INFO";
  code: string;
  message: string;
  detail?: string;
}

// CN kodu array formatı: [cn_code, direct, indirect, total, pct110, pct120, pct130]
type DefaultRow = [string, number | null, number | null, number | null, number | null, number | null, number | null];

export function validateCbamDefaults(dataFilePath: string): ValidationReport {
  const findings: Finding[] = [];
  const data = loadCbamData(dataFilePath) as {
    cn: Record<string, { d: string; c: string }>;
    countries: Record<string, DefaultRow[]>;
  };

  // ── 1. Metadata kontrolü ────────────────────────────────────────────────
  const hasVersionMetadata = "version" in data || "meta" in data;
  const meta = (data as Record<string, unknown>).meta as Record<string, unknown> | undefined;
  const hasDateMetadata =
    "generatedAt" in data || "validFrom" in data || "period" in data ||
    (meta != null && ("validFrom" in meta || "generatedAt" in meta));

  if (!hasVersionMetadata) {
    findings.push({
      severity: "ERROR",
      code: "NO_VERSION_METADATA",
      message: "Veri dosyasında versiyon metadata'sı yok.",
      detail:
        "Her hesapta hangi CBAM default versiyon kullanıldığı audit trail için zorunlu. " +
        "'version' alanı eklenmeli (örn: '2024Q4' veya semver).",
    });
  }

  if (!hasDateMetadata) {
    findings.push({
      severity: "ERROR",
      code: "NO_DATE_METADATA",
      message: "Veri dosyasında geçerlilik tarihi yok.",
      detail:
        "Komisyon her dönem başı default değerleri güncelleyebilir. " +
        "'validFrom' ve 'validTo' alanları zorunlu.",
    });
  }

  // ── 2. Encoding kontrolü ────────────────────────────────────────────────
  const encodingIssues: string[] = [];
  for (const country of Object.keys(data.countries)) {
    // UTF-8 mojibake tespiti: Ã veya â veya ç gibi çift-byte semboller
    if (country.includes("\xC3") || country.includes("Ã")) {
      encodingIssues.push(country);
    }
  }

  if (encodingIssues.length > 0) {
    findings.push({
      severity: "ERROR",
      code: "ENCODING_MOJIBAKE",
      message: `${encodingIssues.length} ülke adında UTF-8 encoding sorunu (mojibake).`,
      detail: `Etkilenen ülkeler: ${encodingIssues.join(", ")}. ` +
        "Dosya UTF-8 olarak yeniden kaydedilmeli.",
    });
  }

  // ── 3. Türkiye varlık kontrolü ───────────────────────────────────────────
  const turkeyKey = Object.keys(data.countries).find(
    (k) => k === "Türkiye" || k === "Turkey" || k.includes("rkiye"),
  );

  if (!turkeyKey) {
    findings.push({
      severity: "ERROR",
      code: "MISSING_TURKEY",
      message: "Türkiye veri tabanında bulunamadı.",
      detail: "Türk ihracatçılar için zorunlu. Komisyon listesinden eklenmeli.",
    });
  } else {
    findings.push({
      severity: "INFO",
      code: "TURKEY_FOUND",
      message: `Türkiye bulundu: key="${turkeyKey}", ${data.countries[turkeyKey].length} CN kodu.`,
    });
  }

  // ── 4. Null değer kontrolü ──────────────────────────────────────────────
  const countriesWithNullValues: string[] = [];

  for (const [country, rows] of Object.entries(data.countries)) {
    const nullRows = rows.filter((r) => r[1] === null && r[2] === null);
    if (nullRows.length > 0) {
      countriesWithNullValues.push(`${country}(${nullRows.length})`);
    }
  }

  if (countriesWithNullValues.length > 0) {
    findings.push({
      severity: "WARNING",
      code: "NULL_DEFAULT_VALUES",
      message: `${countriesWithNullValues.length} ülkede null direct+indirect değer satırları var.`,
      detail: "Bu CN kodları için CBAM yükümlülüğü olmayabilir veya veri eksik olabilir.",
    });
  }

  // ── 5. CN kodu tutarlılık kontrolü ──────────────────────────────────────
  const masterCnCodes = new Set(Object.keys(data.cn));
  const totalCnCodes = masterCnCodes.size;

  // 6 sektör CN kodu tespiti
  const sectorCounts: Record<string, number> = {};
  for (const { c } of Object.values(data.cn)) {
    sectorCounts[c] = (sectorCounts[c] ?? 0) + 1;
  }

  findings.push({
    severity: "INFO",
    code: "CN_CODE_COVERAGE",
    message: `Toplam ${totalCnCodes} CN kodu, ${Object.keys(data.countries).length} ülke.`,
    detail: Object.entries(sectorCounts)
      .map(([sector, count]) => `${sector}: ${count} kod`)
      .join(", "),
  });

  // ── 6. Q2 2026 güncellik uyarısı ────────────────────────────────────────
  findings.push({
    severity: "WARNING",
    code: "Q2_2026_UNVERIFIED",
    message: "2026 Q2 default değerlerinin güncelliği doğrulanamadı.",
    detail:
      "Mevcut veri versiyonu: 2026-02-04. AB Komisyonu Q2 2026 güncellemesi yayımlanırsa " +
      "cbam-defaults.js'in meta.version ve meta.validFrom alanları güncellenmeli. " +
      "Kaynak: https://taxation-customs.ec.europa.eu/carbon-border-adjustment-mechanism_en",
  });

  return {
    file: path.basename(dataFilePath),
    checkedAt: new Date().toISOString(),
    findings,
    summary: {
      totalCountries: Object.keys(data.countries).length,
      totalCnCodes,
      countriesWithNullValues,
      encodingIssues,
      hasVersionMetadata,
      hasDateMetadata,
      recommendedVersion: "2024Q4", // bilinen son yayım dönemi
    },
  };
}

// ── CLI çalıştırma ──────────────────────────────────────────────────────────
function main() {
  const filePath = path.join(process.cwd(), "cbam-defaults.js");
  const report = validateCbamDefaults(filePath);

  console.log(`\n╔══════════════════════════════════════════════════════════════╗`);
  console.log(`║      CBAM DEFAULT DEĞERLERİ VALİDASYON RAPORU               ║`);
  console.log(`╚══════════════════════════════════════════════════════════════╝`);
  console.log(`Dosya:       ${report.file}`);
  console.log(`Kontrol:     ${report.checkedAt}`);
  console.log(`Ülke sayısı: ${report.summary.totalCountries}`);
  console.log(`CN kodu:     ${report.summary.totalCnCodes}`);
  console.log(`Versiyon:    ${report.summary.hasVersionMetadata ? "VAR" : "YOK ⚠"}`);
  console.log(`Tarih meta:  ${report.summary.hasDateMetadata ? "VAR" : "YOK ⚠"}`);

  const errors   = report.findings.filter((f) => f.severity === "ERROR");
  const warnings = report.findings.filter((f) => f.severity === "WARNING");
  const infos    = report.findings.filter((f) => f.severity === "INFO");

  console.log(`\n── ${errors.length} HATA / ${warnings.length} UYARI / ${infos.length} BİLGİ ──`);

  for (const f of report.findings) {
    const icon = f.severity === "ERROR" ? "✗" : f.severity === "WARNING" ? "⚠" : "ℹ";
    console.log(`\n[${icon}] [${f.code}] ${f.message}`);
    if (f.detail) console.log(`    ${f.detail}`);
  }

  console.log(`\n── ÖNERİLEN AKSIYONLAR ──`);
  if (!report.summary.hasVersionMetadata || !report.summary.hasDateMetadata) {
    console.log(`1. cbam-defaults.js'e metadata ekle:`);
    console.log(`   { "meta": { "version": "2024Q4", "validFrom": "2024-10-01", "source": "EU Commission CBAM guidance" }, ... }`);
  }
  if (report.summary.encodingIssues.length > 0) {
    console.log(`2. Encoding düzelt: ${report.summary.encodingIssues.join(", ")}`);
    console.log(`   Python: open(f, encoding='utf-8') ile yeniden oku/yaz`);
  }
  console.log(`3. Q2 2026 için Komisyon sayfasını manuel kontrol et (son yayım tarihi: bilinmiyor).`);
}

main();
