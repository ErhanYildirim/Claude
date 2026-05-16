import { createReadStream } from "fs";
import { parse } from "csv-parse";
import type { FastifyPluginAsync } from "fastify";
import multipart from "@fastify/multipart";
import { prisma } from "@voltfox/db";
import { calculateCFEMatching } from "../../../../src/cbam/cfe-matching.js";

interface SlotRow {
  timestamp: string;
  consumption_kwh: number;
  production_kwh:  number;
}

function parseRows(csvText: string): Promise<{ rows: SlotRow[]; errors: string[] }> {
  return new Promise((resolve) => {
    const rows: SlotRow[] = [];
    const errors: string[] = [];
    let lineNum = 0;

    const parser = parse(csvText, {
      columns:          true,
      skip_empty_lines: true,
      trim:             true,
    });

    parser.on("data", (rec: Record<string, string>) => {
      lineNum++;
      const ts  = rec["timestamp"];
      const con = parseFloat(rec["consumption_kwh"]);
      const pro = parseFloat(rec["production_kwh"]);

      if (!ts || isNaN(con) || isNaN(pro)) {
        errors.push(`Satır ${lineNum + 1}: geçersiz veri (timestamp="${ts}", consumption="${rec["consumption_kwh"]}", production="${rec["production_kwh"]}")`);
        return;
      }
      if (con < 0 || pro < 0) {
        errors.push(`Satır ${lineNum + 1}: negatif değer (consumption=${con}, production=${pro})`);
        return;
      }
      const date = new Date(ts);
      if (isNaN(date.getTime())) {
        errors.push(`Satır ${lineNum + 1}: geçersiz timestamp formatı "${ts}"`);
        return;
      }

      rows.push({ timestamp: date.toISOString(), consumption_kwh: con, production_kwh: pro });
    });

    parser.on("end", () => resolve({ rows, errors }));
    parser.on("error", (err) => {
      errors.push(`CSV parse hatası: ${err.message}`);
      resolve({ rows, errors });
    });
  });
}

export const cfeImportRoutes: FastifyPluginAsync = async (app) => {
  // Register multipart plugin (only if not already registered)
  if (!app.hasContentTypeParser("multipart/form-data")) {
    await app.register(multipart, { limits: { fileSize: 10 * 1024 * 1024 } }); // 10 MB
  }

  /**
   * POST /installations/:installationId/periods/:periodId/cfe/import
   * Content-Type: multipart/form-data
   * Field: file (CSV, beklenen başlıklar: timestamp, consumption_kwh, production_kwh)
   */
  app.post(
    "/installations/:installationId/periods/:periodId/cfe/import",
    { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } },
    async (request, reply) => {
      const { installationId, periodId } = request.params as {
        installationId: string;
        periodId: string;
      };

      // Tenant + period erişim kontrolü
      const period = await prisma.reportingPeriod.findFirst({
        where: {
          id: periodId,
          installationId,
          installation: { tenantId: request.tenantId },
        },
      });
      if (!period) return reply.status(404).send({ error: "NOT_FOUND" });

      // Dosyayı oku
      const data = await request.file();
      if (!data) return reply.status(400).send({ error: "MISSING_FILE", message: "CSV dosyası gerekli." });

      const mimeOk = data.mimetype === "text/csv" || data.mimetype === "application/vnd.ms-excel"
        || data.filename?.endsWith(".csv");
      if (!mimeOk) {
        return reply.status(400).send({ error: "INVALID_FORMAT", message: "Yalnızca CSV dosyası kabul edilir." });
      }

      const chunks: Buffer[] = [];
      for await (const chunk of data.file) chunks.push(chunk);
      const csvText = Buffer.concat(chunks).toString("utf-8");

      if (!csvText.includes("timestamp")) {
        return reply.status(400).send({
          error: "INVALID_HEADERS",
          message: "CSV başlıkları: timestamp, consumption_kwh, production_kwh",
        });
      }

      const { rows, errors } = await parseRows(csvText);

      if (rows.length === 0) {
        return reply.status(422).send({
          error: "NO_VALID_ROWS",
          message: "Geçerli satır bulunamadı.",
          errors,
        });
      }

      // Sıralama kontrolü
      for (let i = 1; i < rows.length; i++) {
        if (rows[i].timestamp <= rows[i - 1].timestamp) {
          return reply.status(422).send({
            error: "NOT_SORTED",
            message: `Satırlar artan zaman sırasında olmalı. Sorun: ${rows[i - 1].timestamp} → ${rows[i].timestamp}`,
            errors,
          });
        }
      }

      // CFE hesapla
      const result = calculateCFEMatching({
        periodId,
        slots: rows.map(r => ({
          timestamp:       r.timestamp,
          consumptionKwh:  r.consumption_kwh,
          productionKwh:   r.production_kwh,
        })),
        gecDataVersion: process.env.CBAM_DATA_VERSION ?? "20260204",
      });

      // Kaydet
      const [stored] = await prisma.$transaction([
        prisma.cFEMatchingResult.upsert({
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
            monthlyBreakdown:    result.monthlyBreakdown,
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
            monthlyBreakdown:    result.monthlyBreakdown,
            gecDataVersion:      result.gecDataVersion,
            calculatedAt:        new Date(),
          },
        }),
        prisma.auditLog.create({
          data: {
            tenantId:   request.tenantId,
            userId:     request.userId ?? undefined,
            action:     "IMPORT_CFE_CSV",
            resource:   "CFEMatchingResult",
            resourceId: periodId,
            payload:    { rowCount: rows.length, errorCount: errors.length },
          },
        }),
      ]);

      return reply.status(201).send({
        result:    stored,
        rowCount:  rows.length,
        errorCount: errors.length,
        errors:    errors.slice(0, 20), // ilk 20 hatayı döndür
      });
    }
  );
};
