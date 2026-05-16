import fp from "fastify-plugin";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { FastifyPluginAsync } from "fastify";

declare module "fastify" {
  interface FastifyInstance {
    supabase: SupabaseClient;
  }
}

const supabasePlugin: FastifyPluginAsync = async (app) => {
  const url  = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY
            ?? process.env.SUPABASE_ANON_KEY
            ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!url || !key) {
    app.log.warn("SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik — auth devre dışı");
    return;
  }

  const client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  app.decorate("supabase", client);
};

export default fp(supabasePlugin, { name: "supabase" });
