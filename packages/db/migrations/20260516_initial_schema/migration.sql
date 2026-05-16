-- Voltfox DB — Initial schema baseline
-- Generated: 2026-05-16
-- Applied via: prisma db push (pre-migration era)
-- This file baselines the existing production schema for Prisma Migrate history.

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "user_id" UUID,
    "action" TEXT NOT NULL,
    "resource" TEXT NOT NULL,
    "resource_id" TEXT,
    "payload" JSONB,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "embedded_emissions" (
    "id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "scope2_baseline_tco2" DOUBLE PRECISION NOT NULL,
    "scope2_voltfox_tco2" DOUBLE PRECISION NOT NULL,
    "reduction_tco2" DOUBLE PRECISION NOT NULL,
    "reduction_pct" DOUBLE PRECISION NOT NULL,
    "see_baseline" DOUBLE PRECISION NOT NULL,
    "see_voltfox" DOUBLE PRECISION NOT NULL,
    "default_see" DOUBLE PRECISION,
    "savings_vs_default_eur" DOUBLE PRECISION,
    "calc_engine_version" TEXT NOT NULL,
    "calc_methodology" TEXT NOT NULL DEFAULT 'EU_2023_1773_AnnexIV_MethodA',
    "ef_data_version" TEXT NOT NULL,
    "calculated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "embedded_emissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installations" (
    "id" UUID NOT NULL,
    "tenant_id" UUID NOT NULL,
    "facility_name" TEXT NOT NULL,
    "operator" TEXT NOT NULL,
    "facility_country" TEXT NOT NULL,
    "facility_ref" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_periods" (
    "id" UUID NOT NULL,
    "installation_id" UUID NOT NULL,
    "period_name" TEXT NOT NULL,
    "start_date" DATE NOT NULL,
    "end_date" DATE NOT NULL,
    "report_year" INTEGER NOT NULL,
    "import_country" TEXT NOT NULL,
    "cn_code" TEXT NOT NULL,
    "prod_volume_tonne" DOUBLE PRECISION NOT NULL,
    "scope2_exempt" BOOLEAN NOT NULL DEFAULT false,
    "scope1_direct_tco2" DOUBLE PRECISION NOT NULL,
    "scope1_quality" TEXT NOT NULL,
    "scope1_audit_note" TEXT,
    "electricity_kwh" DOUBLE PRECISION NOT NULL,
    "electricity_source" TEXT NOT NULL,
    "baseline_ef" DOUBLE PRECISION NOT NULL,
    "renewable_ef" DOUBLE PRECISION NOT NULL,
    "matching_rate_pct" DOUBLE PRECISION NOT NULL,
    "gec_connected" BOOLEAN NOT NULL DEFAULT false,
    "carbon_price_eur" DOUBLE PRECISION,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "share_links" (
    "id" UUID NOT NULL,
    "jti" TEXT NOT NULL,
    "tenant_id" UUID NOT NULL,
    "installation_id" UUID NOT NULL,
    "period_id" UUID NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "share_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at" ASC);

-- CreateIndex
CREATE INDEX "audit_logs_tenant_id_idx" ON "audit_logs"("tenant_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "embedded_emissions_period_id_key" ON "embedded_emissions"("period_id" ASC);

-- CreateIndex
CREATE INDEX "installations_tenant_id_idx" ON "installations"("tenant_id" ASC);

-- CreateIndex
CREATE INDEX "reporting_periods_installation_id_idx" ON "reporting_periods"("installation_id" ASC);

-- CreateIndex
CREATE INDEX "share_links_jti_idx" ON "share_links"("jti" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "share_links_jti_key" ON "share_links"("jti" ASC);

-- CreateIndex
CREATE INDEX "share_links_tenant_id_idx" ON "share_links"("tenant_id" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug" ASC);

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "embedded_emissions" ADD CONSTRAINT "embedded_emissions_period_id_fkey" FOREIGN KEY ("period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "installations" ADD CONSTRAINT "installations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reporting_periods" ADD CONSTRAINT "reporting_periods_installation_id_fkey" FOREIGN KEY ("installation_id") REFERENCES "installations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "share_links" ADD CONSTRAINT "share_links_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
