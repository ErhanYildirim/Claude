import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { buildPdfReport } from "../lib/pdf-report.js";

function escapeXml(val: unknown): string {
  return String(val ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

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

      cbamDefaultComparison: emission.defaultSee !== null ? (() => {
        const actualSee = emission.seeVoltfox ?? emission.seeBaseline;
        const imp = emission.defaultSee - actualSee;
        return {
          defaultSee:      emission.defaultSee,
          actualSee,
          improvementTco2PerTonne: imp,
          improvementPct:  (imp / emission.defaultSee) * 100,
          carbonPriceEur:  period.carbonPriceEur ?? null,
          annualSavingsEur: emission.savingsVsDefaultEur ?? null,
        };
      })() : null,

      dataLineage: {
        calcEngineVersion: emission.calcEngineVersion,
        calcMethodology:   emission.calcMethodology,
        efDataVersion:     emission.efDataVersion,
        calculatedAt:      emission.calculatedAt.toISOString(),
      },
    };

    const ref = installation.facilityRef ?? installationId.slice(0, 8);
    const format = (request.query as { format?: string }).format ?? "json";

    if (format === "xml") {
      const x = (val: unknown) => escapeXml(val);
      const xml = `<?xml version="1.0" encoding="UTF-8"?>
<CBAMTechnicalFile xmlns="urn:voltfox:cbam:1.0"
  schemaVersion="1.0"
  regulation="EU 2023/1773 Annex IV Method A"
  generatedAt="${x(doc.generatedAt)}"
  generatedBy="Voltfox Platform">

  <Facility>
    <Name>${x(doc.facility.name)}</Name>
    <Operator>${x(doc.facility.operator)}</Operator>
    <Country>${x(doc.facility.country)}</Country>
    <Sector>${x(doc.facility.sector)}</Sector>
    <InstallationRef>${x(doc.facility.installationRef)}</InstallationRef>
  </Facility>

  <ReportingPeriod>
    <Name>${x(doc.reportingPeriod.name)}</Name>
    <StartDate>${x(doc.reportingPeriod.startDate)}</StartDate>
    <EndDate>${x(doc.reportingPeriod.endDate)}</EndDate>
    <ReportYear>${x(doc.reportingPeriod.reportYear)}</ReportYear>
    <ImportCountry>${x(doc.reportingPeriod.importCountry)}</ImportCountry>
    <CnCode>${x(doc.reportingPeriod.cnCode)}</CnCode>
    <ProductionVolumeTonne>${x(doc.reportingPeriod.productionVolumeTonne)}</ProductionVolumeTonne>
  </ReportingPeriod>

  <Scope1DirectEmissions>
    <TotalTco2>${x(doc.scope1DirectEmissions.tco2)}</TotalTco2>
    <DataQuality>${x(doc.scope1DirectEmissions.dataQuality)}</DataQuality>
    <AuditNote>${x(doc.scope1DirectEmissions.auditNote)}</AuditNote>
  </Scope1DirectEmissions>

  <Scope2IndirectEmissions methodology="${x(doc.scope2IndirectEmissions.methodology)}">
    <ElectricityConsumedKwh>${x(doc.scope2IndirectEmissions.electricityConsumedKwh)}</ElectricityConsumedKwh>
    <BaselineEfTco2PerMwh>${x(doc.scope2IndirectEmissions.baselineEfTco2PerMwh)}</BaselineEfTco2PerMwh>
    <CfeMatchingRatePct>${x(doc.scope2IndirectEmissions.cfeMatchingRatePct)}</CfeMatchingRatePct>
    <RenewableEfTco2PerMwh>${x(doc.scope2IndirectEmissions.renewableEfTco2PerMwh)}</RenewableEfTco2PerMwh>
    <BaselineTco2>${x(doc.scope2IndirectEmissions.baselineTco2)}</BaselineTco2>
    <ActualTco2>${x(doc.scope2IndirectEmissions.actualTco2)}</ActualTco2>
    <ReductionTco2>${x(doc.scope2IndirectEmissions.reductionTco2)}</ReductionTco2>
    <ReductionPct>${x(doc.scope2IndirectEmissions.reductionPct)}</ReductionPct>
  </Scope2IndirectEmissions>

  <SpecificEmbeddedEmission unit="${x(doc.specificEmbeddedEmission.unit)}">
    <Baseline>${x(doc.specificEmbeddedEmission.baseline)}</Baseline>
    <Actual>${x(doc.specificEmbeddedEmission.actual)}</Actual>
    <ReductionPct>${x(doc.specificEmbeddedEmission.reductionPct)}</ReductionPct>
  </SpecificEmbeddedEmission>

  ${doc.cbamDefaultComparison ? `<CbamDefaultComparison>
    <DefaultSee>${x(doc.cbamDefaultComparison.defaultSee)}</DefaultSee>
    <ActualSee>${x(doc.cbamDefaultComparison.actualSee)}</ActualSee>
    <ImprovementTco2PerTonne>${x(doc.cbamDefaultComparison.improvementTco2PerTonne)}</ImprovementTco2PerTonne>
    <ImprovementPct>${x(doc.cbamDefaultComparison.improvementPct.toFixed(2))}</ImprovementPct>
    <CarbonPriceEur>${x(doc.cbamDefaultComparison.carbonPriceEur)}</CarbonPriceEur>
    <AnnualSavingsEur>${x(doc.cbamDefaultComparison.annualSavingsEur)}</AnnualSavingsEur>
  </CbamDefaultComparison>` : "<CbamDefaultComparison/>"}

  <DataLineage>
    <CalcEngineVersion>${x(doc.dataLineage.calcEngineVersion)}</CalcEngineVersion>
    <CalcMethodology>${x(doc.dataLineage.calcMethodology)}</CalcMethodology>
    <EfDataVersion>${x(doc.dataLineage.efDataVersion)}</EfDataVersion>
    <CalculatedAt>${x(doc.dataLineage.calculatedAt)}</CalculatedAt>
  </DataLineage>

</CBAMTechnicalFile>`;

      const xmlFilename = `voltfox-cbam-${ref}-${period.reportYear}.xml`;
      reply.header("Content-Type", "application/xml; charset=utf-8");
      reply.header("Content-Disposition", `attachment; filename="${xmlFilename}"`);
      return reply.send(xml);
    }

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
