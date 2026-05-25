import type { FastifyPluginAsync } from "fastify";
import { prisma, Prisma } from "@voltfox/db";
import crypto from "crypto";

// ── Yerleşik Canvas Şablonları ────────────────────────────────────────────────
// Tenant-bağımsız — tenant_id FK kısıtlaması olmadan global şablonlar.
interface CanvasTemplate {
  key: string; name: string; description: string; category: string;
  icon: string;
  nodes: unknown[]; edges: unknown[];
}

const CANVAS_TEMPLATES: CanvasTemplate[] = [
  {
    key: "cfe-24-7-matching",
    name: "24/7 CFE Matching",
    description: "Saatlik tüketim-üretim eşleştirme akışı — solar/rüzgar + PPA + CFE skoru",
    category: "cfe", icon: "⚡",
    nodes: [
      { id: "cfe-facility",  type: "facilityNode",    position: { x: 80,  y: 200 }, data: { label: "Tesis" } },
      { id: "cfe-meter",     type: "meterNode",       position: { x: 300, y: 200 }, data: { label: "Saatlik Sayaç" } },
      { id: "cfe-solar",     type: "solarNode",       position: { x: 80,  y: 60  }, data: { label: "Solar PV" } },
      { id: "cfe-wind",      type: "windNode",        position: { x: 80,  y: 340 }, data: { label: "Rüzgar" } },
      { id: "cfe-ppa",       type: "ppaContractNode", position: { x: 300, y: 60  }, data: { label: "PPA Sözleşmesi" } },
      { id: "cfe-grid",      type: "gridNode",        position: { x: 300, y: 340 }, data: { label: "Şebeke" } },
      { id: "cfe-matching",  type: "cfMatchingNode",  position: { x: 540, y: 200 }, data: { label: "CFE Eşleştirme" } },
      { id: "cfe-report",    type: "ghgReportNode",   position: { x: 760, y: 200 }, data: { label: "CFE Raporu" } },
    ],
    edges: [
      { id: "e1", source: "cfe-facility", target: "cfe-meter",    type: "dataFlowEdge",   animated: true },
      { id: "e2", source: "cfe-solar",    target: "cfe-ppa",      type: "energyFlowEdge", animated: true },
      { id: "e3", source: "cfe-wind",     target: "cfe-matching", type: "energyFlowEdge", animated: true },
      { id: "e4", source: "cfe-grid",     target: "cfe-matching", type: "energyFlowEdge", animated: true },
      { id: "e5", source: "cfe-ppa",      target: "cfe-matching", type: "energyFlowEdge", animated: true },
      { id: "e6", source: "cfe-meter",    target: "cfe-matching", type: "dataFlowEdge",   animated: true },
      { id: "e7", source: "cfe-matching", target: "cfe-report",   type: "dataFlowEdge",   animated: true },
    ],
  },
  {
    key: "cbam-actual-emissions",
    name: "CBAM Actual Emissions",
    description: "Ürün bazında gömülü emisyon hesabı — CBAM Ek IV akışı",
    category: "cbam", icon: "🌍",
    nodes: [
      { id: "cbam-facility",  type: "facilityNode",    position: { x: 60,  y: 220 }, data: { label: "Üretim Tesisi" } },
      { id: "cbam-product",   type: "productNode",     position: { x: 60,  y: 380 }, data: { label: "CBAM Ürünü" } },
      { id: "cbam-grid",      type: "gridNode",        position: { x: 60,  y: 80  }, data: { label: "Elektrik Şebekesi" } },
      { id: "cbam-meter",     type: "meterNode",       position: { x: 280, y: 220 }, data: { label: "Enerji Sayacı" } },
      { id: "cbam-emcalc",   type: "emissionCalcNode", position: { x: 480, y: 220 }, data: { label: "Emisyon Hesabı" } },
      { id: "cbam-calc",     type: "cbamCalcNode",     position: { x: 680, y: 220 }, data: { label: "CBAM Hesabı" } },
      { id: "cbam-report",   type: "cbamReportNode",   position: { x: 880, y: 220 }, data: { label: "CBAM Raporu" } },
    ],
    edges: [
      { id: "e1", source: "cbam-grid",     target: "cbam-meter",   type: "energyFlowEdge", animated: true },
      { id: "e2", source: "cbam-facility", target: "cbam-meter",   type: "dataFlowEdge",   animated: true },
      { id: "e3", source: "cbam-product",  target: "cbam-calc",    type: "dataFlowEdge",   animated: true },
      { id: "e4", source: "cbam-meter",    target: "cbam-emcalc",  type: "dataFlowEdge",   animated: true },
      { id: "e5", source: "cbam-emcalc",   target: "cbam-calc",    type: "carbonFlowEdge", animated: true },
      { id: "e6", source: "cbam-calc",     target: "cbam-report",  type: "dataFlowEdge",   animated: true },
    ],
  },
  {
    key: "ghg-protocol-scope123",
    name: "GHG Protocol Scope 1+2+3",
    description: "GHG Protocol kapsamlı emisyon envanteri — tüm scope'lar",
    category: "ghg", icon: "🌡️",
    nodes: [
      { id: "ghg-s1group",  type: "scopeGroupNode",   position: { x: 40,  y: 80  }, data: { label: "Scope 1",  scope: 1 }, style: { width: 160, height: 100 } },
      { id: "ghg-s2group",  type: "scopeGroupNode",   position: { x: 40,  y: 220 }, data: { label: "Scope 2",  scope: 2 }, style: { width: 160, height: 100 } },
      { id: "ghg-s3group",  type: "scopeGroupNode",   position: { x: 40,  y: 360 }, data: { label: "Scope 3",  scope: 3 }, style: { width: 160, height: 100 } },
      { id: "ghg-gas",      type: "naturalGasNode",   position: { x: 240, y: 100 }, data: { label: "Doğalgaz / Yakıt" } },
      { id: "ghg-grid",     type: "gridNode",         position: { x: 240, y: 240 }, data: { label: "Elektrik Şebekesi" } },
      { id: "ghg-fleet",    type: "vehicleFleetNode", position: { x: 240, y: 380 }, data: { label: "Araç Filosu" } },
      { id: "ghg-calc1",    type: "emissionCalcNode", position: { x: 460, y: 100 }, data: { label: "S1 Hesabı" } },
      { id: "ghg-calc2",    type: "emissionCalcNode", position: { x: 460, y: 240 }, data: { label: "S2 Hesabı" } },
      { id: "ghg-calc3",    type: "emissionCalcNode", position: { x: 460, y: 380 }, data: { label: "S3 Hesabı" } },
      { id: "ghg-report",   type: "ghgReportNode",    position: { x: 680, y: 240 }, data: { label: "GHG Raporu" } },
    ],
    edges: [
      { id: "e1", source: "ghg-gas",   target: "ghg-calc1",  type: "carbonFlowEdge", animated: true },
      { id: "e2", source: "ghg-grid",  target: "ghg-calc2",  type: "energyFlowEdge", animated: true },
      { id: "e3", source: "ghg-fleet", target: "ghg-calc3",  type: "carbonFlowEdge", animated: true },
      { id: "e4", source: "ghg-calc1", target: "ghg-report", type: "carbonFlowEdge", animated: true },
      { id: "e5", source: "ghg-calc2", target: "ghg-report", type: "carbonFlowEdge", animated: true },
      { id: "e6", source: "ghg-calc3", target: "ghg-report", type: "carbonFlowEdge", animated: true },
    ],
  },
  {
    key: "org-structure",
    name: "Organizasyon Yapısı",
    description: "Şirket hiyerarşisi — birim, tesis, proses ağacı",
    category: "org", icon: "🏢",
    nodes: [
      { id: "org-root",    type: "orgNode",      position: { x: 360, y: 40  }, data: { label: "Şirket" } },
      { id: "org-div1",    type: "divisionNode", position: { x: 160, y: 180 }, data: { label: "Operasyon Birimi" } },
      { id: "org-div2",    type: "divisionNode", position: { x: 560, y: 180 }, data: { label: "Lojistik" } },
      { id: "org-fac1",    type: "facilityNode", position: { x: 60,  y: 320 }, data: { label: "Tesis A" } },
      { id: "org-fac2",    type: "facilityNode", position: { x: 280, y: 320 }, data: { label: "Tesis B" } },
      { id: "org-fleet",   type: "vehicleFleetNode", position: { x: 560, y: 320 }, data: { label: "Araç Filosu" } },
      { id: "org-proc1",   type: "processNode",  position: { x: 60,  y: 460 }, data: { label: "Üretim Prosesi" } },
    ],
    edges: [
      { id: "e1", source: "org-root",  target: "org-div1",  type: "orgEdge" },
      { id: "e2", source: "org-root",  target: "org-div2",  type: "orgEdge" },
      { id: "e3", source: "org-div1",  target: "org-fac1",  type: "orgEdge" },
      { id: "e4", source: "org-div1",  target: "org-fac2",  type: "orgEdge" },
      { id: "e5", source: "org-div2",  target: "org-fleet", type: "orgEdge" },
      { id: "e6", source: "org-fac1",  target: "org-proc1", type: "orgEdge" },
    ],
  },
];

type Graph = {
  id: string; tenantId: string; name: string; description: string | null;
  nodesJson: unknown; edgesJson: unknown; viewport: unknown;
  createdBy: string; updatedBy: string | null;
  isTemplate: boolean; templateKey: string | null; templateCategory: string | null;
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
    const graphs = await prisma.esgPlaygroundGraph.findMany({
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

      const graph = await prisma.esgPlaygroundGraph.findFirst({
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

      const graph = await prisma.esgPlaygroundGraph.create({
        data: {
          tenantId,
          name,
          description: description ?? null,
          nodesJson: (nodesJson ?? []) as Prisma.InputJsonValue,
          edgesJson: (edgesJson ?? []) as Prisma.InputJsonValue,
          viewport:  (viewport   ?? { x: 0, y: 0, zoom: 1 }) as Prisma.InputJsonValue,
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

      const existing = await prisma.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

      const { name, description, nodesJson, edgesJson, viewport } = request.body ?? {};

      const updated = await prisma.esgPlaygroundGraph.update({
        where: { id },
        data: {
          ...(name        !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(nodesJson !== undefined && { nodesJson: nodesJson as Prisma.InputJsonValue }),
          ...(edgesJson !== undefined && { edgesJson: edgesJson as Prisma.InputJsonValue }),
          ...(viewport  !== undefined && { viewport:  viewport  as Prisma.InputJsonValue }),
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

      const existing = await prisma.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

      await prisma.esgPlaygroundGraph.delete({ where: { id } });
      return reply.status(204).send();
    },
  );

  // ── GET /esg-playground/:id/snapshots — snapshot listesi ──────────────────
  app.get<{ Params: { id: string } }>(
    "/esg-playground/:id/snapshots",
    async (request, reply) => {
      const { id } = request.params;
      const tenantId = request.tenantId;

      const graph = await prisma.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!graph) return reply.status(404).send({ error: "NOT_FOUND" });

      const snapshots = await prisma.esgPlaygroundSnapshot.findMany({
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

      const graph = await prisma.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!graph) return reply.status(404).send({ error: "NOT_FOUND" });

      const snapshot = await prisma.esgPlaygroundSnapshot.findFirst({
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

      const graph = await prisma.esgPlaygroundGraph.findFirst({ where: { id, tenantId } });
      if (!graph) return reply.status(404).send({ error: "NOT_FOUND" });

      const { name, reportingPeriod } = request.body;
      const hash = hashCanvas(graph.nodesJson, graph.edgesJson);

      const snapshot = await prisma.esgPlaygroundSnapshot.create({
        data: {
          graphId:         id,
          name,
          reportingPeriod: reportingPeriod ?? null,
          nodesJson:       graph.nodesJson as Prisma.InputJsonValue,
          edgesJson:       graph.edgesJson as Prisma.InputJsonValue,
          hash,
          isLocked:        true,
          methodologyVer:  "1.0",
          createdBy:       userId,
        },
      });

      return reply.status(201).send({ snapshot });
    },
  );

  // ── GET /esg-playground/templates — yerleşik şablon listesi ─────────────────
  app.get("/esg-playground/templates", async (_request, reply) => {
    const templates = CANVAS_TEMPLATES.map(t => ({
      id:              t.key,
      name:            t.name,
      description:     t.description,
      isTemplate:      true,
      templateKey:     t.key,
      templateCategory: t.category,
      icon:            t.icon,
      createdAt:       new Date().toISOString(),
      updatedAt:       new Date().toISOString(),
    }));
    return reply.send({ templates });
  });

  // ── POST /esg-playground/templates/:key/clone — şablondan canvas oluştur ──
  app.post<{
    Params: { key: string };
    Body: { name?: string; description?: string }
  }>(
    "/esg-playground/templates/:key/clone",
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
      const { key } = request.params;
      const tenantId = request.tenantId;
      const userId   = request.userId;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const template = CANVAS_TEMPLATES.find(t => t.key === key);
      if (!template) return reply.status(404).send({ error: "TEMPLATE_NOT_FOUND" });

      const { name, description } = request.body ?? {};

      const graph = await prisma.esgPlaygroundGraph.create({
        data: {
          tenantId,
          name:        name        ?? template.name,
          description: description ?? template.description,
          nodesJson:   template.nodes as Prisma.InputJsonValue,
          edgesJson:   template.edges as Prisma.InputJsonValue,
          viewport:    { x: 0, y: 0, zoom: 0.9 } as Prisma.InputJsonValue,
          createdBy:   userId,
        },
      });

      return reply.status(201).send({ graph });
    },
  );

  // ── POST /esg-playground/generate-from-company — şirket verisinden otomatik canvas ──
  app.post<{ Body: { name?: string; includeProducts?: boolean } }>(
    "/esg-playground/generate-from-company",
    {
      schema: {
        body: {
          type: "object",
          properties: {
            name:            { type: "string", maxLength: 200 },
            includeProducts: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const userId   = request.userId;
      if (!userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

      const { name = "Şirket Canvas'ı", includeProducts = true } = request.body ?? {};

      // Veri çek — tüm tesisler + CBAM tesisleri
      const [installations, cbamFacilities] = await Promise.all([
        prisma.installation.findMany({
          where:  { tenantId },
          select: { id: true, facilityName: true, facilityCountry: true, sector: true },
          take:   50,
        }),
        prisma.cbamFacility.findMany({
          where:   { tenantId },
          include: { products: { select: { id: true, productName: true, cnCode: true }, take: 10 } },
          take:    20,
        }),
      ]);

      const nodes: unknown[] = [];
      const edges: unknown[] = [];
      let x = 100;
      let y = 100;

      // Scope grupları (sabit konumda, sol köşe)
      nodes.push(
        { id: "sg-scope1", type: "scopeGroupNode", position: { x: -220, y: 80  }, data: { label: "Scope 1", scope: 1 }, style: { width: 180, height: 100 } },
        { id: "sg-scope2", type: "scopeGroupNode", position: { x: -220, y: 220 }, data: { label: "Scope 2", scope: 2 }, style: { width: 180, height: 100 } },
        { id: "sg-scope3", type: "scopeGroupNode", position: { x: -220, y: 360 }, data: { label: "Scope 3", scope: 3 }, style: { width: 180, height: 100 } },
      );

      // Tesisler + sayaç + emisyon hesabı tripleti
      for (const inst of installations) {
        const facilityId  = `auto-fac-${inst.id}`;
        const meterId     = `auto-meter-${inst.id}`;
        const emCalcId    = `auto-emcalc-${inst.id}`;

        nodes.push(
          { id: facilityId, type: "facilityNode", position: { x, y },
            data: { label: inst.facilityName, country: inst.facilityCountry,
                    sector: inst.sector, sourceId: inst.id, sourceType: "installation" } },
          { id: meterId, type: "meterNode", position: { x: x + 240, y },
            data: { label: `${inst.facilityName} Sayacı` } },
          { id: emCalcId, type: "emissionCalcNode", position: { x: x + 460, y },
            data: { label: "Emisyon Hesabı", sourceId: inst.id, sourceType: "installation" } },
        );
        edges.push(
          { id: `e-fm-${inst.id}`,  source: facilityId, target: meterId,  type: "dataFlowEdge",   animated: true },
          { id: `e-mec-${inst.id}`, source: meterId,    target: emCalcId, type: "dataFlowEdge",   animated: true },
        );

        y += 180;
        if (y > 1600) { y = 100; x += 720; }
      }

      // GHG raporu (sağda)
      const reportX = x + 720;
      nodes.push({
        id: "auto-ghg-report", type: "ghgReportNode",
        position: { x: reportX, y: 200 },
        data: { label: "GHG Raporu" },
      });

      // CBAM tesisleri + ürünler (ayrı sütun)
      let cbamX = reportX + 220;
      let cbamY = 100;
      for (const fac of cbamFacilities) {
        const cbamFacId = `auto-cbamfac-${fac.id}`;
        nodes.push({
          id: cbamFacId, type: "facilityNode",
          position: { x: cbamX, y: cbamY },
          data: { label: fac.facilityName, country: fac.facilityCountry,
                  sourceId: fac.id, sourceType: "cbamFacility" },
        });

        if (includeProducts) {
          let prodY = cbamY + 160;
          for (const prod of (fac.products ?? [])) {
            const prodId = `auto-prod-${prod.id}`;
            nodes.push({
              id: prodId, type: "productNode",
              position: { x: cbamX + 30, y: prodY },
              data: { label: prod.productName, cnCode: prod.cnCode,
                      sourceId: prod.id, sourceType: "cbamProduct" },
            });
            edges.push({ id: `e-fp-${prod.id}`, source: cbamFacId, target: prodId, type: "dataFlowEdge" });
            prodY += 130;
          }
          cbamY = prodY + 40;
        } else {
          cbamY += 180;
        }
      }

      if (cbamFacilities.length > 0) {
        const cbamCalcId = `auto-cbam-calc`;
        const cbamRepId  = `auto-cbam-report`;
        nodes.push(
          { id: cbamCalcId, type: "cbamCalcNode",   position: { x: cbamX + 240, y: 200 }, data: { label: "CBAM Hesabı" } },
          { id: cbamRepId,  type: "cbamReportNode", position: { x: cbamX + 440, y: 200 }, data: { label: "CBAM Raporu" } },
        );
        edges.push(
          { id: "e-calc-rep", source: cbamCalcId, target: cbamRepId, type: "dataFlowEdge", animated: true },
        );
      }

      const graph = await prisma.esgPlaygroundGraph.create({
        data: {
          tenantId,
          name,
          description: `${installations.length} tesis, ${cbamFacilities.length} CBAM tesisinden otomatik oluşturuldu`,
          nodesJson: nodes as Prisma.InputJsonValue,
          edgesJson: edges as Prisma.InputJsonValue,
          viewport:  { x: 0, y: 0, zoom: 0.7 } as Prisma.InputJsonValue,
          createdBy:  userId,
        },
      });

      return reply.status(201).send({
        graph,
        summary: {
          installations: installations.length,
          cbamFacilities: cbamFacilities.length,
          nodesCreated: nodes.length,
          edgesCreated: edges.length,
        },
      });
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

  // ── GET /canvas-live-data — batch zone CI + RE verisi ────────────────────
  // ?zones=DE,FR,TR → tüm zone'ların son saatlik EF verisini tek seferde döner
  app.get<{ Querystring: { zones?: string } }>(
    "/canvas-live-data",
    async (request, reply) => {
      const rawZones = request.query.zones ?? "DE";
      const zones = rawZones.split(",").map(z => z.trim()).filter(Boolean).slice(0, 20);

      const now        = new Date();
      const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);

      const { Prisma } = await import("@voltfox/db");

      const rows = await prisma.$queryRaw<Array<{
        zone_id: string; ci_direct: number; re_pct: number; hour: Date;
      }>>(Prisma.sql`
        SELECT DISTINCT ON (zone_id)
          zone_id, ci_direct, re_pct, hour
        FROM emission_factors
        WHERE zone_id = ANY(${zones}::text[])
          AND hour  >= ${twoHoursAgo}
          AND hour  <= ${now}
        ORDER BY zone_id, hour DESC
      `);

      const result: Record<string, { ci: number | null; rePct: number | null; updatedAt: string | null }> = {};
      for (const zone of zones) {
        const row = rows.find(r => r.zone_id === zone);
        result[zone] = row
          ? { ci: Number(row.ci_direct), rePct: Number(row.re_pct), updatedAt: row.hour.toISOString() }
          : { ci: null, rePct: null, updatedAt: null };
      }

      return reply.send({ zones: result });
    },
  );
};
