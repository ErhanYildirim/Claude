import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { parse } from "csv-parse/sync";
import { prisma } from "@voltfox/db";
import { requireRole } from "../plugins/rbac.js";

interface PeriodRow {
  period_name:         string;
  start_date:          string;
  end_date:            string;
  report_year:         string;
  import_country:      string;
  cn_code:             string;
  prod_volume_tonne:   string;
  scope1_direct_tco2:  string;
  scope1_quality:      string;
  electricity_kwh:     string;
  electricity_source:  string;
  baseline_ef:         string;
  renewable_ef:        string;
  matching_rate_pct:   string;
  carbon_price_eur?:   string;
}

interface ParsedPeriod {
  periodName:       string;
  startDate:        string;
  endDate:          string;
  reportYear:       number;
  importCountry:    string;
  cnCode:           string;
  prodVolumeTonne:  number;
  scope1DirectTco2: number;
  scope1Quality:    string;
  electricityKwh:   number;
  electricitySource: string;
  baselineEf:       number;
  renewableEf:      number;
  matchingRatePct:  number;
  carbonPriceEur:   number | null;
}

interface ValidationResult {
  row:    number;
  field:  string;
  error:  string;
}

function parsePeriodRow(raw: PeriodRow, rowNum: number): { period?: ParsedPeriod; errors: ValidationResult[] } {
  const errors: ValidationResult[] = [];
  const req = (field: string, val: string) => {
    if (!val?.trim()) errors.push({ row: rowNum, field, error: "Zorunlu alan boş" });
    return val?.trim() ?? "";
  };
  const num = (field: string, val: string, min = 0) => {
    const n = parseFloat(val);
    if (isNaN(n) || n < min) errors.push({ row: rowNum, field, error: `Geçersiz sayı: "${val}"` });
    return isNaN(n) ? 0 : n;
  };

  const periodName       = req("period_name",  raw.period_name);
  const startDate        = req("start_date",   raw.start_date);
  const endDate          = req("end_date",     raw.end_date);
  const importCountry    = req("import_country", raw.import_country);
  const cnCode           = req("cn_code",      raw.cn_code);
  const scope1Quality    = raw.scope1_quality?.trim() || "measured";
  const VALID_EL_SOURCES = ["smart_meter", "erp", "invoice", "manual"];
  const rawElSource = raw.electricity_source?.trim();
  if (rawElSource && !VALID_EL_SOURCES.includes(rawElSource)) {
    errors.push({ row: rowNum, field: "electricity_source", error: `Geçersiz kaynak: "${rawElSource}". Geçerli değerler: ${VALID_EL_SOURCES.join(", ")}` });
  }
  const electricitySource = VALID_EL_SOURCES.includes(rawElSource ?? "") ? rawElSource! : "manual";

  const reportYear        = num("report_year",       raw.report_year,       2020);
  const prodVolumeTonne   = num("prod_volume_tonne", raw.prod_volume_tonne, 0);
  const scope1DirectTco2  = num("scope1_direct_tco2", raw.scope1_direct_tco2, 0);
  const electricityKwh    = num("electricity_kwh",   raw.electricity_kwh,   0);
  const baselineEf        = num("baseline_ef",       raw.baseline_ef,       0);
  const renewableEf       = num("renewable_ef",      raw.renewable_ef,      0);
  const matchingRatePct   = num("matching_rate_pct", raw.matching_rate_pct, 0);
  const carbonPriceEur    = raw.carbon_price_eur?.trim()
    ? parseFloat(raw.carbon_price_eur)
    : null;

  // Date validation
  if (startDate && endDate && new Date(startDate) >= new Date(endDate)) {
    errors.push({ row: rowNum, field: "start_date", error: "Başlangıç tarihi bitiş tarihinden önce olmalı" });
  }

  if (errors.length > 0) return { errors };

  return {
    period: {
      periodName, startDate, endDate, reportYear: Math.round(reportYear),
      importCountry, cnCode, prodVolumeTonne, scope1DirectTco2, scope1Quality,
      electricityKwh, electricitySource, baselineEf, renewableEf, matchingRatePct,
      carbonPriceEur: carbonPriceEur != null && !isNaN(carbonPriceEur) ? carbonPriceEur : null,
    },
    errors: [],
  };
}

export const periodImportRoutes: FastifyPluginAsync = async (app) => {
  if (!app.hasPlugin("@fastify/multipart")) {
    await app.register(multipart, { limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
  }

  // POST /installations/:installationId/periods/import/preview
  // CSV'yi parse eder, validated satırları ve hataları döndürür (kayıt yok)
  app.post("/installations/:installationId/periods/import/preview", async (request, reply) => {
    if (!await requireRole(request, reply, "analyst")) return;

    const { installationId } = request.params as { installationId: string };

    const installation = await prisma.installation.findFirst({
      where: { id: installationId, tenantId: request.tenantId },
      select: { id: true, facilityName: true },
    });
    if (!installation) return reply.status(404).send({ error: "NOT_FOUND" });

    const data = await request.file();
    if (!data) return reply.status(400).send({ error: "FILE_REQUIRED" });

    const buffer = await data.toBuffer();
    const csvText = buffer.toString("utf-8");

    let rawRows: PeriodRow[];
    try {
      rawRows = parse(csvText, { columns: true, skip_empty_lines: true, trim: true }) as PeriodRow[];
    } catch {
      return reply.status(400).send({ error: "CSV_PARSE_ERROR", message: "CSV dosyası okunamadı." });
    }

    const periods:  ParsedPeriod[]    = [];
    const errors:   ValidationResult[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const { period, errors: rowErrors } = parsePeriodRow(rawRows[i], i + 2);
      if (period) periods.push(period);
      errors.push(...rowErrors);
    }

    return reply.send({
      installationId,
      facilityName:  installation.facilityName,
      totalRows:     rawRows.length,
      validRows:     periods.length,
      errorCount:    errors.length,
      periods,
      errors,
    });
  });

  // POST /installations/:installationId/periods/import/confirm
  // Önceden parse edilmiş dönemleri DB'ye yazar
  app.post("/installations/:installationId/periods/import/confirm", {
    schema: {
      body: {
        type: "object",
        required: ["periods"],
        properties: {
          periods: { type: "array" },
          skipErrors: { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "analyst")) return;

    const { installationId } = request.params as { installationId: string };
    const body = request.body as { periods: ParsedPeriod[]; skipErrors?: boolean };

    const installation = await prisma.installation.findFirst({
      where: { id: installationId, tenantId: request.tenantId },
      select: { id: true },
    });
    if (!installation) return reply.status(404).send({ error: "NOT_FOUND" });

    const created: string[] = [];
    const failed:  Array<{ periodName: string; error: string }> = [];

    for (const p of body.periods) {
      try {
        const period = await prisma.reportingPeriod.create({
          data: {
            installationId,
            periodName:       p.periodName,
            startDate:        new Date(p.startDate),
            endDate:          new Date(p.endDate),
            reportYear:       p.reportYear,
            importCountry:    p.importCountry,
            cnCode:           p.cnCode,
            prodVolumeTonne:  p.prodVolumeTonne,
            scope1DirectTco2: p.scope1DirectTco2,
            scope1Quality:    p.scope1Quality,
            electricityKwh:   p.electricityKwh,
            electricitySource: p.electricitySource,
            baselineEf:       p.baselineEf,
            renewableEf:      p.renewableEf,
            matchingRatePct:  p.matchingRatePct,
            carbonPriceEur:   p.carbonPriceEur,
          },
        });
        created.push(period.id);
      } catch (err: unknown) {
        failed.push({ periodName: p.periodName, error: (err as Error).message ?? "Bilinmeyen hata" });
      }
    }

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "IMPORT",
        resource:   "ReportingPeriod",
        resourceId: installationId,
        payload:    { created: created.length, failed: failed.length },
      },
    }).catch(() => {});

    return reply.status(201).send({
      created: created.length,
      failed:  failed.length,
      details: failed,
      message: `${created.length} dönem oluşturuldu${failed.length > 0 ? `, ${failed.length} başarısız` : ""}.`,
    });
  });
};
