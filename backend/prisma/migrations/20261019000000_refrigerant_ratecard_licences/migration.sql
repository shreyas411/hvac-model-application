-- Rate card defaults (were hard-coded 85 / 35), licence expiry, per-job refrigerant log.
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_hourly_rate" DECIMAL(12,2) NOT NULL DEFAULT 85;
ALTER TABLE "company_settings" ADD COLUMN IF NOT EXISTS "default_travel_charge" DECIMAL(12,2) NOT NULL DEFAULT 35;
ALTER TABLE "technicians" ADD COLUMN IF NOT EXISTS "gas_safe_expiry" DATE;
ALTER TABLE "technicians" ADD COLUMN IF NOT EXISTS "f_gas_expiry" DATE;

CREATE TABLE IF NOT EXISTS "refrigerant_logs" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "equipment_id" UUID,
    "refrigerant" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "amount_kg" DECIMAL(8,3) NOT NULL,
    "cylinder_id" TEXT NOT NULL DEFAULT '',
    "cert_number" TEXT NOT NULL,
    "notes" TEXT,
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "refrigerant_logs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "refrigerant_logs_amount_nonneg" CHECK ("amount_kg" >= 0),
    CONSTRAINT "refrigerant_logs_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "refrigerant_logs_job_id_idx" ON "refrigerant_logs"("job_id");
-- RLS is enabled automatically by the rls_auto_enable event trigger.
