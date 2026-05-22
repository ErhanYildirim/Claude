import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { requireSuperAdmin } from "../plugins/admin-auth.js";

export const carbonPricesRoutes: FastifyPluginAsync = async (app) => {

  // GET /carbon-prices — son 90 günün ETS fiyat geçmişi
  app.get("/carbon-prices", async (_request, reply) => {
    const from = new Date();
    from.setDate(from.getDate() - 90);

    const prices = await prisma.carbonPrice.findMany({
      where:   { date: { gte: from } },
      orderBy: { date: "desc" },
      take:    120,
    });

    return reply.send({ prices });
  });

  // GET /carbon-prices/latest — güncel fiyat
  app.get("/carbon-prices/latest", async (_request, reply) => {
    const price = await prisma.carbonPrice.findFirst({
      orderBy: { date: "desc" },
    });

    return reply.send({ price });
  });

  // POST /carbon-prices — yeni fiyat girişi (super-admin)
  app.post("/carbon-prices", {
    schema: {
      body: {
        type: "object",
        required: ["date", "etsPriceEur"],
        properties: {
          date:        { type: "string" },
          etsPriceEur: { type: "number", minimum: 0 },
          cbamEstEur:  { type: "number", minimum: 0 },
          source:      { type: "string" },
          notes:       { type: "string" },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireSuperAdmin(app, request, reply)) return;

    const body = request.body as {
      date: string; etsPriceEur: number;
      cbamEstEur?: number; source?: string; notes?: string;
    };

    const price = await prisma.carbonPrice.upsert({
      where:  { date_source: { date: new Date(body.date), source: body.source ?? "manual" } },
      create: {
        date:        new Date(body.date),
        etsPriceEur: body.etsPriceEur,
        cbamEstEur:  body.cbamEstEur ?? null,
        source:      body.source ?? "manual",
        notes:       body.notes ?? null,
      },
      update: {
        etsPriceEur: body.etsPriceEur,
        cbamEstEur:  body.cbamEstEur ?? null,
        notes:       body.notes ?? null,
      },
    });

    return reply.status(201).send(price);
  });

  // DELETE /carbon-prices/:id — fiyat kaydı sil (super-admin)
  app.delete("/carbon-prices/:id", async (request, reply) => {
    if (!await requireSuperAdmin(app, request, reply)) return;
    const { id } = request.params as { id: string };

    await prisma.carbonPrice.delete({ where: { id } }).catch(() => {});
    return reply.status(204).send();
  });
};
