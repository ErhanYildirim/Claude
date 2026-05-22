import { createRequire } from "module";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { calculateScope2 } from "../../../../src/cbam/scope2.js";
import { calculateSEE } from "../../../../src/cbam/see.js";
import { compareWithDefault, lookupDefault } from "../../../../src/cbam/comparison.js";
import { lookupGridEF } from "../../../../src/cbam/ef-data.js";
import { dispatchWebhookEvent } from "./webhooks.js";
import { notifyTenant } from "../lib/notify.js";
import { emailCalculationDone } from "../lib/email.js";

const require = createRequire(import.meta.url);
const CBAM_DATA: {
  meta?:     { version?: string; validFrom?: string };
  countries: Record<string, Array<[string, number | null, number | null, number, number, number, number]>>;
} = require("../../../../cbam-defaults.json");

const CALC_ENGINE_VERSION = "1.0.0";
const EF_DATA_VERSION     = process.env.CBAM_DATA_VERSION ?? "20260204";

export const periodsRoutes: FastifyPluginAsync = async (app) => {

  // POST /installations/:installationId/periods
  app.post("/installations/:installationId/periods", {
    schema: {
      body: {
        type: "object",
        required: [
          "periodName", "startDate", "endDate", "reportYear",
          "importCountry", "cnCode", "prodVolumeTonne",
          "scope1DirectTco2", "scope1Quality",
          "electricityKwh", "electricitySource", "matchingRatePct",
        ],
        properties: {
          periodName:       { type: "string" },
          startDate:        { type: "string", format: "date" },
          endDate:          { type: "string", format: "date" },
          reportYear:       { type: "integer", minimum: 2024 },
          importCountry:    { type: "string" },
          cnCode:           { type: "string" },
          prodVolumeTonne:  { type: "number", exclusiveMinimum: 0 },
          scope2Exempt:     { type: "boolean", default: false },
          scope1DirectTco2: { type: "number", minimum: 0 },
          scope1Quality:    { type: "string", enum: ["measured", "calculated", "estimated"] },
          scope1AuditNote:  { type: "string" },
          electricityKwh:   { type: "number", minimum: 0 },
          electricitySource:{ type: "string", enum: ["smart_meter", "erp", "invoice", "manual"] },
          baselineEf:       { type: "number", minimum: 0 },  // opsiyonel: verilmezse ülke EF'i otomatik çekilir
          renewableEf:      { type: "number", minimum: 0 },
          matchingRatePct:  { type: "number", minimum: 0, maximum: 100 },
          gecConnected:     { type: "boolean", default: false },
          carbonPriceEur:   { type: "number", minimum: 0 },
        },
      },
    },
  }, async (request, reply) => {
    const { installationId } = request.params as { installationId: string };

    const installation = await prisma.installation.findFirst({
      where: { id: installationId, tenantId: request.tenantId },
    });
    if (!installation) return reply.status(404).send({ error: "NOT_FOUND", message: "Tesis bulunamadı." });

    const body = request.body as {
      periodName: string; startDate: string; endDate: string; reportYear: number;
      importCountry: string; cnCode: string; prodVolumeTonne: number; scope2Exempt?: boolean;
      scope1DirectTco2: number; scope1Quality: string; scope1AuditNote?: string;
      electricityKwh: number; electricitySource: string;
      baselineEf?: number; renewableEf?: number; matchingRatePct: number;
      gecConnected?: boolean; carbonPriceEur?: number;
    };

    // baselineEf verilmezse tesisin bulunduğu ülkenin grid EF'ini otomatik çek
    let baselineEf = body.baselineEf;
    let baselineEfSource = "user_provided";
    if (baselineEf === undefined) {
      const efLookup = lookupGridEF(installation.facilityCountry);
      if (!efLookup) {
        return reply.status(422).send({
          error: "EF_NOT_FOUND",
          message: `'${installation.facilityCountry}' için grid EF verisi bulunamadı. baselineEf alanını manuel olarak girin.`,
        });
      }
      baselineEf = efLookup.ef;
      baselineEfSource = `auto:${efLookup.source} (${efLookup.year})`;
    }

    const period = await prisma.reportingPeriod.create({
      data: {
        installationId,
        periodName:    body.periodName,
        startDate:     new Date(body.startDate),
        endDate:       new Date(body.endDate),
        reportYear:    body.reportYear,
        importCountry: body.importCountry,
        cnCode:        body.cnCode,
        prodVolumeTonne: body.prodVolumeTonne,
        scope2Exempt:    body.scope2Exempt ?? false,
        scope1DirectTco2: body.scope1DirectTco2,
        scope1Quality:    body.scope1Quality,
        scope1AuditNote:  body.scope1AuditNote ?? null,
        electricityKwh:   body.electricityKwh,
        electricitySource: body.electricitySource,
        baselineEf,
        renewableEf:      body.renewableEf ?? 0.02,
        matchingRatePct:  body.matchingRatePct,
        gecConnected:     body.gecConnected ?? false,
        carbonPriceEur:   body.carbonPriceEur ?? null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "CREATE",
        resource:   "ReportingPeriod",
        resourceId: period.id,
      },
    });

    return reply.status(201).send(period);
  });

  // POST /installations/:installationId/periods/:periodId/calculate
  app.post("/installations/:installationId/periods/:periodId/calculate", {
    config: { rateLimit: { max: 20, timeWindow: "1 minute" } },
  }, async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string; periodId: string;
    };

    const period = await prisma.reportingPeriod.findFirst({
      where: {
        id: periodId,
        installationId,
        installation: { tenantId: request.tenantId },
      },
    });
    if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

    // ── EF kaynağını belirle ──────────────────────────────────────────────
    const installation = await prisma.installation.findUnique({
      where: { id: period.installationId },
      select: { facilityCountry: true, facilityName: true },
    });
    const countryEF   = installation ? lookupGridEF(installation.facilityCountry) : null;
    const efIsAutoFilled = countryEF && Math.abs(countryEF.ef - period.baselineEf) < 0.0001;
    const baselineEfSource = efIsAutoFilled ? "country_annual_avg" as const : "user_provided" as const;
    const baselineEfVersion = efIsAutoFilled
      ? `${countryEF!.source} (${countryEF!.year})`
      : undefined;

    // ── Hesapla ──────────────────────────────────────────────────────────
    const seeResult = calculateSEE({
      id:                     period.id,
      label:                  period.periodName,
      startDate:              period.startDate.toISOString().slice(0, 10),
      endDate:                period.endDate.toISOString().slice(0, 10),
      productionVolumeTonnes: period.prodVolumeTonne,
      scope1DirectTco2:       period.scope1DirectTco2,
      scope1DataQuality:      period.scope1Quality as "measured" | "calculated" | "estimated",
      scope1AuditNote:        period.scope1AuditNote ?? undefined,
      scope2Exempt:           period.scope2Exempt,
      purchasedElectricity: {
        consumedKwh:       period.electricityKwh,
        matchingRatePct:   period.matchingRatePct,
        renewableEf:       period.renewableEf,
        baselineEf:        period.baselineEf,
        baselineEfSource,
        baselineEfVersion,
        gecDataVersion:    EF_DATA_VERSION,
        dataQuality:       period.scope1Quality as "measured" | "calculated" | "estimated",
      },
    });

    const scope2Result = seeResult.scope2;

    // CBAM default karşılaştırması (opsiyonel)
    let comparison = null;
    if (period.carbonPriceEur) {
      const defaults = lookupDefault(CBAM_DATA, period.importCountry, period.cnCode);
      if (defaults) {
        comparison = compareWithDefault(seeResult, defaults, period.carbonPriceEur);
      }
    }

    // ── Sonucu kaydet (tek transaction) ──────────────────────────────────
    const emissionData = {
      scope2BaselineTco2:  scope2Result.baselineTco2,
      scope2VoltfoxTco2:   scope2Result.voltfoxTco2,
      reductionTco2:       scope2Result.reductionTco2,
      reductionPct:        scope2Result.reductionPct,
      seeBaseline:         seeResult.seeBaseline,
      seeVoltfox:          seeResult.seeVoltfox ?? seeResult.seeBaseline,
      defaultSee:          comparison?.defaultSee ?? null,
      savingsVsDefaultEur: comparison?.annualSavingsEur ?? null,
      calcEngineVersion:   CALC_ENGINE_VERSION,
      efDataVersion:       EF_DATA_VERSION,
    };

    const [result] = await prisma.$transaction([
      prisma.embeddedEmission.upsert({
        where:  { periodId },
        create: { periodId, ...emissionData },
        update: { ...emissionData, calculatedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          tenantId:   request.tenantId,
          userId:     request.userId ?? undefined,
          action:     "CALCULATE",
          resource:   "EmbeddedEmission",
          resourceId: periodId,
          payload:    { calcEngineVersion: CALC_ENGINE_VERSION, efDataVersion: EF_DATA_VERSION },
        },
      }),
    ]);

    // Fire-and-forget webhook (calculation.completed)
    dispatchWebhookEvent(request.tenantId, "calculation.completed", {
      periodId,
      installationId,
      cfeScore:          null,
      seeBaseline:       result.seeBaseline,
      seeVoltfox:        result.seeVoltfox,
      reductionPct:      result.reductionPct,
      calcEngineVersion: CALC_ENGINE_VERSION,
      calculatedAt:      result.calculatedAt,
    }).catch(() => {});

    // Fire-and-forget in-app + email notification
    notifyTenant({
      tenantId:   request.tenantId,
      eventType:  "calculationDone",
      title:      `SEE hesaplandı: ${period.periodName}`,
      body:       `${installation?.facilityName ?? ""} · SEE ${result.seeVoltfox.toFixed(4)} tCO₂e/t · Azaltım %${result.reductionPct.toFixed(1)}`,
      resource:   "EmbeddedEmission",
      resourceId: result.id,
      emailFactory: (_uid, email) => {
        void email;
        return emailCalculationDone({
          facilityName:   installation?.facilityName ?? "",
          periodName:     period.periodName,
          seeVoltfox:     result.seeVoltfox,
          reductionPct:   result.reductionPct,
          appUrl:         process.env.APP_URL ?? "https://app.voltfox.io",
          installationId,
          periodId,
        });
      },
    }).catch(() => {});

    return reply.send({
      period,
      scope2:     scope2Result,
      see:        seeResult,
      comparison,
      stored:     result,
    });
  });

  // GET /installations/:installationId/periods/:periodId/result
  app.get("/installations/:installationId/periods/:periodId/result", async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string; periodId: string;
    };

    const result = await prisma.embeddedEmission.findFirst({
      where: {
        periodId,
        period: {
          installationId,
          installation: { tenantId: request.tenantId },
        },
      },
      include: { period: true },
    });

    if (!result) return reply.status(404).send({ error: "NOT_FOUND", message: "Henüz hesaplanmış sonuç yok." });
    return reply.send(result);
  });

  // PATCH /installations/:installationId/periods/:periodId
  app.patch("/installations/:installationId/periods/:periodId", {
    schema: {
      body: {
        type: "object",
        properties: {
          periodName:       { type: "string" },
          importCountry:    { type: "string" },
          cnCode:           { type: "string" },
          prodVolumeTonne:  { type: "number", exclusiveMinimum: 0 },
          scope1DirectTco2: { type: "number", minimum: 0 },
          scope1Quality:    { type: "string", enum: ["measured", "calculated", "estimated"] },
          scope1AuditNote:  { type: "string" },
          electricityKwh:   { type: "number", minimum: 0 },
          electricitySource:{ type: "string", enum: ["smart_meter", "erp", "invoice", "manual"] },
          matchingRatePct:  { type: "number", minimum: 0, maximum: 100 },
          gecConnected:     { type: "boolean" },
          carbonPriceEur:   { type: "number", minimum: 0 },
          scope2Exempt:     { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string; periodId: string;
    };

    const existing = await prisma.reportingPeriod.findFirst({
      where: { id: periodId, installationId, installation: { tenantId: request.tenantId } },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

    const body = request.body as {
      periodName?: string; importCountry?: string; cnCode?: string;
      prodVolumeTonne?: number; scope1DirectTco2?: number; scope1Quality?: string;
      scope1AuditNote?: string; electricityKwh?: number; electricitySource?: string;
      matchingRatePct?: number; gecConnected?: boolean; carbonPriceEur?: number;
      scope2Exempt?: boolean;
    };

    const updated = await prisma.reportingPeriod.update({
      where: { id: periodId },
      data: {
        ...(body.periodName       !== undefined && { periodName:       body.periodName }),
        ...(body.importCountry    !== undefined && { importCountry:    body.importCountry }),
        ...(body.cnCode           !== undefined && { cnCode:           body.cnCode }),
        ...(body.prodVolumeTonne  !== undefined && { prodVolumeTonne:  body.prodVolumeTonne }),
        ...(body.scope1DirectTco2 !== undefined && { scope1DirectTco2: body.scope1DirectTco2 }),
        ...(body.scope1Quality    !== undefined && { scope1Quality:    body.scope1Quality }),
        ...(body.scope1AuditNote  !== undefined && { scope1AuditNote:  body.scope1AuditNote }),
        ...(body.electricityKwh   !== undefined && { electricityKwh:   body.electricityKwh }),
        ...(body.electricitySource !== undefined && { electricitySource: body.electricitySource }),
        ...(body.matchingRatePct  !== undefined && { matchingRatePct:  body.matchingRatePct }),
        ...(body.gecConnected     !== undefined && { gecConnected:     body.gecConnected }),
        ...(body.carbonPriceEur   !== undefined && { carbonPriceEur:   body.carbonPriceEur }),
        ...(body.scope2Exempt     !== undefined && { scope2Exempt:     body.scope2Exempt }),
      },
    });

    // Dönem güncellendiyse mevcut hesaplama sonucunu sil (yeniden hesaplama gerekli)
    await prisma.embeddedEmission.deleteMany({ where: { periodId } });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "UPDATE",
        resource:   "ReportingPeriod",
        resourceId: periodId,
        payload:    { before: existing, after: updated },
      },
    });

    return reply.send(updated);
  });

  // DELETE /installations/:installationId/periods/:periodId
  app.delete("/installations/:installationId/periods/:periodId", async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string; periodId: string;
    };

    const period = await prisma.reportingPeriod.findFirst({
      where: {
        id: periodId,
        installationId,
        installation: { tenantId: request.tenantId },
      },
    });
    if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.reportingPeriod.delete({ where: { id: periodId } });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "DELETE",
        resource:   "ReportingPeriod",
        resourceId: periodId,
      },
    });

    return reply.status(204).send();
  });
};
