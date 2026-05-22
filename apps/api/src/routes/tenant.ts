import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { requireRole } from "../plugins/rbac.js";

// Supported IANA timezones subset (common ones for EU/TR markets)
const COMMON_TIMEZONES = [
  "Europe/Istanbul", "Europe/London", "Europe/Berlin", "Europe/Paris",
  "Europe/Rome", "Europe/Madrid", "Europe/Amsterdam", "Europe/Warsaw",
  "Europe/Vienna", "Europe/Stockholm", "Europe/Helsinki", "Europe/Athens",
  "Europe/Brussels", "Europe/Lisbon", "Europe/Copenhagen", "Europe/Oslo",
  "UTC",
];

export const tenantRoutes: FastifyPluginAsync = async (app) => {

  // GET /tenant — tenant profili getir
  app.get("/tenant", async (request, reply) => {
    const tenant = await prisma.tenant.findUnique({
      where:  { id: request.tenantId },
      select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true, timezone: true, createdAt: true },
    });
    if (!tenant) return reply.status(404).send({ error: "TENANT_NOT_FOUND" });
    return reply.send({ tenant });
  });

  // PATCH /tenant — tenant profili güncelle (admin+)
  app.patch("/tenant", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const body = request.body as {
      name?: string;
      logoUrl?: string | null;
      brandColor?: string | null;
      timezone?: string;
    };

    // Validate brand color (must be valid hex or null)
    if (body.brandColor !== undefined && body.brandColor !== null) {
      if (!/^#[0-9A-Fa-f]{6}$/.test(body.brandColor)) {
        return reply.status(400).send({ error: "INVALID_BRAND_COLOR", message: "brandColor must be a #RRGGBB hex color" });
      }
    }

    // Validate timezone
    if (body.timezone !== undefined) {
      if (!COMMON_TIMEZONES.includes(body.timezone)) {
        return reply.status(400).send({ error: "INVALID_TIMEZONE", message: "Unsupported timezone" });
      }
    }

    const data: Record<string, unknown> = {};
    if (body.name       !== undefined) data.name       = body.name.trim();
    if (body.logoUrl    !== undefined) data.logoUrl    = body.logoUrl;
    if (body.brandColor !== undefined) data.brandColor = body.brandColor;
    if (body.timezone   !== undefined) data.timezone   = body.timezone;

    if (Object.keys(data).length === 0) {
      return reply.status(400).send({ error: "NO_CHANGES" });
    }

    const tenant = await prisma.tenant.update({
      where:  { id: request.tenantId },
      data,
      select: { id: true, name: true, slug: true, logoUrl: true, brandColor: true, timezone: true, createdAt: true },
    });

    return reply.send({ tenant });
  });

  // GET /tenant/timezones — supported timezone list
  app.get("/tenant/timezones", { config: { public: true } }, async (_req, reply) => {
    return reply.send({ timezones: COMMON_TIMEZONES });
  });
};
