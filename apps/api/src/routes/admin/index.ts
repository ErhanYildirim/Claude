import type { FastifyPluginAsync } from "fastify";
import { requireSuperAdmin } from "../../plugins/admin-auth.js";
import { adminMetricsRoutes }       from "./metrics.js";
import { adminTenantsRoutes }       from "./tenants.js";
import { adminUsersRoutes }         from "./users.js";
import { adminEfRoutes }            from "./ef.js";
import { adminAnnouncementsRoutes } from "./announcements.js";
import { adminWebhooksRoutes }      from "./webhooks.js";
import { adminEntsoeRoutes }        from "./entso-e.js";
import { adminApiMonitoringRoutes } from "./api-monitoring.js";

export const adminRoutes: FastifyPluginAsync = async (app) => {
  // Tüm admin rotaları için super-admin kontrolü
  app.addHook("preHandler", async (request, reply) => {
    await requireSuperAdmin(app, request, reply);
  });

  await app.register(adminMetricsRoutes);
  await app.register(adminTenantsRoutes);
  await app.register(adminUsersRoutes);
  await app.register(adminEfRoutes);
  await app.register(adminAnnouncementsRoutes);
  await app.register(adminWebhooksRoutes);
  await app.register(adminEntsoeRoutes);
  await app.register(adminApiMonitoringRoutes);
};
