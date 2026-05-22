import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

// CBAM sektör referans SEE değerleri (tCO₂/MWh) — Ek IV literatür ortalamaları
const SECTOR_BENCHMARKS: Record<string, { p25: number; median: number; p75: number; best: number; unit: string }> = {
  steel:       { p25: 0.280, median: 0.380, p75: 0.520, best: 0.110, unit: "tCO₂/MWh" },
  aluminium:   { p25: 0.320, median: 0.450, p75: 0.620, best: 0.090, unit: "tCO₂/MWh" },
  cement:      { p25: 0.350, median: 0.480, p75: 0.650, best: 0.150, unit: "tCO₂/MWh" },
  fertilizer:  { p25: 0.200, median: 0.310, p75: 0.440, best: 0.080, unit: "tCO₂/MWh" },
  electricity: { p25: 0.150, median: 0.280, p75: 0.420, best: 0.020, unit: "tCO₂/MWh" },
  chemicals:   { p25: 0.260, median: 0.370, p75: 0.500, best: 0.100, unit: "tCO₂/MWh" },
  hydrogen:    { p25: 0.190, median: 0.320, p75: 0.480, best: 0.025, unit: "tCO₂/MWh" },
};

export const benchmarkRoutes: FastifyPluginAsync = async (app) => {

  // GET /benchmark — tenant'ın tüm tesisleri için sektör benchmark
  app.get("/benchmark", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const installations = await prisma.installation.findMany({
      where: { tenantId: request.tenantId },
      select: {
        id: true, facilityName: true, facilityCountry: true, sector: true,
        periods: {
          where:   { result: { isNot: null } },
          orderBy: { reportYear: "desc" },
          take:    1,
          select: {
            reportYear:     true,
            periodName:     true,
            electricityKwh: true,
            result: {
              select: {
                seeVoltfox:  true,
                seeBaseline: true,
                defaultSee:  true,
              },
            },
          },
        },
      },
    });

    const results = installations.map(inst => {
      const latestPeriod = inst.periods[0] ?? null;
      const emission     = latestPeriod?.result ?? null;
      const sector       = inst.sector?.toLowerCase() ?? "steel";
      const benchmark    = SECTOR_BENCHMARKS[sector] ?? SECTOR_BENCHMARKS["steel"];

      const seeVoltfox = emission?.seeVoltfox != null ? Number(emission.seeVoltfox) : null;

      let percentile: string | null = null;
      let vsMedian:   number | null = null;
      if (seeVoltfox != null) {
        vsMedian = ((benchmark.median - seeVoltfox) / benchmark.median) * 100;
        if (seeVoltfox <= benchmark.best * 1.2)    percentile = "top10";
        else if (seeVoltfox <= benchmark.p25)       percentile = "top25";
        else if (seeVoltfox <= benchmark.median)    percentile = "median";
        else if (seeVoltfox <= benchmark.p75)       percentile = "below_median";
        else                                        percentile = "bottom25";
      }

      return {
        installationId:  inst.id,
        facilityName:    inst.facilityName,
        facilityCountry: inst.facilityCountry,
        sector,
        latestYear:      latestPeriod?.reportYear ?? null,
        periodName:      latestPeriod?.periodName ?? null,
        seeVoltfox,
        seeBaseline:     emission?.seeBaseline != null ? Number(emission.seeBaseline) : null,
        defaultSee:      emission?.defaultSee  != null ? Number(emission.defaultSee)  : null,
        benchmark,
        percentile,
        vsMedianPct:     vsMedian != null ? Math.round(vsMedian * 10) / 10 : null,
      };
    });

    return reply.send({ results, benchmarks: SECTOR_BENCHMARKS });
  });

  // GET /benchmark/sectors — tüm sektör referans değerleri
  app.get("/benchmark/sectors", { config: { public: true } }, async (_request, reply) => {
    return reply.send({ benchmarks: SECTOR_BENCHMARKS });
  });
};
