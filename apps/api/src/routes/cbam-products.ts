import type { FastifyPluginAsync } from "fastify";
import { prisma, Prisma } from "@voltfox/db";
import { requireRole } from "../plugins/rbac.js";
import { dispatchWebhookEvent } from "./webhooks.js";
import {
  calculateCbamProductEmission,
  RENEWABLE_SOURCE_EF,
  CBAM_COUNTRY_EF,
  RENEWABLE_SOURCE_LABELS,
} from "../lib/cbam-product-calc.js";

export const cbamProductRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /cbam/facilities/:facilityId/products ─────────────────────────────
  app.get("/cbam/facilities/:facilityId/products", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const { facilityId } = request.params as { facilityId: string };

    const facility = await prisma.cbamFacility.findFirst({
      where: { id: facilityId, tenantId: request.tenantId },
    });
    if (!facility) return reply.status(404).send({ error: "NOT_FOUND" });

    const products = await prisma.cbamProduct.findMany({
      where:   { cbamFacilityId: facilityId, tenantId: request.tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        productPeriods: { orderBy: { reportYear: "desc" } },
      },
    });

    return reply.send({ products });
  });

  // ── POST /cbam/facilities/:facilityId/products ────────────────────────────
  app.post("/cbam/facilities/:facilityId/products", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const { facilityId } = request.params as { facilityId: string };
    const body = request.body as {
      productName:           string;
      cnCode?:               string;
      description?:          string;
      unit?:                 string;
      isCbamScope?:          boolean;
      energyAllocationMode?: string;
    };

    if (!body.productName?.trim())
      return reply.status(400).send({ error: "MISSING_NAME", message: "productName gerekli." });

    const facility = await prisma.cbamFacility.findFirst({
      where: { id: facilityId, tenantId: request.tenantId },
    });
    if (!facility) return reply.status(404).send({ error: "NOT_FOUND" });

    const allocationMode = body.energyAllocationMode ?? "facility";
    if (!["facility", "band"].includes(allocationMode))
      return reply.status(400).send({ error: "INVALID_MODE", message: "energyAllocationMode: facility | band" });

    const product = await prisma.cbamProduct.create({
      data: {
        tenantId:             request.tenantId,
        cbamFacilityId:       facilityId,
        productName:          body.productName.trim(),
        cnCode:               body.cnCode?.trim() || null,
        description:          body.description?.trim() || null,
        unit:                 body.unit ?? "tonne",
        isCbamScope:          body.isCbamScope ?? true,
        energyAllocationMode: allocationMode,
      },
    });

    return reply.status(201).send({ product });
  });

  // ── PATCH /cbam/facilities/:facilityId/products/:productId ───────────────
  app.patch("/cbam/facilities/:facilityId/products/:productId", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const { productId } = request.params as { facilityId: string; productId: string };
    const body = request.body as Partial<{
      productName: string; cnCode: string; description: string;
      unit: string; isCbamScope: boolean; energyAllocationMode: string;
    }>;

    const product = await prisma.cbamProduct.findFirst({
      where: { id: productId, tenantId: request.tenantId },
    });
    if (!product) return reply.status(404).send({ error: "NOT_FOUND" });

    if (body.energyAllocationMode && !["facility", "band"].includes(body.energyAllocationMode))
      return reply.status(400).send({ error: "INVALID_MODE" });

    const updated = await prisma.cbamProduct.update({
      where: { id: productId },
      data: {
        ...(body.productName          != null && { productName: body.productName.trim() }),
        ...(body.cnCode               != null && { cnCode: body.cnCode.trim() || null }),
        ...(body.description          != null && { description: body.description.trim() || null }),
        ...(body.unit                 != null && { unit: body.unit }),
        ...(body.isCbamScope          != null && { isCbamScope: body.isCbamScope }),
        ...(body.energyAllocationMode != null && { energyAllocationMode: body.energyAllocationMode }),
      },
    });

    return reply.send({ product: updated });
  });

  // ── DELETE /cbam/facilities/:facilityId/products/:productId ──────────────
  app.delete("/cbam/facilities/:facilityId/products/:productId", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "admin")) return;

    const { productId } = request.params as { facilityId: string; productId: string };

    const product = await prisma.cbamProduct.findFirst({
      where: { id: productId, tenantId: request.tenantId },
    });
    if (!product) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.cbamProduct.delete({ where: { id: productId } });
    return reply.status(204).send();
  });

  // ── GET /cbam/facilities/:facilityId/products/:productId/periods ──────────
  app.get("/cbam/facilities/:facilityId/products/:productId/periods", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const { productId } = request.params as { facilityId: string; productId: string };

    const product = await prisma.cbamProduct.findFirst({
      where:   { id: productId, tenantId: request.tenantId },
      include: { facility: { select: { facilityCountry: true, linkedInstallationId: true, facilityName: true } } },
    });
    if (!product) return reply.status(404).send({ error: "NOT_FOUND" });

    const periods = await prisma.cbamProductPeriod.findMany({
      where:   { cbamProductId: productId },
      orderBy: { reportYear: "desc" },
    });

    return reply.send({ product, periods });
  });

  // ── POST /cbam/facilities/:facilityId/products/:productId/periods ─────────
  app.post("/cbam/facilities/:facilityId/products/:productId/periods", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const { productId } = request.params as { facilityId: string; productId: string };
    const body = request.body as {
      reportYear:            number;
      periodName:            string;
      startDate:             string;
      endDate:               string;
      productionVolumeTonne: number;
      scope1DirectTco2?:     number;
      scope1AuditNote?:      string;
      bandElectricityKwh?:   number;
      bandRenewableKwh?:     number;
      facilityTotalKwh?:     number;
      facilityRenewableKwh?: number;
      productShareKwh?:      number;
      renewableSource?:      string;
      cbamDefaultEf?:        number;
      countryGridEf?:        number;
    };

    if (!body.periodName || !body.reportYear || !body.productionVolumeTonne)
      return reply.status(400).send({ error: "MISSING_FIELDS" });

    const product = await prisma.cbamProduct.findFirst({
      where:   { id: productId, tenantId: request.tenantId },
      include: { facility: { select: { facilityCountry: true } } },
    });
    if (!product) return reply.status(404).send({ error: "NOT_FOUND" });

    const renewableSourceEf = body.renewableSource
      ? (RENEWABLE_SOURCE_EF[body.renewableSource] ?? null)
      : null;

    // Auto-fill cbamDefaultEf from CBAM_COUNTRY_EF using the CBAM facility country
    const autoCbamEf = body.cbamDefaultEf != null
      ? body.cbamDefaultEf
      : (CBAM_COUNTRY_EF[product.facility.facilityCountry] ?? null);

    // Auto-fill countryGridEf from ENTSO-E data if not provided
    let autoGridEf: number | null = body.countryGridEf ?? null;
    if (autoGridEf == null) {
      const gridRows = await prisma.$queryRaw<{ avg_ef: string | null }[]>(
        Prisma.sql`
          SELECT ROUND(AVG(ci_lifecycle)::numeric, 4) AS avg_ef
          FROM emission_factors
          WHERE country = ${product.facility.facilityCountry}
            AND granularity = 'hourly'
            AND EXTRACT(YEAR FROM hour) = ${body.reportYear}
        `
      ).catch(() => []);
      const g = gridRows[0]?.avg_ef != null ? parseFloat(gridRows[0].avg_ef) : null;
      autoGridEf = g != null ? Math.round(g * 0.001 * 10000) / 10000 : null;
    }

    const existing = await prisma.cbamProductPeriod.findFirst({
      where: { cbamProductId: productId, reportYear: body.reportYear },
    });
    if (existing)
      return reply.status(409).send({
        error:   "DUPLICATE_YEAR",
        message: `${body.reportYear} yılı için dönem zaten mevcut.`,
      });

    const period = await prisma.cbamProductPeriod.create({
      data: {
        cbamProductId:         productId,
        reportYear:            body.reportYear,
        periodName:            body.periodName,
        startDate:             new Date(body.startDate),
        endDate:               new Date(body.endDate),
        productionVolumeTonne: body.productionVolumeTonne,
        scope1DirectTco2:      body.scope1DirectTco2  ?? 0,
        scope1AuditNote:       body.scope1AuditNote   ?? null,
        bandElectricityKwh:    body.bandElectricityKwh  ?? null,
        bandRenewableKwh:      body.bandRenewableKwh    ?? null,
        facilityTotalKwh:      body.facilityTotalKwh    ?? null,
        facilityRenewableKwh:  body.facilityRenewableKwh ?? null,
        productShareKwh:       body.productShareKwh     ?? null,
        renewableSource:       body.renewableSource     ?? null,
        renewableSourceEf:     renewableSourceEf,
        cbamDefaultEf:         autoCbamEf,
        countryGridEf:         autoGridEf,
      },
    });

    return reply.status(201).send({ period });
  });

  // ── PATCH /cbam/facilities/:facilityId/products/:productId/periods/:periodId
  app.patch("/cbam/facilities/:facilityId/products/:productId/periods/:periodId", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const { productId, periodId } = request.params as {
      facilityId: string; productId: string; periodId: string;
    };
    const body = request.body as Record<string, unknown>;

    const product = await prisma.cbamProduct.findFirst({
      where: { id: productId, tenantId: request.tenantId },
    });
    if (!product) return reply.status(404).send({ error: "NOT_FOUND" });

    const period = await prisma.cbamProductPeriod.findFirst({
      where: { id: periodId, cbamProductId: productId },
    });
    if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

    const newSource = body.renewableSource as string | undefined;
    const renewableSourceEf = newSource != null
      ? (RENEWABLE_SOURCE_EF[newSource] ?? null)
      : undefined;

    const updated = await prisma.cbamProductPeriod.update({
      where: { id: periodId },
      data: {
        ...(body.periodName            != null && { periodName:            body.periodName as string }),
        ...(body.startDate             != null && { startDate:             new Date(body.startDate as string) }),
        ...(body.endDate               != null && { endDate:               new Date(body.endDate   as string) }),
        ...(body.productionVolumeTonne != null && { productionVolumeTonne: body.productionVolumeTonne as number }),
        ...(body.scope1DirectTco2      != null && { scope1DirectTco2:      body.scope1DirectTco2 as number }),
        ...(body.scope1AuditNote       != null && { scope1AuditNote:       body.scope1AuditNote  as string }),
        ...(body.bandElectricityKwh    != null && { bandElectricityKwh:    body.bandElectricityKwh    as number }),
        ...(body.bandRenewableKwh      != null && { bandRenewableKwh:      body.bandRenewableKwh      as number }),
        ...(body.facilityTotalKwh      != null && { facilityTotalKwh:      body.facilityTotalKwh      as number }),
        ...(body.facilityRenewableKwh  != null && { facilityRenewableKwh:  body.facilityRenewableKwh  as number }),
        ...(body.productShareKwh       != null && { productShareKwh:       body.productShareKwh       as number }),
        ...(newSource != null && {
          renewableSource:   newSource,
          renewableSourceEf: renewableSourceEf,
        }),
        ...(body.cbamDefaultEf != null && { cbamDefaultEf: body.cbamDefaultEf as number }),
        ...(body.countryGridEf != null && { countryGridEf: body.countryGridEf as number }),
        calculatedAt: null,
      },
    });

    return reply.send({ period: updated });
  });

  // ── POST /cbam/facilities/:facilityId/products/:productId/periods/:periodId/calculate
  app.post("/cbam/facilities/:facilityId/products/:productId/periods/:periodId/calculate", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const { productId, periodId } = request.params as {
      facilityId: string; productId: string; periodId: string;
    };

    const product = await prisma.cbamProduct.findFirst({
      where: { id: productId, tenantId: request.tenantId },
    });
    if (!product) return reply.status(404).send({ error: "NOT_FOUND" });

    const period = await prisma.cbamProductPeriod.findFirst({
      where: { id: periodId, cbamProductId: productId },
    });
    if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

    const result = calculateCbamProductEmission({
      energyAllocationMode:  product.energyAllocationMode as "facility" | "band",
      bandElectricityKwh:    period.bandElectricityKwh   != null ? Number(period.bandElectricityKwh)   : undefined,
      bandRenewableKwh:      period.bandRenewableKwh     != null ? Number(period.bandRenewableKwh)     : undefined,
      facilityTotalKwh:      period.facilityTotalKwh     != null ? Number(period.facilityTotalKwh)     : undefined,
      facilityRenewableKwh:  period.facilityRenewableKwh != null ? Number(period.facilityRenewableKwh) : undefined,
      productShareKwh:       period.productShareKwh      != null ? Number(period.productShareKwh)      : undefined,
      renewableSource:       period.renewableSource      ?? undefined,
      renewableSourceEf:     period.renewableSourceEf    != null ? Number(period.renewableSourceEf)    : undefined,
      cbamDefaultEf:         period.cbamDefaultEf        != null ? Number(period.cbamDefaultEf)        : undefined,
      countryGridEf:         period.countryGridEf        != null ? Number(period.countryGridEf)        : undefined,
      scope1DirectTco2:      Number(period.scope1DirectTco2),
      productionVolumeTonne: Number(period.productionVolumeTonne),
    });

    const updated = await prisma.cbamProductPeriod.update({
      where: { id: periodId },
      data: {
        allocatedElecKwh:      result.allocatedElecKwh,
        allocatedRenewKwh:     result.allocatedRenewKwh,
        matchedKwh:            result.matchedKwh,
        unmatchedKwh:          result.unmatchedKwh,
        matchedIndirectTco2:   result.matchedIndirectTco2,
        unmatchedIndirectTco2: result.unmatchedIndirectTco2,
        totalIndirectTco2:     result.totalIndirectTco2,
        totalEmbeddedTco2:     result.totalEmbeddedTco2,
        see:                   result.see,
        effectiveEf:           result.effectiveEf,
        unmatchedEfUsed:       result.unmatchedEfUsed,
        unmatchedEfSource:     result.unmatchedEfSource,
        calculatedAt:          new Date(),
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "CALCULATE",
        resource:   "CbamProductPeriod",
        resourceId: periodId,
        payload:    {
          see:               result.see,
          effectiveEf:       result.effectiveEf,
          unmatchedEfSource: result.unmatchedEfSource,
        },
      },
    }).catch(() => {});

    dispatchWebhookEvent(request.tenantId, "calculation.completed", {
      type:              "cbam_product_period",
      periodId,
      productId:         period.cbamProductId,
      see:               result.see,
      effectiveEf:       result.effectiveEf,
      unmatchedEfSource: result.unmatchedEfSource,
      calculatedAt:      new Date().toISOString(),
    }).catch(() => {});

    return reply.send({ period: updated, result });
  });

  // ── DELETE /cbam/facilities/:facilityId/products/:productId/periods/:periodId
  app.delete("/cbam/facilities/:facilityId/products/:productId/periods/:periodId", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const { productId, periodId } = request.params as {
      facilityId: string; productId: string; periodId: string;
    };

    const product = await prisma.cbamProduct.findFirst({
      where: { id: productId, tenantId: request.tenantId },
    });
    if (!product) return reply.status(404).send({ error: "NOT_FOUND" });

    const period = await prisma.cbamProductPeriod.findFirst({
      where: { id: periodId, cbamProductId: productId },
    });
    if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.cbamProductPeriod.delete({ where: { id: periodId } });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "DELETE",
        resource:   "CbamProductPeriod",
        resourceId: periodId,
        payload:    { periodName: period.periodName, reportYear: period.reportYear },
      },
    }).catch(() => {});

    return reply.status(204).send();
  });

  // ── GET /cbam/reference — sabit referans verileri ─────────────────────────
  app.get("/cbam/reference", { config: { public: true } }, async (_request, reply) => {
    return reply.send({
      renewableSources: Object.entries(RENEWABLE_SOURCE_EF).map(([key, ef]) => ({
        key,
        label:     RENEWABLE_SOURCE_LABELS[key] ?? key,
        efTco2Mwh: ef,
      })),
      cbamCountryEf: Object.entries(CBAM_COUNTRY_EF).map(([country, ef]) => ({
        country,
        efTco2Mwh: ef,
      })),
    });
  });

  // ── GET /cbam/grid-ef?country=TR&year=2024 ────────────────────────────────
  app.get("/cbam/grid-ef", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const { country, year } = request.query as { country?: string; year?: string };
    if (!country || !year) return reply.status(400).send({ error: "country ve year zorunlu" });

    const yr = parseInt(year);
    if (isNaN(yr)) return reply.status(400).send({ error: "Geçersiz year" });

    const result = await prisma.$queryRaw<{ avg_ef: string | null }[]>(
      Prisma.sql`
        SELECT ROUND(AVG(ci_lifecycle)::numeric, 4) AS avg_ef
        FROM emission_factors
        WHERE country = ${country}
          AND granularity = 'hourly'
          AND EXTRACT(YEAR FROM hour) = ${yr}
      `
    );

    const avgGco2kWh = result[0]?.avg_ef != null ? parseFloat(result[0].avg_ef) : null;
    const efTco2Mwh  = avgGco2kWh != null ? Math.round(avgGco2kWh * 0.001 * 10000) / 10000 : null;

    return reply.send({
      country,
      year:    yr,
      efTco2Mwh,
      hasData: efTco2Mwh != null,
      source:  efTco2Mwh != null ? "ENTSO-E A75 (IPCC AR6 medyan)" : null,
    });
  });
};
