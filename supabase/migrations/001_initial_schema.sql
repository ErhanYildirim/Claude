-- Voltfox Platform — İlk Şema
-- Prisma'nın ürettiği migration'ın yerine elle yazılmış versiyon
-- Supabase Dashboard → SQL Editor'da çalıştırın VEYA `prisma migrate deploy`

-- ── Tenant ────────────────────────────────────────────────────────────────────
CREATE TABLE tenants (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name       TEXT        NOT NULL,
  slug       TEXT        NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Installation ──────────────────────────────────────────────────────────────
CREATE TABLE installations (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  facility_name    TEXT        NOT NULL,
  operator         TEXT        NOT NULL,
  facility_country TEXT        NOT NULL,
  facility_ref     TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX installations_tenant_id_idx ON installations(tenant_id);

-- ── ReportingPeriod ───────────────────────────────────────────────────────────
CREATE TABLE reporting_periods (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  installation_id     UUID        NOT NULL REFERENCES installations(id) ON DELETE CASCADE,
  period_name         TEXT        NOT NULL,
  start_date          DATE        NOT NULL,
  end_date            DATE        NOT NULL,
  report_year         INTEGER     NOT NULL,
  import_country      TEXT        NOT NULL,
  cn_code             TEXT        NOT NULL,
  prod_volume_tonne   FLOAT       NOT NULL CHECK (prod_volume_tonne > 0),
  scope2_exempt       BOOLEAN     NOT NULL DEFAULT false,

  -- Scope 1 (müşteri sağlar)
  scope1_direct_tco2 FLOAT       NOT NULL CHECK (scope1_direct_tco2 >= 0),
  scope1_quality     TEXT        NOT NULL CHECK (scope1_quality IN ('measured','calculated','estimated')),
  scope1_audit_note  TEXT,

  -- Scope 2 (Voltfox hesaplar)
  electricity_kwh     FLOAT       NOT NULL CHECK (electricity_kwh >= 0),
  electricity_source  TEXT        NOT NULL CHECK (electricity_source IN ('smart_meter','erp','invoice','manual')),
  baseline_ef         FLOAT       NOT NULL CHECK (baseline_ef >= 0),
  renewable_ef        FLOAT       NOT NULL CHECK (renewable_ef >= 0),
  matching_rate_pct   FLOAT       NOT NULL CHECK (matching_rate_pct BETWEEN 0 AND 100),
  gec_connected       BOOLEAN     NOT NULL DEFAULT false,

  carbon_price_eur    FLOAT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX reporting_periods_installation_id_idx ON reporting_periods(installation_id);

-- ── EmbeddedEmission ──────────────────────────────────────────────────────────
CREATE TABLE embedded_emissions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id             UUID        NOT NULL UNIQUE REFERENCES reporting_periods(id) ON DELETE CASCADE,
  scope2_baseline_tco2  FLOAT       NOT NULL,
  scope2_voltfox_tco2   FLOAT       NOT NULL,
  reduction_tco2        FLOAT       NOT NULL,
  reduction_pct         FLOAT       NOT NULL,
  see_baseline          FLOAT       NOT NULL,
  see_voltfox           FLOAT       NOT NULL,
  default_see           FLOAT,
  savings_vs_default_eur FLOAT,
  calc_engine_version   TEXT        NOT NULL,
  calc_methodology      TEXT        NOT NULL DEFAULT 'EU_2023_1773_AnnexIV_MethodA',
  ef_data_version       TEXT        NOT NULL,
  calculated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ShareLink ─────────────────────────────────────────────────────────────────
CREATE TABLE share_links (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  jti             TEXT        NOT NULL UNIQUE,
  tenant_id       UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  installation_id UUID        NOT NULL,
  period_id       UUID        NOT NULL,
  expires_at      TIMESTAMPTZ NOT NULL,
  revoked_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX share_links_tenant_id_idx ON share_links(tenant_id);
CREATE INDEX share_links_jti_idx       ON share_links(jti);

-- ── AuditLog ──────────────────────────────────────────────────────────────────
CREATE TABLE audit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID        NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id     UUID,
  action      TEXT        NOT NULL,
  resource    TEXT        NOT NULL,
  resource_id TEXT,
  payload     JSONB,
  ip_address  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_tenant_id_idx  ON audit_logs(tenant_id);
CREATE INDEX audit_logs_created_at_idx ON audit_logs(created_at DESC);

-- ── updated_at otomatik güncelleme trigger ────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_tenants_updated_at
  BEFORE UPDATE ON tenants
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_installations_updated_at
  BEFORE UPDATE ON installations
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER trg_reporting_periods_updated_at
  BEFORE UPDATE ON reporting_periods
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security ────────────────────────────────────────────────────────
-- API service role key ile bağlanıldığında RLS bypass edilir.
-- İleride Supabase Auth + anon key kullanımı için:
ALTER TABLE installations     ENABLE ROW LEVEL SECURITY;
ALTER TABLE reporting_periods ENABLE ROW LEVEL SECURITY;
ALTER TABLE embedded_emissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE share_links       ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs        ENABLE ROW LEVEL SECURITY;
