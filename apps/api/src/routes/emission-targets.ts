import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const emissionTargetsRoutes: FastifyPluginAsync = async (app) => {

  // GET /emission-targets — tenant'ın tüm hedefleri (filtre: year, installationId)
  app.get("/emission-targets", async (request, reply) => {
    if (!request.userId && !request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const { year, installationId } = request.query as { year?: string; installationId?: string };

    const targets = await prisma.emissionTarget.findMany({
      where: {
        tenantId:       request.tenantId,
        ...(year           ? { year: parseInt(year) }   : {}),
        ...(installationId ? { installationId }          : {}),
      },
      orderBy: [{ year: "desc" }, { metric: "asc" }],
      include: { installation: { select: { facilityName: true, facilityCountry: true } } },
    });

    return reply.send({ targets });
  });

  // POST /emission-targets — hedef oluştur/güncelle (upsert)
  app.post("/emission-targets", {
    schema: {
      body: {
        type: "object",
        required: ["year", "metric", "targetValue"],
        properties: {
          year:           { type: "integer", minimum: 2020, maximum: 2100 },
          metric:         { type: "string", enum: ["see_voltfox", "scope2_tco2", "reduction_pct"] },
          targetValue:    { type: "number" },
          baselineValue:  { type: "number" },
          installationId: { type: "string" },
          notes:          { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!request.userId && !request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const body = request.body as {
      year: number; metric: string; targetValue: number;
      baselineValue?: number; installationId?: string; notes?: string;
    };

    // Nullable installationId — manual upsert (Prisma unique where requires non-null)
    const existing = await prisma.emissionTarget.findFirst({
      where: {
        tenantId:       request.tenantId,
        installationId: body.installationId ?? null,
        year:           body.year,
        metric:         body.metric,
      },
    });

    const target = existing
      ? await prisma.emissionTarget.update({
          where: { id: existing.id },
          data: {
            targetValue:   body.targetValue,
            baselineValue: body.baselineValue ?? null,
            notes:         body.notes ?? null,
          },
        })
      : await prisma.emissionTarget.create({
          data: {
            tenantId:       request.tenantId,
            installationId: body.installationId ?? null,
            year:           body.year,
            metric:         body.metric,
            targetValue:    body.targetValue,
            baselineValue:  body.baselineValue ?? null,
            notes:          body.notes ?? null,
          },
        });

    return reply.status(201).send(target);
  });

  // DELETE /emission-targets/:id — hedefi sil
  app.delete("/emission-targets/:id", async (request, reply) => {
    if (!request.userId && !request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const { id } = request.params as { id: string };

    await prisma.emissionTarget.deleteMany({
      where: { id, tenantId: request.tenantId },
    });

    return reply.status(204).send();
  });

  // GET /emission-targets/progress — hedef vs gerçekleşen karşılaştırma
  app.get("/emission-targets/progress", async (request, reply) => {
    if (!request.userId && !request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const { year } = request.query as { year?: string };
    const targetYear = year ? parseInt(year) : new Date().getFullYear();

    const targets = await prisma.emissionTarget.findMany({
      where: { tenantId: request.tenantId, year: targetYear },
      include: { installation: { select: { facilityName: true } } },
    });

    // Gerçekleşen değerleri hesapla: target yılına ait dönemlerin ortalama SEE değerleri
    const actuals = await prisma.embeddedEmission.findMany({
      where: {
        period: {
          reportYear:   targetYear,
          installation: { tenantId: request.tenantId },
        },
      },
      include: {
        period: {
          select: {
            installationId: true,
            installation:   { select: { facilityName: true } },
          },
        },
      },
    });

    // Installation bazında ortalama SEE hesapla
    const actualByInst = new Map<string, { seeAvg: number; scope2Avg: number; reductionAvg: number; count: number }>();

    for (const a of actuals) {
      const instId = a.period.installationId;
      const curr   = actualByInst.get(instId) ?? { seeAvg: 0, scope2Avg: 0, reductionAvg: 0, count: 0 };
      actualByInst.set(instId, {
        seeAvg:       (curr.seeAvg * curr.count + a.seeVoltfox) / (curr.count + 1),
        scope2Avg:    (curr.scope2Avg * curr.count + a.scope2VoltfoxTco2) / (curr.count + 1),
        reductionAvg: (curr.reductionAvg * curr.count + a.reductionPct) / (curr.count + 1),
        count:        curr.count + 1,
      });
    }

    const progress = targets.map(t => {
      const instId = t.installationId ?? "__all__";
      const actual = t.installationId ? actualByInst.get(t.installationId) : null;

      let actualValue: number | null = null;
      if (actual) {
        if (t.metric === "see_voltfox")    actualValue = actual.seeAvg;
        if (t.metric === "scope2_tco2")    actualValue = actual.scope2Avg;
        if (t.metric === "reduction_pct")  actualValue = actual.reductionAvg;
      }

      const targetVal   = Number(t.targetValue);
      const achievement = actualValue != null
        ? t.metric === "see_voltfox" || t.metric === "scope2_tco2"
          ? ((targetVal - actualValue) / targetVal) * 100  // lower is better
          : (actualValue / targetVal) * 100                 // higher is better
        : null;

      return {
        id:             t.id,
        year:           t.year,
        metric:         t.metric,
        targetValue:    targetVal,
        baselineValue:  t.baselineValue != null ? Number(t.baselineValue) : null,
        actualValue,
        achievementPct: achievement,
        installationId: t.installationId,
        facilityName:   t.installation?.facilityName ?? "Tüm Tesisler",
        notes:          t.notes,
      };
    });

    return reply.send({ year: targetYear, progress });
  });
};
