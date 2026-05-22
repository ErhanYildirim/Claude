import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
}

async function uniqueSlug(base: string): Promise<string> {
  let slug = base;
  let attempt = 0;
  while (true) {
    const existing = await prisma.tenant.findUnique({ where: { slug } });
    if (!existing) return slug;
    attempt++;
    slug = `${base}-${attempt}`;
  }
}

export const onboardingRoutes: FastifyPluginAsync = async (app) => {

  // POST /onboarding/tenant — yeni tenant oluştur + isteği yapan user'ı owner yap
  // Bu endpoint: Supabase Auth callback'inden sonra, kullanıcı ilk girişte çağrılır.
  // JWT'de henüz tenant_id yok; bu route kamuya açık değil ama tenant kontrolü atlanır.
  app.post("/onboarding/tenant", {
    config: { public: true, rateLimit: { max: 5, timeWindow: "1 minute" } },
    schema: {
      body: {
        type: "object",
        required: ["companyName"],
        properties: {
          companyName: { type: "string", minLength: 2, maxLength: 100 },
          timezone:    { type: "string", maxLength: 60 },
        },
      },
    },
  }, async (request, reply) => {
    // Auth header'dan userId çek — tenant_id olmadan, sadece user doğrulama
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ") || !app.hasDecorator("supabase")) {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error } = await app.supabase.auth.getUser(token);
    if (error || !user) {
      return reply.status(401).send({ error: "UNAUTHORIZED", message: "Geçersiz oturum." });
    }

    // Kullanıcı zaten bir tenant'a ait mi?
    const existingMember = await prisma.tenantMember.findFirst({
      where: { userId: user.id },
    });
    if (existingMember) {
      const tenant = await prisma.tenant.findUnique({ where: { id: existingMember.tenantId } });
      return reply.status(200).send({
        message:  "Kullanıcı zaten bir tenant'a kayıtlı.",
        tenantId: existingMember.tenantId,
        role:     existingMember.role,
        tenant,
      });
    }

    const { companyName, timezone } = request.body as { companyName: string; timezone?: string };
    const slug = await uniqueSlug(slugify(companyName));

    const [tenant] = await prisma.$transaction([
      prisma.tenant.create({
        data: { name: companyName, slug, ...(timezone ? { timezone } : {}) },
      }),
    ]);

    await prisma.tenantMember.create({
      data: { tenantId: tenant.id, userId: user.id, role: "owner" },
    });

    await prisma.auditLog.create({
      data: {
        tenantId:   tenant.id,
        userId:     user.id,
        action:     "CREATE",
        resource:   "Tenant",
        resourceId: tenant.id,
        payload:    { companyName, slug },
      },
    });

    return reply.status(201).send({
      tenantId: tenant.id,
      slug:     tenant.slug,
      role:     "owner",
      message:  "Tenant oluşturuldu. Supabase app_metadata güncellenmesi için Edge Function'ı tetikleyin.",
    });
  });

  // GET /onboarding/me — kullanıcının tenant durumunu kontrol et
  app.get("/onboarding/me", {
    config: { public: true },
  }, async (request, reply) => {
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith("Bearer ") || !app.hasDecorator("supabase")) {
      return reply.status(401).send({ error: "UNAUTHORIZED" });
    }

    const token = authHeader.slice(7);
    const { data: { user }, error } = await app.supabase.auth.getUser(token);
    if (error || !user) return reply.status(401).send({ error: "UNAUTHORIZED" });

    const member = await prisma.tenantMember.findFirst({
      where: { userId: user.id },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });

    if (!member) {
      return reply.send({ onboarded: false, userId: user.id });
    }

    return reply.send({
      onboarded: true,
      userId:    user.id,
      tenantId:  member.tenantId,
      role:      member.role,
      tenant:    member.tenant,
    });
  });
};
