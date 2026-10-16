CREATE TABLE IF NOT EXISTS "maintenance_agreements" (
    "id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "equipment_id" UUID,
    "frequency" TEXT NOT NULL,
    "next_due_date" DATE NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "maintenance_agreements_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "maintenance_agreements_frequency_chk" CHECK ("frequency" IN ('quarterly','biannual','annual'))
);
CREATE INDEX IF NOT EXISTS "maintenance_agreements_active_next_due_date_idx" ON "maintenance_agreements"("active", "next_due_date");
