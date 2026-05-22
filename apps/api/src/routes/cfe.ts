import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { calculateCFEMatching } from "../../../../src/cbam/cfe-matching.js";
import type { HourlySlot } from "../../../../src/cbam/cfe-matching.js";
import { buildCfeCertificate } from "../lib/pdf-cfe-certificate.js";
import { dispatchWebhookEvent } from "./webhooks.js";
import { notifyTenant } from "../lib/notify.js";
import { emailCfeDone } from "../lib/email.js";

export const cfeRoutes: FastifyPluginAsync = async (app) => {

  // POST /installations/:installationId/periods/:periodId/cfe
  // Saatlik üretim + tüketim verisi alır, CFE matching hesaplar ve kaydeder
  app.post("/installations/:installationId/periods/:periodId/cfe", {
    schema: {
      body: {
        type: "object",
        required: ["slots"],
        properties: {
          slots: {
            type: "array",
            minItems: 1,
            maxItems: 8784, // artık yıl
            items: {
              type: "object",
              required: ["hour", "consumptionKwh", "productionKwh"],
              properties: {
                hour:            { type: "string" },
                consumptionKwh:  { type: "number", minimum: 0 },
                productionKwh:   { type: "number", minimum: 0 },
              },
            },
          },
          gecDataVersion: { type: "string" },
        },
      },
    },
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
      include: { installation: { select: { facilityName: true } } },
    });
    if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

    const body = request.body as {
      slots: HourlySlot[];
      gecDataVersion?: string;
    };

    const result = calculateCFEMatching({
      installationId,
      periodLabel: period.periodName,
      slots: body.slots,
      gecDataVersion: body.gecDataVersion,
    });

    const stored = await prisma.$transaction(async (tx) => {
      const cfe = await tx.cFEMatchingResult.upsert({
        where:  { periodId },
        create: {
          periodId,
          totalConsumptionKwh: result.totalConsumptionKwh,
          totalProductionKwh:  result.totalProductionKwh,
          totalMatchedKwh:     result.totalMatchedKwh,
          cfeScore:            result.cfeScore,
          ppaSurplusKwh:       result.ppaSurplusKwh,
          ppaDeficitKwh:       result.ppaDeficitKwh,
          matchedHours:        result.matchedHours,
          partialHours:        result.partialHours,
          unmatchedHours:      result.unmatchedHours,
          monthlyBreakdown:    result.monthlyBreakdown as object[],
          gecDataVersion:      result.gecDataVersion,
        },
        update: {
          totalConsumptionKwh: result.totalConsumptionKwh,
          totalProductionKwh:  result.totalProductionKwh,
          totalMatchedKwh:     result.totalMatchedKwh,
          cfeScore:            result.cfeScore,
          ppaSurplusKwh:       result.ppaSurplusKwh,
          ppaDeficitKwh:       result.ppaDeficitKwh,
          matchedHours:        result.matchedHours,
          partialHours:        result.partialHours,
          unmatchedHours:      result.unmatchedHours,
          monthlyBreakdown:    result.monthlyBreakdown as object[],
          gecDataVersion:      result.gecDataVersion,
          calculatedAt:        new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId:   request.tenantId,
          userId:     request.userId ?? undefined,
          action:     "CALCULATE",
          resource:   "CFEMatchingResult",
          resourceId: periodId,
          payload:    {
            totalHours: result.totalHours,
            cfeScore:   result.cfeScore,
            gecDataVersion: result.gecDataVersion,
          },
        },
      });

      return cfe;
    });

    // Fire-and-forget webhook (cfe.completed)
    dispatchWebhookEvent(request.tenantId, "cfe.completed", {
      periodId,
      installationId,
      cfeScore:            result.cfeScore,
      totalConsumptionKwh: result.totalConsumptionKwh,
      totalMatchedKwh:     result.totalMatchedKwh,
      matchedHours:        result.matchedHours,
      calculatedAt:        stored.calculatedAt,
    }).catch(() => {});

    // Fire-and-forget in-app + email notification
    notifyTenant({
      tenantId:   request.tenantId,
      eventType:  "cfeDone",
      title:      `CFE eşleştirme tamamlandı: ${period.periodName}`,
      body:       `${period.installation.facilityName} · CFE Skoru %${(result.cfeScore * 100).toFixed(1)}`,
      resource:   "CFEMatchingResult",
      resourceId: stored.id,
      emailFactory: (_uid, _email) => emailCfeDone({
        facilityName:   period.installation.facilityName,
        periodName:     period.periodName,
        cfeScore:       result.cfeScore,
        appUrl:         process.env.APP_URL ?? "https://app.voltfox.io",
        installationId,
        periodId,
      }),
    }).catch(() => {});

    return reply.status(201).send({
      stored,
      summary: {
        cfeScore:           result.cfeScore,
        totalConsumptionKwh: result.totalConsumptionKwh,
        totalMatchedKwh:    result.totalMatchedKwh,
        matchedHours:       result.matchedHours,
        partialHours:       result.partialHours,
        unmatchedHours:     result.unmatchedHours,
        monthlyBreakdown:   result.monthlyBreakdown,
      },
    });
  });

  // GET /installations/:installationId/periods/:periodId/cfe/certificate
  // Returns CFE PDF sertifikası — indirilebilir
  app.get("/installations/:installationId/periods/:periodId/cfe/certificate", async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string; periodId: string;
    };
    const { eacRef } = request.query as { eacRef?: string };

    const result = await prisma.cFEMatchingResult.findFirst({
      where: {
        periodId,
        period: { installationId, installation: { tenantId: request.tenantId } },
      },
      include: { period: { include: { installation: true } } },
    });

    if (!result) {
      return reply.status(404).send({ error: "NOT_FOUND", message: "CFE sonucu bulunamadı." });
    }

    const { period } = result;
    const { installation } = period;

    const monthly = (result.monthlyBreakdown as Array<{
      month: string; consumptionKwh: number; productionKwh: number;
      matchedKwh: number; cfeRate: number;
    }>);

    const filename = `voltfox-cfe-${installation.facilityRef ?? installationId.slice(0, 8)}-${period.reportYear}.pdf`;
    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = buildCfeCertificate({
      facility: {
        name:            installation.facilityName,
        operator:        installation.operator,
        country:         installation.facilityCountry,
        installationRef: installation.facilityRef ?? null,
      },
      period: {
        name:       period.periodName,
        startDate:  period.startDate,
        endDate:    period.endDate,
        reportYear: period.reportYear,
      },
      result: {
        cfeScore:             result.cfeScore,
        totalConsumptionKwh:  result.totalConsumptionKwh,
        totalProductionKwh:   result.totalProductionKwh,
        totalMatchedKwh:      result.totalMatchedKwh,
        matchedHours:         result.matchedHours,
        partialHours:         result.partialHours,
        unmatchedHours:       result.unmatchedHours,
        gecDataVersion:       result.gecDataVersion,
        calculatedAt:         result.calculatedAt,
        monthlyBreakdown:     monthly,
      },
      eacReference: eacRef ?? null,
    });

    return reply.send(stream);
  });

  // GET /installations/:installationId/periods/:periodId/cfe
  app.get("/installations/:installationId/periods/:periodId/cfe", async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string; periodId: string;
    };

    const result = await prisma.cFEMatchingResult.findFirst({
      where: {
        periodId,
        period: {
          installationId,
          installation: { tenantId: request.tenantId },
        },
      },
    });

    if (!result) return reply.status(404).send({
      error: "NOT_FOUND",
      message: "Henüz CFE eşleştirme sonucu yok. POST ile saatlik veri gönderin.",
    });

    return reply.send(result);
  });
};
