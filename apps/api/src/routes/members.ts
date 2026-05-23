import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { requireRole, ROLE_RANK } from "../plugins/rbac.js";
import { notifyEmail, notifyTenant } from "../lib/notify.js";
import { emailMemberInvited } from "../lib/email.js";

const VALID_ROLES = ["owner", "admin", "analyst", "viewer"] as const;

export const membersRoutes: FastifyPluginAsync = async (app) => {

  // GET /members — tenant üyelerini listele (admin+)
  app.get("/members", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const members = await prisma.tenantMember.findMany({
      where:   { tenantId: request.tenantId },
      orderBy: { createdAt: "asc" },
      select:  { id: true, userId: true, role: true, createdAt: true },
    });

    // Supabase'den email + display_name bilgisi çek
    const enriched = await Promise.all(
      members.map(async (m) => {
        try {
          const { data } = await app.supabase.auth.admin.getUserById(m.userId);
          return {
            ...m,
            email:       data.user?.email ?? null,
            displayName: (data.user?.user_metadata?.display_name as string | undefined) ?? null,
          };
        } catch {
          return { ...m, email: null, displayName: null };
        }
      }),
    );

    return reply.send({ members: enriched });
  });

  // GET /members/invites — bekleyen davetleri listele (admin+)
  app.get("/members/invites", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const invites = await prisma.memberInvite.findMany({
      where:   { tenantId: request.tenantId, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      select:  { id: true, email: true, role: true, expiresAt: true, createdAt: true, token: true },
    });

    return reply.send({ invites });
  });

  // DELETE /members/invites/:id — daveti iptal et (admin+)
  app.delete("/members/invites/:id", async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { id } = request.params as { id: string };
    const invite = await prisma.memberInvite.findFirst({
      where: { id, tenantId: request.tenantId },
    });
    if (!invite) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.memberInvite.delete({ where: { id } });
    return reply.status(204).send();
  });

  // POST /members/invite — email ile davet et (admin+)
  app.post("/members/invite", {
    schema: {
      body: {
        type: "object",
        required: ["email", "role"],
        properties: {
          email: { type: "string", format: "email" },
          role:  { type: "string", enum: VALID_ROLES as unknown as string[] },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { email, role } = request.body as { email: string; role: string };

    if (role === "owner" && !await requireRole(request, reply, "owner")) return;

    // Mevcut kullanıcıyı email ile ara
    const { data: userList } = await app.supabase.auth.admin.listUsers({ perPage: 1000 });
    const existingUser = userList?.users?.find(u => u.email === email);

    let userId: string;

    if (existingUser) {
      userId = existingUser.id;
      // Mevcut kullanıcı → direkt üyelik upsert
      const member = await prisma.tenantMember.upsert({
        where:  { tenantId_userId: { tenantId: request.tenantId, userId } },
        create: { tenantId: request.tenantId, userId, role },
        update: { role },
      });
      return reply.status(201).send({ member, invited: false, message: "Mevcut kullanıcı eklendi." });
    }

    // Yeni kullanıcı → davet token oluştur (48 saat geçerli)
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);
    const [invite, tenant] = await Promise.all([
      prisma.memberInvite.create({
        data: { tenantId: request.tenantId, email, role, expiresAt },
      }),
      prisma.tenant.findUnique({ where: { id: request.tenantId }, select: { name: true } }),
    ]);

    const inviterEmail = request.userId
      ? (await app.supabase.auth.admin.getUserById(request.userId)).data.user?.email ?? "Voltfox"
      : "Voltfox";

    // Fire-and-forget davet e-postası + tenant üyelerine bildirim
    const inviteUrl = `/invite/${invite.token}`;
    const { subject, html } = emailMemberInvited({
      tenantName: tenant?.name ?? "Voltfox",
      invitedBy:  inviterEmail,
      role,
      inviteUrl,
      appUrl:     process.env.APP_URL ?? "https://app.voltfox.io",
      expiresAt:  invite.expiresAt.toISOString(),
    });
    notifyEmail(email, subject, html).catch(() => {});
    notifyTenant({
      tenantId:  request.tenantId,
      eventType: "memberInvited",
      title:     `Davet gönderildi: ${email}`,
      body:      `${email} adresine ${role} rolüyle davet bağlantısı gönderildi.`,
    }).catch(() => {});

    return reply.status(201).send({
      invited:     true,
      inviteToken: invite.token,
      inviteUrl,
      expiresAt:   invite.expiresAt.toISOString(),
      message:     "Davet bağlantısı oluşturuldu.",
    });
  });

  // POST /members — userId ile direkt ekle (geriye uyumluluk)
  app.post("/members", {
    schema: {
      body: {
        type: "object",
        required: ["userId", "role"],
        properties: {
          userId: { type: "string", format: "uuid" },
          role:   { type: "string", enum: VALID_ROLES as unknown as string[] },
        },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { userId, role } = request.body as { userId: string; role: string };

    if (role === "owner" && !await requireRole(request, reply, "owner")) return;

    const member = await prisma.tenantMember.upsert({
      where:  { tenantId_userId: { tenantId: request.tenantId, userId } },
      create: { tenantId: request.tenantId, userId, role },
      update: { role },
    });

    return reply.status(201).send(member);
  });

  // PATCH /members/:userId — rol güncelle (admin+, owner rolü sadece owner değiştirebilir)
  app.patch("/members/:userId", {
    schema: {
      body: {
        type: "object",
        required: ["role"],
        properties: { role: { type: "string", enum: VALID_ROLES as unknown as string[] } },
      },
    },
  }, async (request, reply) => {
    if (!await requireRole(request, reply, "admin")) return;

    const { userId } = request.params as { userId: string };
    const { role }   = request.body as { role: string };

    const existing = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

    // owner rolüne terfi veya owner'ı değiştirme sadece owner yapabilir
    const targetRank  = ROLE_RANK[role] ?? 0;
    const currentRank = ROLE_RANK[existing.role] ?? 0;
    if (targetRank >= ROLE_RANK["owner"] || currentRank >= ROLE_RANK["owner"]) {
      if (!await requireRole(request, reply, "owner")) return;
    }

    const updated = await prisma.tenantMember.update({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
      data:  { role },
    });

    return reply.send(updated);
  });

  // DELETE /members/:userId — üyeyi çıkar (owner only)
  app.delete("/members/:userId", async (request, reply) => {
    if (!await requireRole(request, reply, "owner")) return;

    const { userId } = request.params as { userId: string };

    const existing = await prisma.tenantMember.findUnique({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });
    if (!existing) return reply.status(404).send({ error: "NOT_FOUND" });

    await prisma.tenantMember.delete({
      where: { tenantId_userId: { tenantId: request.tenantId, userId } },
    });

    return reply.status(204).send();
  });

  // GET /members/me — kendi rolünü öğren
  app.get("/members/me", async (request, reply) => {
    if (!request.userId) {
      return reply.send({ role: "owner", note: "dev-bypass — no JWT auth" });
    }

    const member = await prisma.tenantMember.findUnique({
      where:  { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
      select: { role: true },
    });

    if (!member) return reply.status(403).send({ error: "NOT_MEMBER" });
    return reply.send({ role: member.role });
  });

  // GET /members/me/export — GDPR veri dışa aktarma (kullanıcıya ait tüm veriler)
  app.get("/members/me/export", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const [member, auditLogs] = await Promise.all([
      prisma.tenantMember.findUnique({
        where:  { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
        select: { role: true, createdAt: true },
      }),
      prisma.auditLog.findMany({
        where:   { tenantId: request.tenantId, userId: request.userId },
        orderBy: { createdAt: "desc" },
        take:    500,
        select:  { action: true, resource: true, resourceId: true, createdAt: true, ipAddress: true },
      }),
    ]);

    if (!member) return reply.status(403).send({ error: "NOT_MEMBER" });

    const exportData = {
      exportedAt: new Date().toISOString(),
      userId:     request.userId,
      tenantId:   request.tenantId,
      membership: { role: member.role, joinedAt: member.createdAt.toISOString() },
      auditLog:   auditLogs.map(l => ({
        action:     l.action,
        resource:   l.resource,
        resourceId: l.resourceId,
        at:         l.createdAt.toISOString(),
        ip:         l.ipAddress,
      })),
    };

    reply.header("Content-Disposition", `attachment; filename="voltfox-data-export-${new Date().toISOString().slice(0, 10)}.json"`);
    reply.header("Content-Type", "application/json");
    return reply.send(JSON.stringify(exportData, null, 2));
  });

  // DELETE /members/me — hesaptan ayrıl (kendi kaydını sil)
  app.delete("/members/me", async (request, reply) => {
    if (!request.userId) return reply.status(401).send({ error: "UNAUTHORIZED" });

    // Owner tenant'ı tek başına bırakamaz
    const [member, ownerCount] = await Promise.all([
      prisma.tenantMember.findUnique({
        where:  { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
      }),
      prisma.tenantMember.count({
        where: { tenantId: request.tenantId, role: "owner" },
      }),
    ]);

    if (!member) return reply.status(404).send({ error: "NOT_FOUND" });

    if (member.role === "owner" && ownerCount <= 1) {
      return reply.status(400).send({
        error:   "LAST_OWNER",
        message: "Tenant'ın son owner'ısınız. Ayrılmadan önce başka birine owner rolü verin.",
      });
    }

    await prisma.tenantMember.delete({
      where: { tenantId_userId: { tenantId: request.tenantId, userId: request.userId } },
    });

    return reply.status(204).send();
  });
};
