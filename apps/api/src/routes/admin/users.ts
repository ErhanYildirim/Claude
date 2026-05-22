import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const adminUsersRoutes: FastifyPluginAsync = async (app) => {

  // GET /admin/users — Supabase'deki tüm kullanıcılar
  app.get("/admin/users", async (request, reply) => {
    const { search, page = "1" } = request.query as { search?: string; page?: string };

    const perPage = 50;
    const { data, error } = await app.supabase.auth.admin.listUsers({
      page:    parseInt(page),
      perPage,
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });

    const users = data.users.filter(u =>
      !search || u.email?.includes(search) || u.id.includes(search)
    );

    return reply.send({
      users: users.map(u => ({
        id:             u.id,
        email:          u.email,
        createdAt:      u.created_at,
        lastSignIn:     u.last_sign_in_at,
        banned:         u.banned_until ? new Date(u.banned_until) > new Date() : false,
        emailConfirmed: !!u.email_confirmed_at,
        isSuperAdmin:   u.app_metadata?.is_super_admin === true,
        tenantId:       u.app_metadata?.tenant_id ?? null,
      })),
      total: data.total ?? users.length,
    });
  });

  // POST /admin/users/:id/ban — kullanıcıyı yasakla
  app.post("/admin/users/:id/ban", async (request, reply) => {
    const { id }    = request.params as { id: string };
    const { hours } = request.body as { hours?: number };
    const banDuration = `${hours ?? 24}h`;

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      ban_duration: banDuration,
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ banned: true, banDuration });
  });

  // POST /admin/users/:id/unban — yasağı kaldır
  app.post("/admin/users/:id/unban", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      ban_duration: "none",
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ banned: false });
  });

  // POST /admin/users/:id/confirm-email — e-postayı doğrulanmış say
  app.post("/admin/users/:id/confirm-email", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      email_confirm: true,
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ emailConfirmed: true });
  });

  // DELETE /admin/users/:id — kullanıcıyı kalıcı sil
  app.delete("/admin/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Önce tenant üyeliklerini temizle
    await prisma.tenantMember.deleteMany({ where: { userId: id } });

    const { error } = await app.supabase.auth.admin.deleteUser(id);
    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.status(204).send();
  });

  // PATCH /admin/users/:id/super-admin — super-admin flag'i güncelle
  app.patch("/admin/users/:id/super-admin", async (request, reply) => {
    const { id }         = request.params as { id: string };
    const { superAdmin } = request.body as { superAdmin: boolean };

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      app_metadata: { is_super_admin: superAdmin },
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ isSuperAdmin: superAdmin });
  });
};
