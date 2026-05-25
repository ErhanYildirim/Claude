import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import crypto from "crypto";

type Graph = {
  id: string; tenantId: string; name: string; description: string | null;
  nodesJson: unknown; edgesJson: unknown; viewport: unknown;
  createdBy: string; updatedBy: string | null;
  createdAt: Date; updatedAt: Date;
};

type Snapshot = {
  id: string; graphId: string; name: string; reportingPeriod: string | null;
  nodesJson: unknown; edgesJson: unknown; hash: string;
  isLocked: boolean; methodologyVer: string; createdBy: string; createdAt: Date;
};

function hashCanvas(nodes: unknown, edges: unknown): string {
  return crypto
    .createHash("sha256")
    .update(JSON.stringify(nodes) + JSON.stringify(edges))
    .digest("hex");
}

export const esgPlaygroundRoutes: FastifyPluginAsync = async (app) => {
  const db = prisma as unknown as {
    esgPlaygroundGraph: {
      findMany:  (a: object) => Promise<Graph[]>;
      findFirst: (a: object) => Promise<Graph | null>;
      create:    (a: object) => Promise<Graph>;
      update:    (a: object) => Promise<Graph>;
      delete:    (a: object) => Promise<Graph>;
    };
    esgPlaygroundSnapshot: {
      findMany:  (a: object) => Promise<Snapshot[]>;
      findFirst: (a: object) => Promise<Snapshot | null>;
      create:    (a: object) => Promise<Snapshot>;
    };
  };

  // ── GET /esg-playground — tenant canvas listesi ────────────────────────────
  app.get("/esg-playground", async (request, reply) => {
    const tenantId = request.tenantId;
    const graphs = await db.esgPlaygroundGraph.findMany({
      where:   { tenantId },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true, name: true, description: true,
        createdBy: true, updatedBy: true,
        createdAt: true, updatedAt: true,
        // nodesJson/edgesJson liste görünümünde dönme — büyük payload
      },
    });
    return reply.send({ graphs });
  });

  // ── GET /esg-playground/:id — tek canvas (nodes + edges dahil) ─────────────
  app.get<{ Params: { id: string } }>(
    "/esg-playground/:id",
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      const graph = await db.esgPlaygroundGraph.findFirst({
        where: { id, tenantId },
      });
      if (!graph) return reply.status(404).send({ error: "NOT_FOUND" });

      return reply.send({ graph });
    },
  );

  // ── POST /esg-playground — yeni canvas ────────────────────────────────────
  app.post<{
    Body: { name?: string; description?: string; nodesJson?: unknown; edgesJson?: unknown; viewport?: unknown }
  }>(
    "/esg-playground",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            name:        { type: "string", maxLength: 200 },
            description: { type: "string", maxLength: 1000 },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const userId   = request.userId;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });
      const { name = "Yeni Canvas", description, nodesJson = [], edgesJson = [], viewport } = request.body ?? {};

      const graph = await db.esgPlaygroundGraph.create({
        data: {
          tenantId,
          name,
          description: description ?? null,
          nodesJson,
          edgesJson,
          viewport: viewport ?? { x: 0, y: 0, zoom: 1 },
          createdBy: userId,
        },
      });

      return reply.status(201).send({ graph });
    },
  );

  // ── PUT /esg-playground/:id — canvas güncelle (auto-save) ─────────────────
  app.put<{
    Params: { id: string };
    Body: { name?: string; description?: string; nodesJson?: unknown; edgesJson?: unknown; viewport?: unknown }
  }>(
    "/esg-playground/:id",
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;
      const userId   = request.userId;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const existing = await db.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

      const { name, description, nodesJson, edgesJson, viewport } = request.body ?? {};

      const updated = await db.esgPlaygroundGraph.update({
        where: { id },
        data: {
          ...(name        !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(nodesJson   !== undefined && { nodesJson }),
          ...(edgesJson   !== undefined && { edgesJson }),
          ...(viewport    !== undefined && { viewport }),
          updatedBy: userId,
        },
      });

      return reply.send({ graph: updated });
    },
  );

  // ── DELETE /esg-playground/:id ─────────────────────────────────────────────
  app.delete<{ Params: { id: string } }>(
    "/esg-playground/:id",
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      const existing = await db.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

      await db.esgPlaygroundGraph.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  // ── GET /esg-playground/:id/snapshots — snapshot listesi ──────────────────
  app.get<{ Params: { id: string } }>(
    "/esg-playground/:id/snapshots",
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      const graph = await db.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!graph) return reply.status(404).send({ error: "NOT_FOUND" });

      const snapshots = await db.esgPlaygroundSnapshot.findMany({
        where:   { graphId: id },
        orderBy: { createdAt: "desc" },
        select: {
          id: true, name: true, reportingPeriod: true,
          hash: true, isLocked: true, methodologyVer: true,
          createdBy: true, createdAt: true,
          // nodesJson/edgesJson listede dönme
        },
      });

      return reply.send({ snapshots });
    },
  );

  // ── GET /esg-playground/:id/snapshots/:snapshotId — tam snapshot ──────────
  app.get<{ Params: { id: string; snapshotId: string } }>(
    "/esg-playground/:id/snapshots/:snapshotId",
    async (request, reply) => {
      const { id, snapshotId } = request.params;
      const tenantId = request.tenantId;

      const graph = await db.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!graph) return reply.status(404).send({ error: "NOT_FOUND" });

      const snapshot = await db.esgPlaygroundSnapshot.findFirst({
        where: { id: snapshotId, graphId: id },
      });
      if (!snapshot) return reply.status(404).send({ error: "NOT_FOUND" });

      return reply.send({ snapshot });
    },
  );

  // ── POST /esg-playground/:id/snapshots — yeni snapshot al ─────────────────
  app.post<{
    Params: { id: string };
    Body: { name: string; reportingPeriod?: string }
  }>(
    "/esg-playground/:id/snapshots",
    {
      schema: {
        body: {
          type: "object",
          required: ["name"],
          properties: {
            name:            { type: "string", maxLength: 200 },
            reportingPeriod: { type: "string", maxLength: 50 },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;
      const userId   = request.userId;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const graph = await db.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!graph) return reply.status(404).send({ error: "NOT_FOUND" });

      const { name, reportingPeriod } = request.body;
      const hash = hashCanvas(graph.nodesJson, graph.edgesJson);

      const snapshot = await db.esgPlaygroundSnapshot.create({
        data: {
          graphId:         id,
          name,
          reportingPeriod: reportingPeriod ?? null,
          nodesJson:       graph.nodesJson,
          edgesJson:       graph.edgesJson,
          hash,
          isLocked:        true,
          methodologyVer:  "1.0",
          createdBy:       userId,
        },
      });

      return reply.status(201).send({ snapshot });
    },
  );

  // ── GET /esg-playground/import-preview — mevcut tesislerden node önizleme ─
  app.get<{ Querystring: { mode?: string } }>(
    "/esg-playground/import-preview",
    async (request, reply) => {
      const tenantId = request.tenantId;
      const mode = request.query.mode ?? "all"; // all | selected

      const installations = await prisma.installation.findMany({
        where: { tenantId },
        select: { id: true, facilityName: true, facilityCountry: true, operator: true, sector: true },
        take: 100,
      });

      const nodes: unknown[] = [];
      const edges: unknown[] = [];
      let x = 100;
      let y = 100;
      const col = 0;

      for (const inst of installations) {
        nodes.push({
          id:       `facility-${inst.id}`,
          type:     "facilityNode",
          position: { x: x + col * 320, y },
          data: {
            label:   inst.facilityName,
            country: inst.facilityCountry,
            sector:  inst.sector,
            operator: inst.operator,
            sourceId: inst.id,
          },
        });
        y += 160;
        if (y > 1200) { y = 100; x += 320; }
      }

      // Scope grupları
      nodes.push(
        { id: "scope1-group", type: "scopeGroupNode", position: { x: -200, y: -100 },
          data: { label: "Scope 1", scope: 1 }, style: { width: 180, height: 120 } },
        { id: "scope2-group", type: "scopeGroupNode", position: { x: -200, y: 60 },
          data: { label: "Scope 2", scope: 2 }, style: { width: 180, height: 120 } },
        { id: "scope3-group", type: "scopeGroupNode", position: { x: -200, y: 220 },
          data: { label: "Scope 3", scope: 3 }, style: { width: 180, height: 120 } },
      );

      return reply.send({
        summary: {
          installations: installations.length,
          nodesWillCreate: nodes.length,
          edgesWillCreate: edges.length,
        },
        nodes,
        edges,
      });
    },
  );
};
