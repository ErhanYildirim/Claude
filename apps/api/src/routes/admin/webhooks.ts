import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { dispatchWebhookEvent } from "../webhooks.js";

export const adminWebhooksRoutes: FastifyPluginAsync = async (app) => {

  // GET /webhooks/deliveries — tüm webhook teslimatlarını listele
  app.get("/webhooks/deliveries", async (request, reply) => {
    const { status, limit = "50", offset = "0" } = request.query as {
      status?: string; limit?: string; offset?: string;
    };

    const where = status ? { status } : {};

    const [deliveries, total] = await Promise.all([
      prisma.webhookDelivery.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: Math.min(parseInt(limit), 200),
        skip: parseInt(offset),
        include: {
          subscription: { select: { url: true, tenantId: true } },
        },
      }),
      prisma.webhookDelivery.count({ where }),
    ]);

    return reply.send({
      deliveries: deliveries.map(d => ({
        id:          d.id,
        webhookId:   d.subscriptionId,
        status:      d.status,
        statusCode:  d.responseStatus,
        createdAt:   d.createdAt,
        durationMs:  null, // not tracked in schema
        webhook: {
          url:      d.subscription.url,
          tenantId: d.subscription.tenantId,
        },
      })),
      total,
    });
  });

  // POST /webhooks/deliveries/:id/retry — webhook'u yeniden gönder
  app.post("/webhooks/deliveries/:id/retry", async (request, reply) => {
    const { id } = request.params as { id: string };

    const delivery = await prisma.webhookDelivery.findUnique({
      where:   { id },
      include: { subscription: true },
    });

    if (!delivery) return reply.status(404).send({ error: "NOT_FOUND" });

    const payload = delivery.payload as Record<string, unknown>;
    const event   = delivery.event;

    // Fire-and-forget retry
    dispatchWebhookEvent(
      delivery.subscription.tenantId,
      event,
      payload ?? {},
    ).catch(() => {});

    app.log.info({ deliveryId: id, event }, "[Admin] Webhook yeniden gönderiliyor");
    return reply.send({ message: "Yeniden gönderim başlatıldı.", deliveryId: id });
  });

  // GET /webhooks/stats — webhook delivery istatistikleri
  app.get("/webhooks/stats", async (_request, reply) => {
    const [total, success, failed, pending] = await Promise.all([
      prisma.webhookDelivery.count(),
      prisma.webhookDelivery.count({ where: { status: "success" } }),
      prisma.webhookDelivery.count({ where: { status: "failed" } }),
      prisma.webhookDelivery.count({ where: { status: "pending" } }),
    ]);

    return reply.send({
      total,
      success,
      failed,
      pending,
      successRate: total > 0 ? ((success / total) * 100).toFixed(1) : "0",
    });
  });
};
