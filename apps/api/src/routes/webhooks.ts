import { createHash, createHmac, randomBytes } from "crypto";
import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { requireRole } from "../plugins/rbac.js";

const VALID_EVENTS = [
  "ef.updated",
  "calculation.completed",
  "cfe.completed",
  "report.generated",
] as const;

const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAYS_MS    = [60_000, 300_000, 900_000]; // 1m, 5m, 15m

function generateSecret(): { raw: string; hash: string } {
  const raw  = randomBytes(32).toString("hex");
  const hash = createHash("sha256").update(raw).digest("hex");
  return { raw, hash };
}

export function signPayload(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

export async function dispatchWebhookEvent(
  tenantId: string,
  event: string,
  payload: object,
): Promise<void> {
  const subscriptions = await prisma.webhookSubscription.findMany({
    where: { tenantId, active: true, events: { has: event } },
  });

  if (subscriptions.length === 0) return;

  const deliveries = subscriptions.map((sub) =>
    prisma.webhookDelivery.create({
      data: {
        subscriptionId: sub.id,
        event,
        payload:        payload as object,
        status:         "pending",
        nextAttemptAt:  new Date(),
      },
    })
  );

  await Promise.all(deliveries);
}

// Webhook delivery worker — queue'dan çalıştırılır (Supabase pg_cron veya harici)
export async function processWebhookDelivery(deliveryId: string): Promise<void> {
  const delivery = await prisma.webhookDelivery.findUnique({
    where: { id: deliveryId },
    include: { subscription: true },
  });

  if (!delivery || delivery.status === "success") return;

  const body      = JSON.stringify(delivery.payload);
  const signature = signPayload(delivery.subscription.secretHash, body);

  let responseStatus: number | null = null;
  let success = false;

  try {
    const response = await fetch(delivery.subscription.url, {
      method:  "POST",
      headers: {
        "Content-Type":        "application/json",
        "X-Voltfox-Signature": signature,
        "X-Voltfox-Event":     delivery.event,
      },
      body,
      signal: AbortSignal.timeout(10_000),
    });

    responseStatus = response.status;
    success        = response.status >= 200 && response.status < 300;
  } catch {
    // network error — retry
  }

  const attempts = delivery.attempts + 1;
  const nextAttemptAt = !success && attempts < MAX_RETRY_ATTEMPTS
    ? new Date(Date.now() + (RETRY_DELAYS_MS[attempts] ?? 900_000))
    : null;

  await prisma.webhookDelivery.update({
    where: { id: deliveryId },
    data: {
      attempts,
      status:         success ? "success" : attempts >= MAX_RETRY_ATTEMPTS ? "failed" : "pending",
      responseStatus: responseStatus ?? undefined,
      deliveredAt:    success ? new Date() : undefined,
      nextAttemptAt,
    },
  });
}

export const webhooksRoutes: FastifyPluginAsync = async (app) => {

  // POST /webhooks — yeni abonelik (admin+)
  app.post("/webhooks", {
    schema: {
      body: {
        type: "object",
        required: ["url", "events"],
        properties: {
          url:    { type: "string", format: "uri" },
          events: {
            type: "array",
            minItems: 1,
            items: { type: "string", enum: VALID_EVENTS as unknown as string[] },
          },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { url, events } = request.body as { url: string; events: string[] };
    const { raw, hash }   = generateSecret();

    const sub = await prisma.webhookSubscription.create({
      data: {
        tenantId:   request.tenantId,
        url,
        events,
        secretHash: hash,
        active:     true,
      },
    });

    return reply.status(201).send({
      id:        sub.id,
      url:       sub.url,
      events:    sub.events,
      active:    sub.active,
      createdAt: sub.createdAt,
      secret:    raw, // TEK SEFERLIK — HMAC imzalama için kaydet
    });
  });

  // GET /webhooks — abonelik listesi (admin+)
  app.get("/webhooks", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const subs = await prisma.webhookSubscription.findMany({
      where:   { tenantId: request.tenantId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true, url: true, events: true, active: true, createdAt: true,
        _count: { select: { deliveries: true } },
      },
    });

    return reply.send({ webhooks: subs });
  });

  // PATCH /webhooks/:id — aktif/pasif et (admin+)
  app.patch("/webhooks/:id", {
    schema: {
      body: {
        type: "object",
        properties: {
          active: { type: "boolean" },
          events: { type: "array", items: { type: "string" } },
          url:    { type: "string", format: "uri" },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { id }   = request.params as { id: string };
    const body     = request.body as { active?: boolean; events?: string[]; url?: string };

    const sub = await prisma.webhookSubscription.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!sub) return reply.status(404).send({ error: "NOT_FOUND" });

    const updated = await prisma.webhookSubscription.update({
      where: { id },
      data: {
        ...(body.active  !== undefined && { active: body.active }),
        ...(body.events  !== undefined && { events: body.events }),
        ...(body.url     !== undefined && { url: body.url }),
      },
    });

    return reply.send(updated);
  });

  // DELETE /webhooks/:id — aboneliği sil (admin+)
  app.delete("/webhooks/:id", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { id } = request.params as { id: string };

    const sub = await prisma.webhookSubscription.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!sub) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.webhookSubscription.delete({ where: { id } });
    return reply.status(204).send();
  });

  // GET /webhooks/:id/deliveries — delivery geçmişi (admin+)
  app.get("/webhooks/:id/deliveries", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { id } = request.params as { id: string };
    const sub = await prisma.webhookSubscription.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!sub) return reply.status(404).send({ error: "NOT_FOUND" });

    const deliveries = await prisma.webhookDelivery.findMany({
      where:   { subscriptionId: id },
      orderBy: { createdAt: "desc" },
      take:    50,
      select: {
        id: true, event: true, status: true,
        attempts: true, responseStatus: true,
        deliveredAt: true, createdAt: true,
      },
    });

    return reply.send({ deliveries });
  });
};
