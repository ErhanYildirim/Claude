import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { buildPdfReport } from "../lib/pdf-report.js";

export const reportsRoutes: FastifyPluginAsync = async (app) => {

  // GET /installations/:installationId/periods/:periodId/export?format=json
  // Returns CBAM Ek-IV uyumlu JSON teknik dosyası (makine okunabilir)
  app.get("/installations/:installationId/periods/:periodId/export", async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string;
      periodId: string;
    };

    const emission = await prisma.embeddedEmission.findFirst({
      where: {
        periodId,
        period: { installationId, installation: { tenantId: request.tenantId } },
      },
      include: { period: { include: { installation: true } } },
    });

    if (!emission) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: "Hesaplanmış sonuç bulunamadı. Önce SEE Hesapla çalıştırın.",
      });
    }

    const { period } = emission;
    const { installation } = period;

    const doc = {
      documentType: "CBAM_TECHNICAL_FILE",
      schemaVersion: "1.0",
      regulation: "EU 2023/1773 — Annex IV Method A",
      generatedAt: new Date().toISOString(),
      generatedBy: "Voltfox Platform",

      facility: {
        name:          installation.facilityName,
        operator:      installation.operator,
        country:       installation.facilityCountry,
        sector:        (installation as { sector?: string }).sector ?? null,
        installationRef: installation.facilityRef ?? null,
      },

      reportingPeriod: {
        name:          period.periodName,
        startDate:     period.startDate.toISOString().slice(0, 10),
        endDate:       period.endDate.toISOString().slice(0, 10),
        reportYear:    period.reportYear,
        importCountry: period.importCountry,
        cnCode:        period.cnCode,
        productionVolumeTonne: period.prodVolumeTonne,
      },

      scope1DirectEmissions: {
        tco2:        period.scope1DirectTco2,
        dataQuality: period.scope1Quality,
        auditNote:   period.scope1AuditNote ?? null,
      },

      scope2IndirectEmissions: {
        methodology:          "location_based_with_24_7_cfe_matching",
        electricityConsumedKwh: period.electricityKwh,
        electricitySourceNote:  period.electricitySource,
        baselineEfTco2PerMwh:   period.baselineEf,
        cfeMatchingRatePct:     period.matchingRatePct,
        renewableEfTco2PerMwh:  period.renewableEf,
        baselineTco2:           emission.scope2BaselineTco2,
        actualTco2:             emission.scope2VoltfoxTco2,
        reductionTco2:          emission.reductionTco2,
        reductionPct:           emission.reductionPct,
      },

      specificEmbeddedEmission: {
        baseline: emission.seeBaseline,
        actual:   emission.seeVoltfox,
        unit:     "tCO2e_per_tonne_product",
        reductionPct: emission.reductionPct,
      },

      cbamDefaultComparison: emission.defaultSee !== null ? {
        defaultSee:      emission.defaultSee,
        actualSee:       emission.seeVoltfox,
        improvementTco2PerTonne: emission.defaultSee - emission.seeVoltfox,
        improvementPct:  ((emission.defaultSee - emission.seeVoltfox) / emission.defaultSee * 100),
        carbonPriceEur:  period.carbonPriceEur ?? null,
        annualSavingsEur: emission.savingsVsDefaultEur ?? null,
      } : null,

      dataLineage: {
        calcEngineVersion: emission.calcEngineVersion,
        calcMethodology:   emission.calcMethodology,
        efDataVersion:     emission.efDataVersion,
        calculatedAt:      emission.calculatedAt.toISOString(),
      },
    };

    const ref = installation.facilityRef ?? installationId.slice(0, 8);
    const filename = `voltfox-cbam-${ref}-${period.reportYear}.json`;
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);
    return reply.send(doc);
  });

  // GET /installations/:installationId/periods/:periodId/report
  // Returns CBAM Ek-IV uyumlu PDF teknik dosya
  app.get("/installations/:installationId/periods/:periodId/report", async (request, reply) => {
    const { installationId, periodId } = request.params as {
      installationId: string;
      periodId: string;
    };

    const emission = await prisma.embeddedEmission.findFirst({
      where: {
        periodId,
        period: {
          installationId,
          installation: { tenantId: request.tenantId },
        },
      },
      include: {
        period: {
          include: {
            installation: true,
          },
        },
      },
    });

    if (!emission) {
      return reply.status(404).send({
        error: "NOT_FOUND",
        message: "Hesaplanmış sonuç bulunamadı. Önce /calculate çalıştırın.",
      });
    }

    const { period } = emission;
    const { installation } = period;

    const filename = `voltfox-cbam-${installation.facilityRef ?? installationId.slice(0, 8)}-${period.reportYear}.pdf`;

    reply.header("Content-Type", "application/pdf");
    reply.header("Content-Disposition", `attachment; filename="${filename}"`);

    const stream = buildPdfReport({
      installation: {
        facilityName:    installation.facilityName,
        operator:        installation.operator,
        facilityCountry: installation.facilityCountry,
        facilityRef:     installation.facilityRef,
        sector:          (installation as { sector?: string }).sector,
      },
      period: {
        periodName:       period.periodName,
        startDate:        period.startDate,
        endDate:          period.endDate,
        reportYear:       period.reportYear,
        importCountry:    period.importCountry,
        cnCode:           period.cnCode,
        prodVolumeTonne:  period.prodVolumeTonne,
        scope1DirectTco2: period.scope1DirectTco2,
        scope1Quality:    period.scope1Quality,
        scope1AuditNote:  period.scope1AuditNote,
        electricityKwh:   period.electricityKwh,
        electricitySource:period.electricitySource,
        baselineEf:       period.baselineEf,
        renewableEf:      period.renewableEf,
        matchingRatePct:  period.matchingRatePct,
        carbonPriceEur:   period.carbonPriceEur,
      },
      result: {
        scope2BaselineTco2:  emission.scope2BaselineTco2,
        scope2VoltfoxTco2:   emission.scope2VoltfoxTco2,
        reductionTco2:       emission.reductionTco2,
        reductionPct:        emission.reductionPct,
        seeBaseline:         emission.seeBaseline,
        seeVoltfox:          emission.seeVoltfox,
        defaultSee:          emission.defaultSee,
        savingsVsDefaultEur: emission.savingsVsDefaultEur,
        calcEngineVersion:   emission.calcEngineVersion,
        calcMethodology:     emission.calcMethodology,
        efDataVersion:       emission.efDataVersion,
        calculatedAt:        emission.calculatedAt,
      },
    });

    return reply.send(stream);
  });
};
