// Webhook Delivery Worker — Supabase Edge Function
// Her dakika pg_cron tarafından tetiklenir.
// Pending/retry olan delivery'leri çeker ve hedef URL'ye gönderir.
//
// pg_cron kaydı (003_pg_cron.sql migration'ında):
//   SELECT cron.schedule('webhook-worker', '* * * * *',
//     $$SELECT net.http_post(url:='<EDGE_FN_URL>/webhook-worker',
//       headers:='{"Authorization":"Bearer <WORKER_SECRET>"}'::jsonb)$$);

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL            = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const WORKER_SECRET           = Deno.env.get("WEBHOOK_WORKER_SECRET") ?? "";
const MAX_ATTEMPTS            = 3;
const RETRY_DELAYS_SEC        = [60, 300, 900]; // 1dk, 5dk, 15dk
const DELIVERY_TIMEOUT_MS     = 10_000;
const BATCH_SIZE              = 20;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

Deno.serve(async (req) => {
  // Bearer token ile güvenlik
  const auth = req.headers.get("authorization") ?? "";
  if (WORKER_SECRET && auth !== `Bearer ${WORKER_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const now = new Date().toISOString();

  // Pending veya retry zamanı gelmiş delivery'leri çek
  const { data: deliveries, error } = await supabase
    .from("webhook_deliveries")
    .select("id, subscription_id, event, payload, attempts")
    .in("status", ["pending", "retrying"])
    .or(`next_attempt_at.is.null,next_attempt_at.lte.${now}`)
    .lt("attempts", MAX_ATTEMPTS)
    .order("created_at", { ascending: true })
    .limit(BATCH_SIZE);

  if (error) {
    console.error("Delivery fetch error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }

  if (!deliveries || deliveries.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
  }

  // Her delivery için subscription URL + secret çek
  const subIds = [...new Set(deliveries.map(d => d.subscription_id))];
  const { data: subs } = await supabase
    .from("webhook_subscriptions")
    .select("id, url, secret_hash, active")
    .in("id", subIds);

  const subMap = new Map((subs ?? []).map(s => [s.id, s]));

  const results = await Promise.allSettled(
    deliveries.map(delivery => processDelivery(delivery, subMap))
  );

  const successCount = results.filter(r => r.status === "fulfilled").length;
  return new Response(
    JSON.stringify({ processed: deliveries.length, succeeded: successCount }),
    { status: 200, headers: { "Content-Type": "application/json" } }
  );
});

async function processDelivery(
  delivery: { id: string; subscription_id: string; event: string; payload: unknown; attempts: number },
  subMap: Map<string, { id: string; url: string; secret_hash: string; active: boolean }>
): Promise<void> {
  const sub = subMap.get(delivery.subscription_id);

  // Subscription devre dışıysa veya bulunamazsa → failed
  if (!sub || !sub.active) {
    await supabase.from("webhook_deliveries").update({
      status: "failed",
      attempts: delivery.attempts + 1,
      delivered_at: null,
    }).eq("id", delivery.id);
    return;
  }

  const body = JSON.stringify({ event: delivery.event, data: delivery.payload });
  const sig  = await hmacSign(sub.secret_hash, body);

  let responseStatus: number | null = null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), DELIVERY_TIMEOUT_MS);

    const res = await fetch(sub.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Voltfox-Signature": sig,
        "X-Voltfox-Event": delivery.event,
        "X-Voltfox-Delivery": delivery.id,
      },
      body,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    responseStatus = res.status;
  } catch {
    // Timeout veya ağ hatası — null kalır
  }

  const success = responseStatus !== null && responseStatus >= 200 && responseStatus < 300;
  const newAttempts = delivery.attempts + 1;

  if (success) {
    await supabase.from("webhook_deliveries").update({
      status: "delivered",
      attempts: newAttempts,
      response_status: responseStatus,
      delivered_at: new Date().toISOString(),
    }).eq("id", delivery.id);
  } else if (newAttempts >= MAX_ATTEMPTS) {
    await supabase.from("webhook_deliveries").update({
      status: "failed",
      attempts: newAttempts,
      response_status: responseStatus,
    }).eq("id", delivery.id);
  } else {
    const delaySec = RETRY_DELAYS_SEC[newAttempts - 1] ?? 900;
    const nextAttempt = new Date(Date.now() + delaySec * 1000).toISOString();
    await supabase.from("webhook_deliveries").update({
      status: "retrying",
      attempts: newAttempts,
      response_status: responseStatus,
      next_attempt_at: nextAttempt,
    }).eq("id", delivery.id);
  }
}

async function hmacSign(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  return `sha256=${hex}`;
}
