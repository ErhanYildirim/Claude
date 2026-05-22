import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

export const invitesRoutes: FastifyPluginAsync = async (app) => {

  // GET /invite/:token — public: token doğrula, tenant + email bilgisi döndür
  app.get("/invite/:token", { config: { public: true } }, async (request, reply) => {
    const { token } = request.params as { token: string };

    const invite = await prisma.memberInvite.findUnique({
      where:  { token },
      include:{ tenant: { select: { id: true, name: true, slug: true } } },
    });

    if (!invite) return reply.status(404).send({ error: "INVITE_NOT_FOUND" });
    if (invite.usedAt) return reply.status(410).send({ error: "INVITE_ALREADY_USED" });
    if (invite.expiresAt < new Date()) return reply.status(410).send({ error: "INVITE_EXPIRED" });

    return reply.send({
      email:      invite.email,
      role:       invite.role,
      tenantName: invite.tenant.name,
      tenantId:   invite.tenant.id,
    });
  });

  // POST /invite/:token/accept — yeni kullanıcı oluştur + üyeliği aktifeyle
  app.post("/invite/:token/accept", { config: { public: true } }, async (request, reply) => {
    const { token } = request.params as { token: string };
    const { name, password } = request.body as { name?: string; password: string };

    if (!password || password.length < 8) {
      return reply.status(400).send({ error: "WEAK_PASSWORD", message: "Şifre en az 8 karakter olmalı." });
    }

    const invite = await prisma.memberInvite.findUnique({
      where: { token },
    });

    if (!invite) return reply.status(404).send({ error: "INVITE_NOT_FOUND" });
    if (invite.usedAt) return reply.status(410).send({ error: "INVITE_ALREADY_USED" });
    if (invite.expiresAt < new Date()) return reply.status(410).send({ error: "INVITE_EXPIRED" });

    // Supabase'de kullanıcı var mı?
    const { data: userList } = await app.supabase.auth.admin.listUsers({ perPage: 1000 });
    const existing = userList?.users?.find(u => u.email === invite.email);

    let userId: string;

    if (existing) {
      userId = existing.id;
    } else {
      // Yeni kullanıcı oluştur
      const { data: created, error } = await app.supabase.auth.admin.createUser({
        email:          invite.email,
        password,
        email_confirm:  true,
        user_metadata:  { display_name: name ?? invite.email.split("@")[0] },
      });
      if (error || !created?.user) {
        return reply.status(422).send({ error: "CREATE_USER_FAILED", message: error?.message ?? "Kullanıcı oluşturulamadı." });
      }
      userId = created.user.id;
    }

    // Tenant üyeliği oluştur (upsert — zaten varsa rol güncellenir)
    await prisma.tenantMember.upsert({
      where:  { tenantId_userId: { tenantId: invite.tenantId, userId } },
      create: { tenantId: invite.tenantId, userId, role: invite.role },
      update: { role: invite.role },
    });

    // Daveti kullanıldı olarak işaretle
    await prisma.memberInvite.update({
      where: { token },
      data:  { usedAt: new Date() },
    });

    return reply.send({ success: true, message: "Üyelik aktif edildi. Giriş yapabilirsiniz." });
  });
};
