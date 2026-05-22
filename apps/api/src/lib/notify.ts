// Unified notification helper — in-app + email, respects per-user prefs
import { prisma } from "@voltfox/db";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "./email.js";

type EventType = "calculationDone" | "cfeDone" | "memberInvited" | "periodCreated";

interface NotifyParams {
  tenantId:    string;
  eventType:   EventType;
  title:       string;
  body?:       string;
  resource?:   string;
  resourceId?: string;
  // When provided, sends email to these specific users (bypasses tenant-member scan)
  emailOverride?: Array<{ email: string; subject: string; html: string }>;
}

function getAdminClient() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export async function notifyTenant(params: NotifyParams & {
  emailFactory?: (userId: string, userEmail: string) => { subject: string; html: string } | null;
}): Promise<void> {
  const members = await prisma.tenantMember.findMany({
    where:   { tenantId: params.tenantId },
    select:  { userId: true },
  });

  if (members.length === 0) return;

  const userIds = members.map(m => m.userId);

  // Fetch preferences (missing = use defaults)
  const prefs = await prisma.notificationPreference.findMany({
    where: { tenantId: params.tenantId, userId: { in: userIds } },
  });
  const prefMap = new Map(prefs.map(p => [p.userId, p]));

  const appUrl = process.env.APP_URL ?? "https://app.voltfox.io";
  const adminClient = params.emailFactory ? getAdminClient() : null;

  await Promise.all(userIds.map(async userId => {
    const pref = prefMap.get(userId);
    const eventEnabled: boolean = pref ? (pref[params.eventType] as boolean) : true;
    const emailEnabled: boolean = pref?.emailEnabled ?? false;

    // In-app notification
    if (eventEnabled) {
      await prisma.notification.create({
        data: {
          tenantId:   params.tenantId,
          userId,
          type:       params.eventType,
          title:      params.title,
          body:       params.body,
          resource:   params.resource,
          resourceId: params.resourceId,
        },
      }).catch(() => {});
    }

    // Email
    if (eventEnabled && emailEnabled && params.emailFactory && adminClient) {
      try {
        const { data } = await adminClient.auth.admin.getUserById(userId);
        const email = data.user?.email;
        if (email) {
          const tpl = params.emailFactory(userId, email);
          if (tpl) {
            await sendEmail(email, tpl.subject, tpl.html);
          }
        }
      } catch {
        // email failure never blocks main flow
      }
    }
  }));

  void appUrl; // suppress unused warning when emailFactory absent
}

// Convenience: notify one specific user (for invite emails where recipient isn't a member yet)
export async function notifyEmail(to: string, subject: string, html: string): Promise<void> {
  await sendEmail(to, subject, html).catch(() => {});
}
