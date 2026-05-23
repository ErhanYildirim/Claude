import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const adminUsersRoutes: FastifyPluginAsync = async (app) => {

  // GET /users — Supabase'deki tüm kullanıcılar
  app.get("/users", async (request, reply) => {
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

  // POST /users/:id/ban — kullanıcıyı yasakla
  app.post("/users/:id/ban", async (request, reply) => {
    const { id }    = request.params as { id: string };
    const { hours } = request.body as { hours?: number };
    const banDuration = `${hours ?? 24}h`;

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      ban_duration: banDuration,
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ banned: true, banDuration });
  });

  // POST /users/:id/unban — yasağı kaldır
  app.post("/users/:id/unban", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      ban_duration: "none",
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ banned: false });
  });

  // POST /users/:id/confirm-email — e-postayı doğrulanmış say
  app.post("/users/:id/confirm-email", async (request, reply) => {
    const { id } = request.params as { id: string };

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      email_confirm: true,
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ emailConfirmed: true });
  });

  // DELETE /users/:id — kullanıcıyı kalıcı sil
  app.delete("/users/:id", async (request, reply) => {
    const { id } = request.params as { id: string };

    // Önce tenant üyeliklerini temizle
    await prisma.tenantMember.deleteMany({ where: { userId: id } });

    const { error } = await app.supabase.auth.admin.deleteUser(id);
    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.status(204).send();
  });

  // PATCH /users/:id/super-admin — super-admin flag'i güncelle
  app.patch("/users/:id/super-admin", async (request, reply) => {
    const { id }         = request.params as { id: string };
    const { superAdmin } = request.body as { superAdmin: boolean };

    const { error } = await app.supabase.auth.admin.updateUserById(id, {
      app_metadata: { is_super_admin: superAdmin },
    });

    if (error) return reply.status(500).send({ error: "SUPABASE_ERROR", message: error.message });
    return reply.send({ isSuperAdmin: superAdmin });
  });
};
