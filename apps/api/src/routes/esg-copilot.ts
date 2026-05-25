import type { FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";

const SYSTEM_PROMPT = `You are an ESG Data Architecture Co-Pilot for the Voltfox platform.
The user describes what they want to add to their ESG canvas in natural language (Turkish or English).
You must respond with a JSON object ONLY — no extra text, no markdown fences.

Available node types:
- orgNode: Company / Organization
- divisionNode: Business division or department
- facilityNode: Physical facility / factory
- buildingNode: Building or office
- processNode: Production process
- productNode: CBAM-scope product
- vehicleFleetNode: Vehicle fleet (Scope 1)
- gridNode: Electricity grid connection (Scope 2)
- solarNode: Solar PV generation
- windNode: Wind turbine
- hydroNode: Hydroelectric
- naturalGasNode: Natural gas (Scope 1)
- ppaContractNode: PPA / EAC certificate
- meterNode: Energy meter / measurement point
- apiSourceNode: External API data source
- manualEntryNode: Manual data entry (CSV / form)
- emissionCalcNode: Emission calculation engine
- cfMatchingNode: 24/7 CFE matching calculation
- cbamCalcNode: CBAM indirect emission calculation
- cbamReportNode: CBAM technical report output
- ghgReportNode: GHG Protocol report output
- scopeGroupNode: Scope boundary group (resizable container, data.scope = 1|2|3)

Available edge types:
- energyFlowEdge: electricity flow
- dataFlowEdge: data/measurement flow
- carbonFlowEdge: carbon emission flow
- certFlowEdge: certificate flow
- orgEdge: organizational hierarchy

Response format (JSON only):
{
  "add": [
    { "id": "unique-id", "type": "nodeType", "position": { "x": 100, "y": 100 }, "data": { "label": "...", "color": "#hex" } }
  ],
  "connect": [
    { "id": "edge-id", "source": "source-node-id", "target": "target-node-id", "type": "edgeType" }
  ],
  "message": "Brief explanation in the same language as the user's request"
}

Rules:
- Use existing node IDs from the context when connecting to them
- New node IDs must be unique (use uuidv4-style: node-{timestamp}-{random})
- Position new nodes logically relative to existing ones or at sensible coordinates
- "color" field in data is optional — omit if unsure
- Always respond in the same language as the user's message`;

export const esgCopilotRoutes: FastifyPluginAsync = async (app) => {

  // Rate limiting: copilot için dakikada 10 istek
  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  app.post<{
    Body: {
      graphId:      string;
      prompt:       string;
      currentNodes: unknown[];
      currentEdges: unknown[];
    }
  }>(
    "/esg-playground/copilot",
    {
      schema: {
        body: {
          type: "object",
          required: ["prompt"],
          properties: {
            prompt:       { type: "string", maxLength: 2000 },
            graphId:      { type: "string" },
            currentNodes: { type: "array" },
            currentEdges: { type: "array" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const userId   = request.userId ?? "anonymous";
      const rateKey  = `${tenantId}:${userId}`;

      // Rate limit check
      const now = Date.now();
      const rec = requestCounts.get(rateKey);
      if (rec && rec.resetAt > now) {
        if (rec.count >= 10) {
          return reply.status(429).send({ error: "RATE_LIMITED", message: "Dakikada en fazla 10 istek" });
        }
        rec.count++;
      } else {
        requestCounts.set(rateKey, { count: 1, resetAt: now + 60_000 });
      }

      const { prompt, currentNodes = [], currentEdges = [] } = request.body;

      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return reply.status(503).send({ error: "COPILOT_UNAVAILABLE", message: "AI servisi yapılandırılmamış" });
      }

      const client = new Anthropic({ apiKey });

      const contextSummary = currentNodes.length > 0
        ? `Existing nodes: ${JSON.stringify(currentNodes.slice(0, 20).map((n: unknown) => {
            const node = n as { id: string; type?: string; data?: { label?: string } };
            return { id: node.id, type: node.type, label: node.data?.label };
          }))}`
        : "Canvas is currently empty.";

      const userMessage = `${contextSummary}\n\nUser request: ${prompt}`;

      try {
        const response = await client.messages.create({
          model:      "claude-sonnet-4-6",
          max_tokens: 1024,
          system:     SYSTEM_PROMPT,
          messages:   [{ role: "user", content: userMessage }],
        });

        const rawText = response.content[0].type === "text" ? response.content[0].text : "";

        let parsed: { add?: unknown[]; connect?: unknown[]; message?: string };
        try {
          // JSON'u temizle (```json ... ``` bloklarını soy)
          const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
          parsed = JSON.parse(cleaned);
        } catch {
          return reply.send({
            add: [],
            connect: [],
            message: "Yanıt ayrıştırılamadı. Lütfen daha açık bir komut deneyin.",
          });
        }

        return reply.send({
          add:     parsed.add     ?? [],
          connect: parsed.connect ?? [],
          message: parsed.message ?? "",
        });

      } catch (err) {
        app.log.warn({ err }, "[Copilot] API hatası");
        return reply.status(500).send({ error: "COPILOT_ERROR", message: "AI servisi geçici olarak kullanılamıyor" });
      }
    },
  );
};
