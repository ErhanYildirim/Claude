import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const adminAnnouncementsRoutes: FastifyPluginAsync = async (app) => {

  // POST /announcements — tüm kullanıcılara veya belirli tenant'a bildirim gönder
  app.post("/announcements", {
    schema: {
      body: {
        type: "object",
        required: ["title", "body"],
        properties: {
          title:    { type: "string", minLength: 1, maxLength: 200 },
          body:     { type: "string", minLength: 1, maxLength: 2000 },
          tenantId: { type: "string" }, // opsiyonel — yoksa tüm tenant'lara
          type:     { type: "string" }, // opsiyonel — varsayılan "ANNOUNCEMENT"
        },
      },
    },
  }, async (request, reply) => {
    const { title, body, tenantId, type = "ANNOUNCEMENT" } = request.body as {
      title: string; body: string; tenantId?: string; type?: string;
    };

    // Hedef üyeleri bul
    const members = await prisma.tenantMember.findMany({
      where: tenantId ? { tenantId } : {},
      select: { tenantId: true, userId: true },
    });

    if (members.length === 0) {
      return reply.status(400).send({ error: "NO_TARGETS", message: "Hedef kullanıcı bulunamadı." });
    }

    // Toplu bildirim oluştur (chunks halinde — büyük veri)
    const CHUNK = 100;
    let created = 0;

    for (let i = 0; i < members.length; i += CHUNK) {
      const chunk = members.slice(i, i + CHUNK);
      await prisma.notification.createMany({
        data: chunk.map(m => ({
          tenantId: m.tenantId,
          userId:   m.userId,
          type,
          title,
          body,
        })),
        skipDuplicates: true,
      });
      created += chunk.length;
    }

    app.log.info({ created, tenantId, type }, "[Admin] Duyuru gönderildi");
    return reply.status(201).send({ created, message: `${created} kullanıcıya bildirim gönderildi.` });
  });

  // GET /announcements — son 50 duyuru
  app.get("/announcements", async (_request, reply) => {
    const items = await prisma.notification.findMany({
      where:   { type: "ANNOUNCEMENT" },
      orderBy: { createdAt: "desc" },
      take:    50,
      select:  { id: true, tenantId: true, title: true, body: true, createdAt: true },
      distinct: ["title", "createdAt"],
    });

    return reply.send({ items });
  });
};
