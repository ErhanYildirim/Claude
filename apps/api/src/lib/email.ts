// Email sending — Resend (https://resend.com) veya console fallback
// Env vars: RESEND_API_KEY, RESEND_FROM_EMAIL (ör. "Voltfox <no-reply@voltfox.io>")

const FROM    = process.env.RESEND_FROM_EMAIL ?? "Voltfox <no-reply@voltfox.io>";
const API_KEY = process.env.RESEND_API_KEY;

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  if (!API_KEY) {
    // Dev/test: e-posta göndermeden logla
    console.log(`[Email] TO=${to} SUBJECT="${subject}" (RESEND_API_KEY ayarlanmamış, gerçek e-posta gönderilmedi)`);
    return;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method:  "POST",
    headers: {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({ from: FROM, to, subject, html }),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => "unknown");
    console.error(`[Email] Resend hatası (${res.status}): ${err}`);
  }
}

// ── HTML templates ─────────────────────────────────────────────────────────────

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
  facilityName: string;
  periodName:   string;
  seeVoltfox:   number;
  reductionPct: number;
  appUrl:       string;
  installationId: string;
  periodId:     string;
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
  facilityName: string;
  periodName:   string;
  cfeScore:     number;
  appUrl:       string;
  installationId: string;
  periodId:     string;
}): { subject: string; html: string } {
  const subject = `24/7 CFE Matching Tamamlandı — ${params.periodName}`;
  const html = baseTemplate(
    "24/7 CFE Matching Tamamlandı",
    `<p><strong>${params.facilityName}</strong> tesisi için <strong>${params.periodName}</strong> dönemi CFE eşleştirmesi tamamlandı.</p>
    <div class="kpi">
      <div class="kpi-label">CFE Skoru</div>
      <div class="kpi-value">%${(params.cfeScore * 100).toFixed(1)}</div>
    </div>
    <br><a class="btn" href="${params.appUrl}/installations/${params.installationId}/periods/${params.periodId}">CFE Detayına Git</a>`,
  );
  return { subject, html };
}

export function emailMemberInvited(params: {
  tenantName: string;
  invitedBy:  string;
  role:       string;
  inviteUrl:  string;
  appUrl:     string;
  expiresAt:  string;
}): { subject: string; html: string } {
  const roleLabel: Record<string, string> = {
    owner: "Owner", admin: "Admin", analyst: "Analyst", viewer: "Viewer",
  };
  const subject = `Voltfox'a davet edildiniz — ${params.tenantName}`;
  const html = baseTemplate(
    `${params.tenantName} sizi Voltfox'a davet ediyor`,
    `<p><strong>${params.invitedBy}</strong> sizi <strong>${params.tenantName}</strong> organizasyonuna <strong>${roleLabel[params.role] ?? params.role}</strong> rolüyle davet etti.</p>
    <p>Daveti kabul etmek ve hesabınızı oluşturmak için aşağıdaki butona tıklayın:</p>
    <a class="btn" href="${params.appUrl}${params.inviteUrl}">Daveti Kabul Et</a>
    <p style="font-size:12px;color:#5c7a72;margin-top:16px">Bu davet <strong>${new Date(params.expiresAt).toLocaleDateString("tr-TR")}</strong> tarihine kadar geçerlidir.</p>`,
  );
  return { subject, html };
}
