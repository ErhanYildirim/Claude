-- AlterTable: api_keys — rate_limit_per_min + created_by
ALTER TABLE "api_keys"
  ADD COLUMN IF NOT EXISTS "rate_limit_per_min" INTEGER,
  ADD COLUMN IF NOT EXISTS "created_by"         UUID;

-- CreateTable: api_request_logs
CREATE TABLE IF NOT EXISTS "api_request_logs" (
  "id"           UUID         NOT NULL DEFAULT gen_random_uuid(),
  "api_key_id"   UUID         NOT NULL,
  "tenant_id"    UUID         NOT NULL,
  "method"       TEXT         NOT NULL,
  "endpoint"     TEXT         NOT NULL,
  "status_code"  INTEGER      NOT NULL,
  "duration_ms"  INTEGER      NOT NULL,
  "ip_address"   TEXT,
  "user_agent"   TEXT,
  "created_at"   TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT "api_request_logs_pkey" PRIMARY KEY ("id")
);

-- Foreign key
ALTER TABLE "api_request_logs"
  ADD CONSTRAINT "api_request_logs_api_key_id_fkey"
  FOREIGN KEY ("api_key_id") REFERENCES "api_keys"("id") ON DELETE CASCADE;

-- Indexes
CREATE INDEX IF NOT EXISTS "api_request_logs_api_key_id_created_at_idx"
  ON "api_request_logs" ("api_key_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "api_request_logs_tenant_id_created_at_idx"
  ON "api_request_logs" ("tenant_id", "created_at" DESC);

CREATE INDEX IF NOT EXISTS "api_request_logs_created_at_idx"
  ON "api_request_logs" ("created_at" DESC);
