import type { FastifyPluginAsync } from "fastify";
import { prisma, Prisma } from "@voltfox/db";
import { runEfImport } from "../ef.js";

type ZoneRow   = { zone_id: string; zone_name: string; country: string; last_hour: Date | null };
type CountRow  = { cnt: bigint };

export const adminEfRoutes: FastifyPluginAsync = async (app) => {

  // GET /ef/zones — tüm EF zone'larını listele (raw SQL, emission_factors tablosundan)
  app.get("/ef/zones", async (request, reply) => {
    const { search } = request.query as { search?: string };

    const zones = await prisma.$queryRaw<ZoneRow[]>(
      search
        ? Prisma.sql`
            SELECT zone_id, zone_name, country, MAX(hour) AS last_hour
            FROM emission_factors
            WHERE zone_id ILIKE ${"%" + search + "%"}
               OR zone_name ILIKE ${"%" + search + "%"}
               OR country ILIKE ${"%" + search + "%"}
            GROUP BY zone_id, zone_name, country
            ORDER BY country ASC, zone_id ASC
            LIMIT 200`
        : Prisma.sql`
            SELECT zone_id, zone_name, country, MAX(hour) AS last_hour
            FROM emission_factors
            GROUP BY zone_id, zone_name, country
            ORDER BY country ASC, zone_id ASC
            LIMIT 200`
    );

    return reply.send({
      zones: zones.map(z => ({
        zoneCode:  z.zone_id,
        zoneName:  z.zone_name,
        country:   z.country,
        updatedAt: z.last_hour?.toISOString() ?? null,
      })),
      count: zones.length,
    });
  });

  // GET /ef/zones/:zoneCode/latest — zone'un son 24 saatlik EF verisi
  app.get("/ef/zones/:zoneCode/latest", async (request, reply) => {
    const { zoneCode } = request.params as { zoneCode: string };

    const records = await prisma.$queryRaw<{
      hour: Date; ci_direct: number; ci_lifecycle: number; cfe_pct: number;
    }[]>(Prisma.sql`
      SELECT hour, ci_direct, ci_lifecycle, cfe_pct
      FROM emission_factors
      WHERE zone_id = ${zoneCode}
      ORDER BY hour DESC
      LIMIT 24
    `);

    return reply.send({
      zoneCode,
      records: records.map(r => ({
        hour:        r.hour.toISOString(),
        ciDirect:    r.ci_direct,
        ciLifecycle: r.ci_lifecycle,
        cfePct:      r.cfe_pct,
      })),
    });
  });

  // GET /ef/import-logs — son EF import logları
  app.get("/ef/import-logs", async (_request, reply) => {
    const logs = await prisma.efImportLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
    });
    return reply.send({ logs });
  });

  // POST /ef/import — manuel EF import tetikle
  app.post("/ef/import", async (_request, reply) => {
    reply.send({ message: "EF import başlatıldı (arka planda çalışıyor)." });
    runEfImport().catch(err => {
      app.log.error({ err }, "[Admin EF Import] Hata");
    });
  });

  // DELETE /ef/zones/:zoneCode — zone'a ait tüm EF kayıtlarını sil
  app.delete("/ef/zones/:zoneCode", async (request, reply) => {
    const { zoneCode } = request.params as { zoneCode: string };

    const [{ cnt }] = await prisma.$queryRaw<CountRow[]>(Prisma.sql`
      SELECT COUNT(*) AS cnt FROM emission_factors WHERE zone_id = ${zoneCode}
    `);

    if (Number(cnt) === 0) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.$executeRaw(Prisma.sql`
      DELETE FROM emission_factors WHERE zone_id = ${zoneCode}
    `);

    return reply.send({ deleted: Number(cnt), zoneCode });
  });
};
