import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { requireRole } from "../plugins/rbac.js";

export const cbamFacilitiesRoutes: FastifyPluginAsync = async (app) => {

  // ── GET /cbam/facilities ──────────────────────────────────────────────────
  app.get("/cbam/facilities", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const facilities = await prisma.cbamFacility.findMany({
      where:   { tenantId: request.tenantId },
      orderBy: { createdAt: "asc" },
      include: {
        products: {
          orderBy: { createdAt: "asc" },
          include: { productPeriods: { orderBy: { reportYear: "desc" } } },
        },
      },
    });

    return reply.send({ facilities });
  });

  // ── POST /cbam/facilities ─────────────────────────────────────────────────
  app.post("/cbam/facilities", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const body = request.body as {
      facilityName:         string;
      operator?:            string;
      facilityCountry:      string;
      sector?:              string;
      facilityRef?:         string;
      unLoCode?:            string;
      cbamInstallationId?:  string;
      linkedInstallationId?: string;
    };

    if (!body.facilityName?.trim())
      return reply.status(400).send({ error: "MISSING_NAME", message: "facilityName gerekli." });
    if (!body.facilityCountry?.trim())
      return reply.status(400).send({ error: "MISSING_COUNTRY", message: "facilityCountry gerekli." });

    const VALID_SECTORS = ["cement", "steel", "aluminium", "fertilizer", "electricity", "hydrogen", "other"];
    if (body.sector && !VALID_SECTORS.includes(body.sector))
      return reply.status(400).send({ error: "INVALID_SECTOR", message: `sector: ${VALID_SECTORS.join(" | ")}` });

    const facility = await prisma.cbamFacility.create({
      data: {
        tenantId:            request.tenantId,
        facilityName:        body.facilityName.trim(),
        operator:            body.operator?.trim() ?? "",
        facilityCountry:     body.facilityCountry.trim().toUpperCase(),
        sector:              body.sector ?? "steel",
        facilityRef:         body.facilityRef?.trim()         || null,
        unLoCode:            body.unLoCode?.trim()            || null,
        cbamInstallationId:  body.cbamInstallationId?.trim()  || null,
        linkedInstallationId: body.linkedInstallationId       || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "CREATE",
        resource:   "CbamFacility",
        resourceId: facility.id,
        payload:    { facilityName: facility.facilityName, facilityCountry: facility.facilityCountry },
      },
    }).catch(() => {});

    return reply.status(201).send({ facility });
  });

  // ── GET /cbam/facilities/:id ──────────────────────────────────────────────
  app.get("/cbam/facilities/:id", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    const { id } = request.params as { id: string };

    const facility = await prisma.cbamFacility.findFirst({
      where:   { id, tenantId: request.tenantId },
      include: {
        products: {
          orderBy: { createdAt: "asc" },
          include: { productPeriods: { orderBy: { reportYear: "desc" } } },
        },
      },
    });

    if (!facility) return reply.status(404).send({ error: "NOT_FOUND" });
    return reply.send({ facility });
  });

  // ── PATCH /cbam/facilities/:id ────────────────────────────────────────────
  app.patch("/cbam/facilities/:id", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "analyst")) return;

    const { id } = request.params as { id: string };
    const body = request.body as Partial<{
      facilityName:         string;
      operator:             string;
      facilityCountry:      string;
      sector:               string;
      facilityRef:          string;
      unLoCode:             string;
      cbamInstallationId:   string;
      linkedInstallationId: string;
    }>;

    const facility = await prisma.cbamFacility.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!facility) return reply.status(404).send({ error: "NOT_FOUND" });

    const VALID_SECTORS = ["cement", "steel", "aluminium", "fertilizer", "electricity", "hydrogen", "other"];
    if (body.sector && !VALID_SECTORS.includes(body.sector))
      return reply.status(400).send({ error: "INVALID_SECTOR" });

    const updated = await prisma.cbamFacility.update({
      where: { id },
      data: {
        ...(body.facilityName        != null && { facilityName:        body.facilityName.trim() }),
        ...(body.operator            != null && { operator:            body.operator.trim() }),
        ...(body.facilityCountry     != null && { facilityCountry:     body.facilityCountry.trim().toUpperCase() }),
        ...(body.sector              != null && { sector:              body.sector }),
        ...(body.facilityRef         != null && { facilityRef:         body.facilityRef.trim()        || null }),
        ...(body.unLoCode            != null && { unLoCode:            body.unLoCode.trim()           || null }),
        ...(body.cbamInstallationId  != null && { cbamInstallationId:  body.cbamInstallationId.trim() || null }),
        ...(body.linkedInstallationId != null && { linkedInstallationId: body.linkedInstallationId || null }),
      },
    });

    return reply.send({ facility: updated });
  });

  // ── DELETE /cbam/facilities/:id ───────────────────────────────────────────
  app.delete("/cbam/facilities/:id", async (request, reply) => {
    if (!request.tenantId) return reply.status(401).send({ error: "UNAUTHORIZED" });
    if (!await requireRole(request, reply, "admin")) return;

    const { id } = request.params as { id: string };

    const facility = await prisma.cbamFacility.findFirst({
      where:   { id, tenantId: request.tenantId },
      include: { products: { select: { id: true } } },
    });
    if (!facility) return reply.status(404).send({ error: "NOT_FOUND" });

    if (facility.products.length > 0)
      return reply.status(409).send({
        error:   "HAS_PRODUCTS",
        message: `Bu tesise bağlı ${facility.products.length} ürün var. Önce ürünleri silin.`,
      });

    await prisma.cbamFacility.delete({ where: { id } });

    await prisma.auditLog.create({
      data: {
        tenantId:   request.tenantId,
        userId:     request.userId ?? undefined,
        action:     "DELETE",
        resource:   "CbamFacility",
        resourceId: id,
        payload:    { facilityName: facility.facilityName },
      },
    }).catch(() => {});

    return reply.status(204).send();
  });
};
