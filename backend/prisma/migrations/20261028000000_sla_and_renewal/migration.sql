ALTER TABLE "maintenance_agreements" ADD COLUMN "auto_renew" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "jobs" ADD COLUMN "sla_due_at" TIMESTAMPTZ;
