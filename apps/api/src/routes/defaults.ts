import type { FastifyPluginAsync } from "fastify";
import { lookupGridEF, listSupportedCountries } from "../../../../src/cbam/ef-data.js";

// CBAM defaults verisi — build sırasında import edilir
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const CBAM: {
  meta:      { version: string; validFrom: string; source: string };
  countries: Record<string, Array<[string, number|null, number|null, number|null, number|null, number|null, number|null, boolean]>>;
  cn:        Record<string, { d: string; sectors: string[] }>;
} = require("../../../../cbam-defaults.json");

export const defaultsRoutes: FastifyPluginAsync = async (app) => {

  // GET /defaults/meta
  app.get("/defaults/meta", { config: { public: true } }, async (_req, reply) => {
    return reply.send(CBAM.meta);
  });

  // GET /defaults/countries  — ülke listesi
  app.get("/defaults/countries", { config: { public: true } }, async (_req, reply) => {
    const countries = Object.keys(CBAM.countries).sort();
    return reply.send({ countries });
  });

  // GET /defaults/countries/:country/cn-codes
  app.get("/defaults/countries/:country/cn-codes", { config: { public: true } }, async (request, reply) => {
    const { country } = request.params as { country: string };
    const rows = CBAM.countries[country];
    if (!rows) return reply.status(404).send({ error: "COUNTRY_NOT_FOUND" });

    const result = rows.map(([cn, direct, indirect, total, y2026, y2027, y2028, scope2Exempt]) => ({
      cnCode:       cn,
      description:  CBAM.cn[cn]?.d ?? "",
      sectors:      CBAM.cn[cn]?.sectors ?? [],
      direct, indirect, total, y2026, y2027, y2028,
      scope2Exempt,
    }));

    return reply.send({ country, cnCodes: result });
  });

  // GET /defaults/countries/:country/cn-codes/:cnCode
  app.get("/defaults/countries/:country/cn-codes/:cnCode", { config: { public: true } }, async (request, reply) => {
    const { country, cnCode } = request.params as { country: string; cnCode: string };
    const rows = CBAM.countries[country];
    if (!rows) return reply.status(404).send({ error: "COUNTRY_NOT_FOUND" });

    const row = rows.find(r => r[0] === cnCode);
    if (!row) return reply.status(404).send({ error: "CN_NOT_FOUND" });

    const [cn, direct, indirect, total, y2026, y2027, y2028, scope2Exempt] = row;
    return reply.send({
      country, cnCode: cn,
      description: CBAM.cn[cn]?.d ?? "",
      sectors:     CBAM.cn[cn]?.sectors ?? [],
      direct, indirect, total, y2026, y2027, y2028,
      scope2Exempt,
      meta: CBAM.meta,
    });
  });

  // ── Grid EF endpoints ──────────────────────────────────────────────────────

  // GET /defaults/ef — desteklenen tüm ülkelerin grid EF listesi
  app.get("/defaults/ef", { config: { public: true } }, async (_req, reply) => {
    return reply.send({
      dataVersion: "2024-IEA",
      countries:   listSupportedCountries(),
    });
  });

  // GET /defaults/ef/:country — tek ülke EF (ISO2 veya tam isim)
  app.get("/defaults/ef/:country", { config: { public: true } }, async (request, reply) => {
    const { country } = request.params as { country: string };
    const result = lookupGridEF(country);
    if (!result) {
      return reply.status(404).send({
        error: "EF_NOT_FOUND",
        message: `'${country}' için grid EF verisi bulunamadı. /defaults/ef ile desteklenen ülkeleri listeleyin.`,
      });
    }
    return reply.send(result);
  });

  // GET /defaults/search?q=...  — CN kodu veya açıklama ile ara
  app.get("/defaults/search", { config: { public: true } }, async (request, reply) => {
    const { q } = request.query as { q?: string };
    if (!q || q.length < 2) return reply.status(400).send({ error: "Query too short" });

    const lower = q.toLowerCase();
    const matches = Object.entries(CBAM.cn)
      .filter(([code, info]) =>
        code.includes(lower) || info.d.toLowerCase().includes(lower)
      )
      .slice(0, 50)
      .map(([code, info]) => ({ cnCode: code, description: info.d, sectors: info.sectors }));

    return reply.send({ results: matches });
  });
};
