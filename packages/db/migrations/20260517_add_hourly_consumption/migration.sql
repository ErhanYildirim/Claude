-- Migration: 20260517_add_hourly_consumption
-- Adds HourlyConsumption table for granular (hour-by-hour) electricity consumption data

CREATE TABLE "hourly_consumptions" (
    "id"               UUID         NOT NULL DEFAULT gen_random_uuid(),
    "period_id"        UUID         NOT NULL,
    "hour"             TIMESTAMPTZ  NOT NULL,
    "consumption_kwh"  DOUBLE PRECISION NOT NULL,
    "source"           TEXT         NOT NULL DEFAULT 'csv',
    "quality"          TEXT         NOT NULL DEFAULT 'measured',
    "created_at"       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT "hourly_consumptions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "hourly_consumptions_period_id_fkey"
        FOREIGN KEY ("period_id")
        REFERENCES "reporting_periods"("id")
        ON DELETE CASCADE,
    CONSTRAINT "hourly_consumptions_period_id_hour_key"
        UNIQUE ("period_id", "hour")
);

CREATE INDEX "hourly_consumptions_period_id_idx" ON "hourly_consumptions"("period_id");
CREATE INDEX "hourly_consumptions_hour_idx" ON "hourly_consumptions"("hour");

-- source values: csv | osos | amr | manual
-- quality values: measured | estimated | interpolated
