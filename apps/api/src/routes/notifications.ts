import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const notificationsRoutes: FastifyPluginAsync = async (app) => {

  // GET /notifications — son 50 bildirimi getir (okunmuş + okunmamış)
  app.get("/notifications", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const [items, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where:   { tenantId: request.tenantId, userId: request.userId },
        orderBy: { createdAt: "desc" },
        take:    50,
      }),
      prisma.notification.count({
        where: { tenantId: request.tenantId, userId: request.userId, read: false },
      }),
    ]);

    return reply.send({ notifications: items, unreadCount });
  });

  // PATCH /notifications/:id/read — bildirimi okundu işaretle
  app.patch("/notifications/:id/read", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const { id } = request.params as { id: string };

    await prisma.notification.updateMany({
      where:  { id, tenantId: request.tenantId, userId: request.userId },
      data:   { read: true },
    });

    return reply.status(204).send();
  });

  // PATCH /notifications/read-all — tüm bildirimleri okundu işaretle
  app.patch("/notifications/read-all", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    await prisma.notification.updateMany({
      where: { tenantId: request.tenantId, userId: request.userId, read: false },
      data:  { read: true },
    });

    return reply.status(204).send();
  });

  // DELETE /notifications/:id — bildirimi sil
  app.delete("/notifications/:id", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const { id } = request.params as { id: string };

    await prisma.notification.deleteMany({
      where: { id, tenantId: request.tenantId, userId: request.userId },
    });

    return reply.status(204).send();
  });

  // GET /notifications/preferences — bildirim tercihleri
  app.get("/notifications/preferences", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const pref = await prisma.notificationPreference.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
    });

    // Varsayılan değerler (henüz kayıt yoksa)
    return reply.send({
      calculationDone: pref?.calculationDone ?? true,
      cfeDone:         pref?.cfeDone         ?? true,
      memberInvited:   pref?.memberInvited    ?? true,
      periodCreated:   pref?.periodCreated    ?? true,
    });
  });

  // PATCH /notifications/preferences — bildirim tercihlerini güncelle
  app.patch("/notifications/preferences", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const body = request.body as {
      calculationDone?: boolean;
      cfeDone?:         boolean;
      memberInvited?:   boolean;
      periodCreated?:   boolean;
    };

    const pref = await prisma.notificationPreference.upsert({
      where: { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
      create: {
        tenantId:       request.tenantId,
        userId:         request.userId,
        calculationDone: body.calculationDone ?? true,
        cfeDone:         body.cfeDone         ?? true,
        memberInvited:   body.memberInvited    ?? true,
        periodCreated:   body.periodCreated    ?? true,
      },
      update: {
        ...(body.calculationDone !== undefined ? { calculationDone: body.calculationDone } : {}),
        ...(body.cfeDone         !== undefined ? { cfeDone:         body.cfeDone         } : {}),
        ...(body.memberInvited   !== undefined ? { memberInvited:   body.memberInvited   } : {}),
        ...(body.periodCreated   !== undefined ? { periodCreated:   body.periodCreated   } : {}),
      },
    });

    return reply.send(pref);
  });
};

// ── Helper: bildirimi oluştur (diğer route'lar tarafından çağrılır) ───────────
export async function createNotification(params: {
  tenantId:   string;
  userId:     string;
  type:       string;
  title:      string;
  body?:      string;
  resource?:  string;
  resourceId?: string;
}): Promise<void> {
  await prisma.notification.create({
    data: {
      tenantId:   params.tenantId,
      userId:     params.userId,
      type:       params.type,
      title:      params.title,
      body:       params.body,
      resource:   params.resource,
      resourceId: params.resourceId,
    },
  }).catch(() => {}); // fire-and-forget — bildirim başarısızlığı işlemi engellememeli
}
