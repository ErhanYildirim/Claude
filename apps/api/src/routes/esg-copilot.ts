import type { FastifyPluginAsync } from "fastify";
import Anthropic from "@anthropic-ai/sdk";
import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { prisma } from "@voltfox/db";

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

// ── Tenant API key helper ──────────────────────────────────────────────────────
async function getTenantKey(tenantId: string, provider: string): Promise<string | null> {
  try {
    const cfg = await (prisma as unknown as {
      integrationConfig: {
        findUnique: (a: object) => Promise<{ configEnc: unknown; enabled: boolean } | null>
      }
    }).integrationConfig.findUnique({
      where:  { tenantId_key: { tenantId, key: provider } },
      select: { configEnc: true, enabled: true },
    });
    return (cfg?.configEnc as Record<string, string>)?.apiKey ?? null;
  } catch { return null; }
}

// ── Model → provider mapping ───────────────────────────────────────────────────
function providerFromModel(model: string): string {
  if (model.startsWith("claude-")) return "anthropic";
  if (model.startsWith("gpt-"))    return "openai";
  if (model.startsWith("gemini-")) return "gemini";
  return "anthropic";
}

// ── Provider-agnostic completion ──────────────────────────────────────────────
async function runCompletion(provider: string, apiKey: string, userMessage: string, model?: string): Promise<string> {
  if (provider === "anthropic") {
    const client = new Anthropic({ apiKey });
    const res = await client.messages.create({
      model:      model ?? "claude-sonnet-4-6",
      max_tokens: 1024,
      system:     SYSTEM_PROMPT,
      messages:   [{ role: "user", content: userMessage }],
    });
    return res.content[0].type === "text" ? res.content[0].text : "";
  }

  if (provider === "openai") {
    const client = new OpenAI({ apiKey });
    const res = await client.chat.completions.create({
      model:      model ?? "gpt-4o",
      max_tokens: 1024,
      messages:   [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user",   content: userMessage   },
      ],
      response_format: { type: "json_object" },
    });
    return res.choices[0]?.message?.content ?? "";
  }

  if (provider === "gemini") {
    const genAI    = new GoogleGenerativeAI(apiKey);
    const gemModel = genAI.getGenerativeModel({
      model: model ?? "gemini-2.0-flash",
      systemInstruction: SYSTEM_PROMPT,
    });
    const result = await gemModel.generateContent(userMessage);
    return result.response.text();
  }

  throw new Error(`Bilinmeyen provider: ${provider}`);
}

// ── Copilot route ─────────────────────────────────────────────────────────────
export const esgCopilotRoutes: FastifyPluginAsync = async (app) => {

  const requestCounts = new Map<string, { count: number; resetAt: number }>();

  app.post<{
    Body: {
      graphId?:     string;
      prompt:       string;
      currentNodes?: unknown[];
      currentEdges?: unknown[];
      model?:       string;
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
            model:        { type: "string" },
          },
        },
      },
    },
    async (request, reply) => {
      const tenantId = request.tenantId;
      const userId   = request.userId ?? "anonymous";
      const rateKey  = `${tenantId}:${userId}`;

      // Rate limit
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

      const { prompt, currentNodes = [], currentEdges = [], model } = request.body;

      // If user picked a specific model, prefer that provider
      const preferredProvider = model ? providerFromModel(model) : null;

      // Provider öncelik sırası: tenant key varsa o, yoksa env var
      const PROVIDERS = preferredProvider
        ? [preferredProvider, ...["anthropic", "openai", "gemini"].filter(p => p !== preferredProvider)] as string[]
        : ["anthropic", "openai", "gemini"] as string[];
      let activeProvider: string | null = null;
      let activeKey: string | null = null;

      for (const p of PROVIDERS) {
        const tenantKey = await getTenantKey(tenantId, p);
        if (tenantKey) { activeProvider = p; activeKey = tenantKey; break; }
        // Env var fallback
        if (p === "anthropic" && process.env.ANTHROPIC_API_KEY) {
          activeProvider = p; activeKey = process.env.ANTHROPIC_API_KEY; break;
        }
        if (p === "openai" && process.env.OPENAI_API_KEY) {
          activeProvider = p; activeKey = process.env.OPENAI_API_KEY; break;
        }
        if (p === "gemini" && process.env.GEMINI_API_KEY) {
          activeProvider = p; activeKey = process.env.GEMINI_API_KEY; break;
        }
      }

      if (!activeProvider || !activeKey) {
        return reply.status(503).send({
          error: "COPILOT_UNAVAILABLE",
          message: "AI servisi yapılandırılmamış — Ayarlar > AI Modeller'den Anthropic, OpenAI veya Gemini API anahtarı ekleyin",
        });
      }

      const contextSummary = currentNodes.length > 0
        ? `Existing nodes: ${JSON.stringify(currentNodes.slice(0, 20).map((n: unknown) => {
            const node = n as { id: string; type?: string; data?: { label?: string } };
            return { id: node.id, type: node.type, label: node.data?.label };
          }))}`
        : "Canvas is currently empty.";

      const userMessage = `${contextSummary}\n\nUser request: ${prompt}`;

      try {
        // Yalnızca seçilen model aktif provider ile eşleşiyorsa kullan
        const effectiveModel = (model && providerFromModel(model) === activeProvider) ? model : undefined;
        const rawText = await runCompletion(activeProvider, activeKey, userMessage, effectiveModel);
        const cleaned = rawText.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

        let parsed: { add?: unknown[]; connect?: unknown[]; message?: string };
        try {
          parsed = JSON.parse(cleaned);
        } catch {
          return reply.send({ add: [], connect: [], message: "Yanıt ayrıştırılamadı. Daha açık bir komut deneyin." });
        }

        return reply.send({
          add:      parsed.add     ?? [],
          connect:  parsed.connect ?? [],
          message:  parsed.message ?? "",
          provider: activeProvider,
        });

      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        app.log.warn({ err: errMsg, provider: activeProvider }, "[Copilot] API hatası");

        const isQuota = errMsg.includes("429") || /quota|rate.?limit/i.test(errMsg);
        if (isQuota) {
          const providerNames: Record<string, string> = {
            anthropic: "Anthropic", openai: "OpenAI", gemini: "Google Gemini",
          };
          const name = providerNames[activeProvider ?? ""] ?? activeProvider;
          return reply.status(429).send({
            error: "UPSTREAM_QUOTA",
            message: `${name} API kotası aşıldı — API planınızı veya faturalandırmanızı kontrol edin.`,
          });
        }

        return reply.status(500).send({ error: "COPILOT_ERROR", message: `AI servis hatası (${activeProvider}): ${errMsg}` });
      }
    },
  );
};
