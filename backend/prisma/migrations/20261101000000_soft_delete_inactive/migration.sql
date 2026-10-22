ALTER TABLE "users" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ, ADD COLUMN "inactive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "technicians" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "customers" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "service_locations" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ, ADD COLUMN "inactive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "equipment" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ, ADD COLUMN "inactive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "service_requests" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "jobs" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "quotations" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "invoices" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "parts" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ, ADD COLUMN "inactive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "checklist_templates" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ, ADD COLUMN "inactive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "maintenance_agreements" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;
ALTER TABLE "certificates" ADD COLUMN "is_deleted" BOOLEAN NOT NULL DEFAULT false, ADD COLUMN "deleted_at" TIMESTAMPTZ;

-- A soft-deleted customer no longer holds its email.
DROP INDEX "customers_active_email_key";
CREATE UNIQUE INDEX "customers_active_email_key" ON "customers" (lower("email")) WHERE "archived" = false AND "is_deleted" = false AND "email" <> '';
