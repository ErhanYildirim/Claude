// Supabase Edge Function: set-tenant-metadata
// Trigger: POST /functions/v1/set-tenant-metadata
// Amaç: Onboarding tamamlandıktan sonra Supabase Auth app_metadata'ya tenant_id yaz.
// Çağıran: apps/api /onboarding/tenant başarılı olduğunda client tarafından tetiklenir.
//
// Bu fonksiyon SERVICE_ROLE_KEY ile Admin API'yi çağırır — client'ta gizlenmiş olmalı.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin":  "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Kullanıcı JWT'sini doğrula
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl     = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey         = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Kullanıcı token'ını doğrula
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "UNAUTHORIZED" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { tenantId } = body as { tenantId: string };

    if (!tenantId || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(tenantId)) {
      return new Response(JSON.stringify({ error: "INVALID_TENANT_ID" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Service role client ile app_metadata güncelle
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { error: updateError } = await adminClient.auth.admin.updateUserById(user.id, {
      app_metadata: { tenant_id: tenantId },
    });

    if (updateError) {
      console.error("app_metadata güncelleme hatası:", updateError);
      return new Response(JSON.stringify({ error: "UPDATE_FAILED", detail: updateError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, userId: user.id, tenantId }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : "Beklenmeyen hata";
    return new Response(JSON.stringify({ error: "INTERNAL", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
