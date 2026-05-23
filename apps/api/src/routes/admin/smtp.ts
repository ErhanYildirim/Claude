import type { FastifyPluginAsync } from "fastify";
import { prisma } from "@voltfox/db";
import { encryptPassword, decryptPassword, testSmtpConnection, sendEmail } from "../../lib/email.js";

export const adminSmtpRoutes: FastifyPluginAsync = async (app) => {

  // GET /smtp — mevcut config (şifre maskelenmiş)
  app.get("/smtp", async (_request, reply) => {
    const cfg = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
    if (!cfg) {
      return reply.send({ config: null });
    }
    return reply.send({
      config: {
        host:        cfg.host,
        port:        cfg.port,
        secure:      cfg.secure,
        username:    cfg.username ?? "",
        hasPassword: !!cfg.passwordEnc,
        fromEmail:   cfg.fromEmail,
        fromName:    cfg.fromName,
        enabled:     cfg.enabled,
        updatedAt:   cfg.updatedAt,
        updatedBy:   cfg.updatedBy,
      },
    });
  });

  // PUT /smtp — kaydet (oluştur veya güncelle)
  app.put("/smtp", {
    schema: {
      body: {
        type: "object",
        required: ["host", "port", "fromEmail"],
        properties: {
          host:        { type: "string", minLength: 1 },
          port:        { type: "integer", minimum: 1, maximum: 65535 },
          secure:      { type: "boolean" },
          username:    { type: "string" },
          password:    { type: "string" },       // boş string = değiştirme
          fromEmail:   { type: "string", format: "email" },
          fromName:    { type: "string" },
          enabled:     { type: "boolean" },
        },
      },
    },
  }, async (request, reply) => {
    const {
      host, port, secure = false,
      username, password,
      fromEmail, fromName = "Voltfox",
      enabled = true,
    } = request.body as {
      host: string; port: number; secure?: boolean;
      username?: string; password?: string;
      fromEmail: string; fromName?: string; enabled?: boolean;
    };

    // Mevcut kaydı al (şifre değiştirilmiyorsa koru)
    const existing = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
    let passwordEnc = existing?.passwordEnc ?? null;
    if (password && password.length > 0) {
      passwordEnc = encryptPassword(password);
    } else if (password === "") {
      passwordEnc = null; // şifreyi kaldır
    }

    const cfg = await prisma.smtpConfig.upsert({
      where:  { id: "default" },
      create: {
        id: "default",
        host, port, secure,
        username: username || null,
        passwordEnc,
        fromEmail, fromName, enabled,
        updatedBy: request.userId ?? undefined,
      },
      update: {
        host, port, secure,
        username: username || null,
        passwordEnc,
        fromEmail, fromName, enabled,
        updatedBy: request.userId ?? undefined,
      },
    });

    app.log.info({ userId: request.userId }, "[Admin/SMTP] Config güncellendi");

    return reply.send({
      config: {
        host:        cfg.host,
        port:        cfg.port,
        secure:      cfg.secure,
        username:    cfg.username ?? "",
        hasPassword: !!cfg.passwordEnc,
        fromEmail:   cfg.fromEmail,
        fromName:    cfg.fromName,
        enabled:     cfg.enabled,
        updatedAt:   cfg.updatedAt,
      },
      message: "SMTP ayarları kaydedildi.",
    });
  });

  // POST /smtp/test — bağlantı testi
  app.post("/smtp/test", {
    schema: {
      body: {
        type: "object",
        required: ["to"],
        properties: {
          to: { type: "string", format: "email" },
        },
      },
    },
  }, async (request, reply) => {
    const { to } = request.body as { to: string };

    const cfg = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
    if (!cfg || !cfg.enabled) {
      return reply.status(400).send({
        success: false,
        error:   "SMTP yapılandırması bulunamadı veya devre dışı.",
      });
    }

    // Önce bağlantıyı doğrula
    const connError = await testSmtpConnection();
    if (connError) {
      return reply.send({ success: false, error: connError });
    }

    // Test email gönder
    try {
      await sendEmail(
        to,
        "Voltfox SMTP Test — Bağlantı Başarılı",
        `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body style="font-family:system-ui,sans-serif;padding:32px;background:#f4fbf8">
        <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:32px;border:1px solid #d4ece4">
          <div style="color:#00b87a;font-size:20px;font-weight:900;margin-bottom:16px">Voltfox</div>
          <h2 style="color:#0a1f1a;margin:0 0 12px">SMTP Bağlantısı Başarılı ✓</h2>
          <p style="color:#1a3530;font-size:14px">SMTP sunucunuz başarıyla yapılandırıldı. Sistem e-postaları bu sunucu üzerinden gönderilecektir.</p>
          <p style="color:#5c7a72;font-size:12px;margin-top:20px">Sunucu: <strong>${cfg.host}:${cfg.port}</strong> · Gönderen: <strong>${cfg.fromEmail}</strong></p>
        </div>
        </body></html>`,
      );
      app.log.info({ to, userId: request.userId }, "[Admin/SMTP] Test email gönderildi");
      return reply.send({ success: true, message: `Test e-postası ${to} adresine gönderildi.` });
    } catch (err) {
      return reply.send({ success: false, error: (err as Error).message });
    }
  });

  // DELETE /smtp — config sıfırla
  app.delete("/smtp", async (request, reply) => {
    await prisma.smtpConfig.deleteMany({ where: { id: "default" } });
    app.log.info({ userId: request.userId }, "[Admin/SMTP] Config silindi");
    return reply.status(204).send();
  });
};
