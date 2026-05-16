-- Voltfox Platform — Row Level Security Politikaları
-- Bu politikalar Supabase anon/JWT erişiminde tenant izolasyonunu sağlar.
-- API sunucusu service_role_key ile bağlanır → RLS bypass edilir (mevcut davranış korunur).
-- Edge Functions ve doğrudan Supabase client erişimi bu politikalarla korunur.
--
-- JWT claim: (auth.jwt() -> 'app_metadata' ->> 'tenant_id')
-- Bu claim onboarding Edge Function tarafından yazılır (set-tenant-metadata).

-- ── Helper fonksiyon ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION auth_tenant_id() RETURNS uuid
  LANGUAGE sql STABLE
  AS $$
    SELECT NULLIF(
      (auth.jwt() -> 'app_metadata' ->> 'tenant_id'),
      ''
    )::uuid
  $$;

-- ── tenants ───────────────────────────────────────────────────────────────────
ALTER TABLE tenants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenants_select_own" ON tenants
  FOR SELECT USING (id = auth_tenant_id());

-- ── tenant_members ────────────────────────────────────────────────────────────
ALTER TABLE tenant_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members_select_own" ON tenant_members
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ── installations ─────────────────────────────────────────────────────────────
ALTER TABLE installations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "installations_select_own" ON installations
  FOR SELECT USING (tenant_id = auth_tenant_id());

CREATE POLICY "installations_insert_own" ON installations
  FOR INSERT WITH CHECK (tenant_id = auth_tenant_id());

CREATE POLICY "installations_update_own" ON installations
  FOR UPDATE USING (tenant_id = auth_tenant_id());

CREATE POLICY "installations_delete_own" ON installations
  FOR DELETE USING (tenant_id = auth_tenant_id());

-- ── reporting_periods ─────────────────────────────────────────────────────────
ALTER TABLE reporting_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "periods_select_own" ON reporting_periods
  FOR SELECT USING (
    installation_id IN (
      SELECT id FROM installations WHERE tenant_id = auth_tenant_id()
    )
  );

CREATE POLICY "periods_insert_own" ON reporting_periods
  FOR INSERT WITH CHECK (
    installation_id IN (
      SELECT id FROM installations WHERE tenant_id = auth_tenant_id()
    )
  );

CREATE POLICY "periods_update_own" ON reporting_periods
  FOR UPDATE USING (
    installation_id IN (
      SELECT id FROM installations WHERE tenant_id = auth_tenant_id()
    )
  );

CREATE POLICY "periods_delete_own" ON reporting_periods
  FOR DELETE USING (
    installation_id IN (
      SELECT id FROM installations WHERE tenant_id = auth_tenant_id()
    )
  );

-- ── embedded_emissions ────────────────────────────────────────────────────────
ALTER TABLE embedded_emissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "emissions_select_own" ON embedded_emissions
  FOR SELECT USING (
    period_id IN (
      SELECT rp.id FROM reporting_periods rp
      JOIN installations i ON i.id = rp.installation_id
      WHERE i.tenant_id = auth_tenant_id()
    )
  );

-- ── cfe_matching_results ──────────────────────────────────────────────────────
ALTER TABLE cfe_matching_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cfe_select_own" ON cfe_matching_results
  FOR SELECT USING (
    period_id IN (
      SELECT rp.id FROM reporting_periods rp
      JOIN installations i ON i.id = rp.installation_id
      WHERE i.tenant_id = auth_tenant_id()
    )
  );

-- ── api_keys ──────────────────────────────────────────────────────────────────
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "api_keys_select_own" ON api_keys
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- INSERT/UPDATE/DELETE yalnızca API sunucusu (service_role) üzerinden yapılır

-- ── webhook_subscriptions ─────────────────────────────────────────────────────
ALTER TABLE webhook_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhooks_select_own" ON webhook_subscriptions
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ── webhook_deliveries ────────────────────────────────────────────────────────
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deliveries_select_own" ON webhook_deliveries
  FOR SELECT USING (
    subscription_id IN (
      SELECT id FROM webhook_subscriptions WHERE tenant_id = auth_tenant_id()
    )
  );

-- ── audit_logs ────────────────────────────────────────────────────────────────
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_select_own" ON audit_logs
  FOR SELECT USING (tenant_id = auth_tenant_id());

-- ── share_links ───────────────────────────────────────────────────────────────
-- Share link'ler token ile kamuya açık okunabilir (API handle eder),
-- doğrudan DB erişimi için sadece tenant görebilir.
ALTER TABLE share_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "share_links_select_own" ON share_links
  FOR SELECT USING (tenant_id = auth_tenant_id());
