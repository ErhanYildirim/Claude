import type { FastifyPluginAsync } from "fastify";
import { buildWizardPdf, type WizardPdfData } from "../lib/pdf-wizard.js";

export const cbamWizardPdfRoutes: FastifyPluginAsync = async (app) => {

  app.post(
    "/cbam/wizard-pdf",
    {
      schema: {
        body: {
          type: "object",
          required: ["sector", "cnCode", "country", "periodName", "prodVolume",
                     "fuels", "processes", "elecKwh", "elecEf",
                     "scope1FuelTco2", "scope1ProcTco2", "scope1TotalTco2",
                     "scope2Tco2", "totalTco2", "seeActual", "carbonPrice"],
          properties: {
            sector:          { type: "string" },
            cnCode:          { type: "string" },
            country:         { type: "string" },
            periodName:      { type: "string" },
            prodVolume:      { type: "number" },
            fuels:           { type: "array" },
            processes:       { type: "array" },
            elecKwh:         { type: "number" },
            elecEf:          { type: "number" },
            gecConnected:    { type: "boolean" },
            scope1FuelTco2:  { type: "number" },
            scope1ProcTco2:  { type: "number" },
            scope1TotalTco2: { type: "number" },
            scope2Tco2:      { type: "number" },
            totalTco2:       { type: "number" },
            seeActual:       { type: "number" },
            seeDefault:      { type: ["number", "null"] },
            savingsPerTonne: { type: ["number", "null"] },
            savingsTco2:     { type: ["number", "null"] },
            savingsEur:      { type: ["number", "null"] },
            carbonPrice:     { type: "number" },
          },
        },
      },
    },
    async (request, reply) => {
      const body = request.body as WizardPdfData & { gecConnected?: boolean };
      const data: WizardPdfData = {
        ...body,
        gecConnected: body.gecConnected ?? false,
        generatedAt:  new Date(),
      };

      const stream = buildWizardPdf(data);

      const safeCode = data.cnCode.replace(/[^a-zA-Z0-9]/g, "-");
      const filename = `cbam-teknik-dosya-${data.periodName.replace(/\s+/g, "-")}-${safeCode}.pdf`;

      void reply.header("Content-Type", "application/pdf");
      void reply.header("Content-Disposition", `attachment; filename="${filename}"`);

      return reply.send(stream);
    },
  );
};
