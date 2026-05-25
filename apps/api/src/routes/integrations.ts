import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

const VALID_KEYS = new Set([
  "entso-e",
  "epias",
  "cbam-terminal",
  "cdp-terminal",
  "irec-evidence",
  "open-meteo",
  "ttf-gas",
  "ets-carbon",
]);

const VALID_STATUSES = new Set([
  "connected", "disconnected", "error", "beta", "coming_soon",
]);

export const integrationsRoutes: FastifyPluginAsync = async (app) => {

  // GET /integrations — tenant'ın tüm entegrasyon config'leri
  app.get("/integrations", async (request, reply) => {
    const tenantId = request.tenantId;

    const configs = await (prisma as unknown as {
      integrationConfig: {
        findMany: (args: object) => Promise<Array<{
          id: string; key: string; enabled: boolean;
          configEnc: Record<string, unknown>; status: string;
          lastTestedAt: Date | null; testMessage: string | null;
          createdAt: Date; updatedAt: Date;
        }>>
      }
    }).integrationConfig.findMany({
      where:   { tenantId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, key: true, enabled: true, configEnc: true,
        status: true, lastTestedAt: true, testMessage: true,
        createdAt: true, updatedAt: true,
      },
    });

    // Hassas alanları maskele (şifre, token vb.)
    const masked = configs.map(c => ({
      ...c,
      config: maskSensitiveFields(c.configEnc as Record<string, unknown>),
    }));

    return reply.send({ integrations: masked });
  });

  // PUT /integrations/:key — upsert config
  app.put<{ Params: { key: string }; Body: { config?: Record<string, string>; enabled?: boolean } }>(
    "/integrations/:key",
    {
      schema: {
        params: { type: "object", required: ["key"], properties: { key: { type: "string" } } },
        body: {
          type: "object",
          properties: {
            config:  { type: "object" },
            enabled: { type: "boolean" },
          },
        },
      },
    },
    async (request, reply) => {
      const { key } = request.params;
      const { config = {}, enabled = false } = request.body;
      const tenantId = request.tenantId;

      if (!VALID_KEYS.has(key)) {
        return reply.status(400).send({ error: "Geçersiz entegrasyon anahtarı" });
      }

      const record = await (prisma as unknown as {
        integrationConfig: {
          upsert: (args: object) => Promise<{ id: string; key: string; status: string }>
        }
      }).integrationConfig.upsert({
        where:  { tenantId_key: { tenantId, key } },
        create: {
          tenantId,
          key,
          enabled,
          configEnc: config,
          status: enabled ? "disconnected" : "disconnected",
        },
        update: {
          enabled,
          configEnc: config,
          updatedAt: new Date(),
        },
      });

      return reply.send({ integration: record, message: "Yapılandırma kaydedildi" });
    }
  );

  // DELETE /integrations/:key — config'i sil
  app.delete<{ Params: { key: string } }>(
    "/integrations/:key",
    async (request, reply) => {
      const { key } = request.params;
      const tenantId = request.tenantId;

      if (!VALID_KEYS.has(key)) {
        return reply.status(400).send({ error: "Geçersiz entegrasyon anahtarı" });
      }

      await (prisma as unknown as {
        integrationConfig: {
          deleteMany: (args: object) => Promise<{ count: number }>
        }
      }).integrationConfig.deleteMany({
        where: { tenantId, key },
      });

      return reply.status(204).send();
    }
  );

  // POST /integrations/:key/test — bağlantı testi
  app.post<{ Params: { key: string } }>(
    "/integrations/:key/test",
    async (request, reply) => {
      const { key } = request.params;
      const tenantId = request.tenantId;

      if (!VALID_KEYS.has(key)) {
        return reply.status(400).send({ error: "Geçersiz entegrasyon anahtarı" });
      }

      const record = await (prisma as unknown as {
        integrationConfig: {
          findUnique: (args: object) => Promise<{ configEnc: Record<string, unknown> } | null>
        }
      }).integrationConfig.findUnique({
        where: { tenantId_key: { tenantId, key } },
        select: { configEnc: true },
      });

      if (!record) {
        return reply.status(404).send({ error: "Entegrasyon yapılandırması bulunamadı. Önce kaydedin." });
      }

      let testResult: { ok: boolean; message: string };

      switch (key) {
        case "entso-e":
          testResult = await testEntsoE(record.configEnc as Record<string, string>);
          break;
        case "epias":
          testResult = await testEpias(record.configEnc as Record<string, string>);
          break;
        default:
          testResult = { ok: false, message: "Bu entegrasyon için test henüz desteklenmiyor" };
      }

      // Sonucu DB'ye yaz
      await (prisma as unknown as {
        integrationConfig: {
          update: (args: object) => Promise<unknown>
        }
      }).integrationConfig.update({
        where: { tenantId_key: { tenantId, key } },
        data: {
          status:       testResult.ok ? "connected" : "error",
          lastTestedAt: new Date(),
          testMessage:  testResult.message,
        },
      });

      const statusCode = testResult.ok ? 200 : 422;
      return reply.status(statusCode).send({
        ok:      testResult.ok,
        message: testResult.message,
        testedAt: new Date().toISOString(),
      });
    }
  );
};

/* ── Test helpers ───────────────────────────────────────────────────────── */

async function testEntsoE(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const token = config["apiToken"];
  if (!token) return { ok: false, message: "API token girilmemiş" };

  try {
    const url = `https://web-api.tp.entsoe.eu/api?securityToken=${encodeURIComponent(token)}&documentType=A73&processType=A16&in_Domain=10YFR-RTE------C&outBiddingZone_Domain=10YFR-RTE------C&periodStart=202301010000&periodEnd=202301020000`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10_000) });
    if (res.ok || res.status === 401) {
      if (res.status === 401) return { ok: false, message: "API token geçersiz veya yetkisiz" };
      return { ok: true, message: "ENTSO-E bağlantısı başarılı" };
    }
    return { ok: false, message: `ENTSO-E yanıt kodu: ${res.status}` };
  } catch {
    return { ok: false, message: "ENTSO-E sunucusuna erişilemiyor" };
  }
}

async function testEpias(config: Record<string, string>): Promise<{ ok: boolean; message: string }> {
  const { username, password } = config;
  if (!username || !password) return { ok: false, message: "Kullanıcı adı ve şifre gerekli" };

  try {
    const res = await fetch("https://seffaflik.epias.com.tr/transparency/service/auth/login", {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ username, password }),
      signal:  AbortSignal.timeout(10_000),
    });
    if (res.ok) return { ok: true, message: "EPIAŞ kimlik doğrulama başarılı" };
    if (res.status === 401) return { ok: false, message: "Kullanıcı adı veya şifre hatalı" };
    return { ok: false, message: `EPIAŞ yanıt kodu: ${res.status}` };
  } catch {
    return { ok: false, message: "EPIAŞ sunucusuna erişilemiyor" };
  }
}

/* ── Maskeleme: şifre/token alanlarını gizle ───────────────────────────── */
const SENSITIVE_KEYS = new Set(["password", "apiKey", "clientSecret", "apiToken", "token"]);

function maskSensitiveFields(config: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(config)) {
    out[k] = SENSITIVE_KEYS.has(k) && typeof v === "string" && v.length > 0
      ? "••••••••"
      : v;
  }
  return out;
}
