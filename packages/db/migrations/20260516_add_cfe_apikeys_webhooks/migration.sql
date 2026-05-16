-- Voltfox DB — CFE Matching Results, API Keys, Webhook Subscriptions
-- Generated: 2026-05-16

-- CreateTable: cfe_matching_results
CREATE TABLE "cfe_matching_results" (
    "id"                    UUID NOT NULL,
    "period_id"             UUID NOT NULL,
    "total_consumption_kwh" DOUBLE PRECISION NOT NULL,
    "total_production_kwh"  DOUBLE PRECISION NOT NULL,
    "total_matched_kwh"     DOUBLE PRECISION NOT NULL,
    "cfe_score"             DOUBLE PRECISION NOT NULL,
    "ppa_surplus_kwh"       DOUBLE PRECISION NOT NULL,
    "ppa_deficit_kwh"       DOUBLE PRECISION NOT NULL,
    "matched_hours"         INTEGER NOT NULL,
    "partial_hours"         INTEGER NOT NULL,
    "unmatched_hours"       INTEGER NOT NULL,
    "monthly_breakdown"     JSONB NOT NULL,
    "gec_data_version"      TEXT NOT NULL,
    "calculated_at"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cfe_matching_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable: api_keys
CREATE TABLE "api_keys" (
    "id"           UUID NOT NULL,
    "tenant_id"    UUID NOT NULL,
    "name"         TEXT NOT NULL,
    "key_hash"     TEXT NOT NULL,
    "prefix"       TEXT NOT NULL,
    "scopes"       TEXT[] NOT NULL DEFAULT '{}',
    "expires_at"   TIMESTAMP(3),
    "last_used_at" TIMESTAMP(3),
    "revoked_at"   TIMESTAMP(3),
    "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

-- CreateTable: webhook_subscriptions
CREATE TABLE "webhook_subscriptions" (
    "id"          UUID NOT NULL,
    "tenant_id"   UUID NOT NULL,
    "url"         TEXT NOT NULL,
    "events"      TEXT[] NOT NULL,
    "secret_hash" TEXT NOT NULL,
    "active"      BOOLEAN NOT NULL DEFAULT true,
    "created_at"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webhook_subscriptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable: webhook_deliveries
CREATE TABLE "webhook_deliveries" (
    "id"              UUID NOT NULL,
    "subscription_id" UUID NOT NULL,
    "event"           TEXT NOT NULL,
    "payload"         JSONB NOT NULL,
    "status"          TEXT NOT NULL DEFAULT 'pending',
    "attempts"        INTEGER NOT NULL DEFAULT 0,
    "response_status" INTEGER,
    "next_attempt_at" TIMESTAMP(3),
    "delivered_at"    TIMESTAMP(3),
    "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cfe_matching_results_period_id_key" ON "cfe_matching_results"("period_id");
CREATE UNIQUE INDEX "api_keys_key_hash_key"               ON "api_keys"("key_hash");
CREATE INDEX "api_keys_tenant_id_idx"                     ON "api_keys"("tenant_id");
CREATE INDEX "webhook_subscriptions_tenant_id_idx"        ON "webhook_subscriptions"("tenant_id");
CREATE INDEX "webhook_deliveries_subscription_id_idx"     ON "webhook_deliveries"("subscription_id");
CREATE INDEX "webhook_deliveries_status_next_attempt_idx" ON "webhook_deliveries"("status", "next_attempt_at");

-- AddForeignKey
ALTER TABLE "cfe_matching_results" ADD CONSTRAINT "cfe_matching_results_period_id_fkey"
  FOREIGN KEY ("period_id") REFERENCES "reporting_periods"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_subscriptions" ADD CONSTRAINT "webhook_subscriptions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "webhook_deliveries" ADD CONSTRAINT "webhook_deliveries_subscription_id_fkey"
  FOREIGN KEY ("subscription_id") REFERENCES "webhook_subscriptions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
