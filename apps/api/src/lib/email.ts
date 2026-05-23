/**
 * Email sending — öncelik sırası:
 *   1. SMTP (DB'deki SmtpConfig kaydı, enabled=true)
 *   2. Resend API (RESEND_API_KEY env var)
 *   3. Console log (geliştirme/fallback)
 */
import nodemailer from "nodemailer";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
import { prisma } from "@voltfox/db";

// ── Şifreleme (AES-256-GCM) ────────��──────────────���───────────────────────────
// SMTP_ENCRYPTION_KEY env var: 32 byte hex (64 karakter)
function getEncKey(): Buffer | null {
  const raw = process.env.SMTP_ENCRYPTION_KEY;
  if (!raw || raw.length < 64) return null;
  return Buffer.from(raw.slice(0, 64), "hex");
}

export function encryptPassword(plain: string): string {
  const key = getEncKey();
  if (!key) return plain; // key yoksa plain sakla (dev)
  const iv  = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc  = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag  = cipher.getAuthTag();
  return `enc:${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptPassword(stored: string): string {
  if (!stored.startsWith("enc:")) return stored; // plain veya dev
  const key = getEncKey();
  if (!key) return stored; // decrypt edilemiyor — plain döndür (hata durumu)
  const [, ivHex, tagHex, encHex] = stored.split(":");
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return decipher.update(Buffer.from(encHex, "hex")).toString("utf8") + decipher.final("utf8");
}

// ── SMTP transporter cache ────────────────────────────────────────────────────
let _transporterCache: { transporter: nodemailer.Transporter; hash: string } | null = null;

function configHash(cfg: { host: string; port: number; secure: boolean; username?: string | null }): string {
  return `${cfg.host}:${cfg.port}:${cfg.secure}:${cfg.username ?? ""}`;
}

async function getSmtpTransporter(): Promise<{ transporter: nodemailer.Transporter; fromEmail: string; fromName: string } | null> {
  const cfg = await prisma.smtpConfig.findUnique({ where: { id: "default" } });
  if (!cfg || !cfg.enabled) return null;

  const hash = configHash(cfg);
  if (!_transporterCache || _transporterCache.hash !== hash) {
    const password = cfg.passwordEnc ? decryptPassword(cfg.passwordEnc) : undefined;
    const transporter = nodemailer.createTransport({
      host:   cfg.host,
      port:   cfg.port,
      secure: cfg.secure,
      auth:   cfg.username ? { user: cfg.username, pass: password } : undefined,
      tls:    { rejectUnauthorized: process.env.NODE_ENV === "production" },
    });
    _transporterCache = { transporter, hash };
  }

  return {
    transporter: _transporterCache.transporter,
    fromEmail:   cfg.fromEmail,
    fromName:    cfg.fromName,
  };
}

/** SMTP bağlantısını test et. Hata mesajı döner, null = başarılı. */
export async function testSmtpConnection(): Promise<string | null> {
  try {
    const smtp = await getSmtpTransporter();
    if (!smtp) return "SMTP yapılandırması bulunamadı veya devre dışı.";
    await smtp.transporter.verify();
    return null;
  } catch (err) {
    return (err as Error).message;
  }
}

// ── Ana gönderim fonksiyonu ─────────────────���────────────────────────────��────
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  // 1. SMTP (DB config)
  try {
    const smtp = await getSmtpTransporter();
    if (smtp) {
      await smtp.transporter.sendMail({
        from:    `"${smtp.fromName}" <${smtp.fromEmail}>`,
        to,
        subject,
        html,
      });
      return;
    }
  } catch (err) {
    console.error(`[Email/SMTP] Gönderim hatası: ${(err as Error).message}`);
    // SMTP başarısız → Resend'e fallback
  }

  // 2. Resend API
  const apiKey = process.env.RESEND_API_KEY;
  const from   = process.env.RESEND_FROM_EMAIL ?? "Voltfox <no-reply@voltfox.io>";
  if (apiKey) {
    const res = await fetch("https://api.resend.com/emails", {
      method:  "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
      body:    JSON.stringify({ from, to, subject, html }),
    });
    if (!res.ok) {
      const err = await res.text().catch(() => "unknown");
      console.error(`[Email/Resend] Hata (${res.status}): ${err}`);
    }
    return;
  }

  // 3. Fallback — sadece logla
  console.log(`[Email] TO=${to} SUBJECT="${subject}" (Email servisi yapılandırılmamış)`);
}

// ── HTML templates ──────────────────────────────────��──────────────────────────
function baseTemplate(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8">
<style>
  body{font-family:system-ui,sans-serif;background:#f4fbf8;margin:0;padding:32px 16px}
  .card{background:#fff;max-width:520px;margin:0 auto;border-radius:12px;padding:32px;border:1px solid #d4ece4}
  .logo{color:#00b87a;font-size:20px;font-weight:900;margin-bottom:4px}
  .divider{border:none;border-top:1px solid #d4ece4;margin:20px 0}
  .title{font-size:18px;font-weight:700;color:#0a1f1a;margin-bottom:8px}
  .body{color:#1a3530;font-size:14px;line-height:1.6}
  .kpi{background:#f4fbf8;border-radius:8px;padding:12px 16px;margin:16px 0;display:inline-block}
  .kpi-label{font-size:11px;color:#5c7a72;margin-bottom:2px;text-transform:uppercase;letter-spacing:.05em}
  .kpi-value{font-size:22px;font-weight:800;color:#059669}
  .btn{display:inline-block;padding:11px 24px;background:#00b87a;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:14px;margin-top:20px}
  .footer{font-size:11px;color:#94A3B8;text-align:center;margin-top:24px}
</style>
</head><body>
<div class="card">
  <div class="logo">Voltfox</div>
  <hr class="divider">
  <div class="title">${title}</div>
  <div class="body">${body}</div>
  <div class="footer">Voltfox Emisyon Yönetim Platformu · Bu e-posta otomatik olarak gönderilmiştir.</div>
</div>
</body></html>`;
}

export function emailCalculationDone(params: {
  facilityName: string; periodName: string; seeVoltfox: number;
  reductionPct: number; appUrl: string; installationId: string; periodId: string;
}): { subject: string; html: string } {
  const subject = `SEE Hesaplama Tamamlandı — ${params.periodName}`;
  const html = baseTemplate(
    "SEE Hesaplama Tamamlandı",
    `<p><strong>${params.facilityName}</strong> tesisi için <strong>${params.periodName}</strong> dönemi SEE hesaplaması başarıyla tamamlandı.</p>
    <div class="kpi">
      <div class="kpi-label">SEE (Voltfox)</div>
      <div class="kpi-value">${params.seeVoltfox.toFixed(4)} tCO₂e/t</div>
    </div>
    <div class="kpi" style="margin-left:12px">
      <div class="kpi-label">Azaltım</div>
      <div class="kpi-value">%${params.reductionPct.toFixed(1)}</div>
    </div>
    <br><a class="btn" href="${params.appUrl}/installations/${params.installationId}/periods/${params.periodId}">Sonuçları Görüntüle</a>`,
  );
  return { subject, html };
}

export function emailCfeDone(params: {
  facilityName: string; periodName: string; cfeScore: number;
  appUrl: string; installationId: string; periodId: string;
}): { subject: string; html: string } {
  const subject = `24/7 CFE Matching Tamamlandı — ${params.periodName}`;
  const html = baseTemplate(
    "24/7 CFE Matching Tamamlandı",
    `<p><strong>${params.facilityName}</strong> tesisi için <strong>${params.periodName}</strong> dönemi CFE eşleştirmesi tamamlandı.</p>
    <div class="kpi">
      <div class="kpi-label">CFE Skoru</div>
      <div class="kpi-value">%${params.cfeScore.toFixed(1)}</div>
    </div>
    <br><a class="btn" href="${params.appUrl}/installations/${params.installationId}/periods/${params.periodId}">CFE Detayına Git</a>`,
  );
  return { subject, html };
}

export function emailMemberInvited(params: {
  tenantName: string; invitedBy: string; role: string;
  inviteUrl: string; appUrl: string; expiresAt: string;
}): { subject: string; html: string } {
  const roleLabel: Record<string, string> = {
    owner: "Owner", admin: "Admin", analyst: "Analyst", viewer: "Viewer",
  };
  const subject = `Voltfox'a davet edildiniz — ${params.tenantName}`;
  const html = baseTemplate(
    `${params.tenantName} sizi Voltfox'a davet ediyor`,
    `<p><strong>${params.invitedBy}</strong> sizi <strong>${params.tenantName}</strong> organizasyonuna <strong>${roleLabel[params.role] ?? params.role}</strong> rolüyle davet etti.</p>
    <p>Daveti kabul etmek için aşağıdaki butona tıklayın:</p>
    <a class="btn" href="${params.appUrl}${params.inviteUrl}">Daveti Kabul Et</a>
    <p style="font-size:12px;color:#5c7a72;margin-top:16px">Bu davet <strong>${new Date(params.expiresAt).toLocaleDateString("tr-TR")}</strong> tarihine kadar geçerlidir.</p>`,
  );
  return { subject, html };
}
