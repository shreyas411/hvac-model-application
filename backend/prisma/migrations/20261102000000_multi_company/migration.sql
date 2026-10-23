-- Multi-company: every business row belongs to a company; login is (company slug, email, password).
-- Existing data becomes the single company "default" (rename its slug/name afterwards).
CREATE TABLE "companies" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "companies_slug_key" ON "companies"("slug");
INSERT INTO "companies" ("name", "slug") SELECT COALESCE((SELECT "company_name" FROM "company_settings" LIMIT 1), 'Default company'), 'default';
-- RLS is switched on for new public tables by the rls_auto_enable event trigger (20261018000000_audit_integrity_rls).

ALTER TABLE "users" ADD COLUMN "company_id" UUID;
UPDATE "users" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "users" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "users" ADD CONSTRAINT "users_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "users_company_id_idx" ON "users"("company_id");
DROP INDEX IF EXISTS "users_email_key";
CREATE UNIQUE INDEX "users_company_id_email_key" ON "users"("company_id", "email");

ALTER TABLE "technicians" ADD COLUMN "company_id" UUID;
UPDATE "technicians" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "technicians" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "technicians" ADD CONSTRAINT "technicians_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "technicians_company_id_idx" ON "technicians"("company_id");
DROP INDEX IF EXISTS "technicians_legacy_id_key";
CREATE UNIQUE INDEX "technicians_company_id_legacy_id_key" ON "technicians"("company_id", "legacy_id");

ALTER TABLE "customers" ADD COLUMN "company_id" UUID;
UPDATE "customers" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "customers" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "customers_company_id_idx" ON "customers"("company_id");
DROP INDEX IF EXISTS "customers_legacy_id_key";
CREATE UNIQUE INDEX "customers_company_id_legacy_id_key" ON "customers"("company_id", "legacy_id");

ALTER TABLE "service_locations" ADD COLUMN "company_id" UUID;
UPDATE "service_locations" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "service_locations" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "service_locations_company_id_idx" ON "service_locations"("company_id");
DROP INDEX IF EXISTS "service_locations_legacy_id_key";
CREATE UNIQUE INDEX "service_locations_company_id_legacy_id_key" ON "service_locations"("company_id", "legacy_id");

ALTER TABLE "equipment" ADD COLUMN "company_id" UUID;
UPDATE "equipment" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "equipment" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "equipment_company_id_idx" ON "equipment"("company_id");
DROP INDEX IF EXISTS "equipment_legacy_id_key";
CREATE UNIQUE INDEX "equipment_company_id_legacy_id_key" ON "equipment"("company_id", "legacy_id");

ALTER TABLE "service_requests" ADD COLUMN "company_id" UUID;
UPDATE "service_requests" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "service_requests" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "service_requests_company_id_idx" ON "service_requests"("company_id");
DROP INDEX IF EXISTS "service_requests_legacy_id_key";
CREATE UNIQUE INDEX "service_requests_company_id_legacy_id_key" ON "service_requests"("company_id", "legacy_id");
DROP INDEX IF EXISTS "service_requests_request_number_key";
CREATE UNIQUE INDEX "service_requests_company_id_request_number_key" ON "service_requests"("company_id", "request_number");

ALTER TABLE "jobs" ADD COLUMN "company_id" UUID;
UPDATE "jobs" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "jobs" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "jobs_company_id_idx" ON "jobs"("company_id");
DROP INDEX IF EXISTS "jobs_legacy_id_key";
CREATE UNIQUE INDEX "jobs_company_id_legacy_id_key" ON "jobs"("company_id", "legacy_id");
DROP INDEX IF EXISTS "jobs_job_number_key";
CREATE UNIQUE INDEX "jobs_company_id_job_number_key" ON "jobs"("company_id", "job_number");

ALTER TABLE "quotations" ADD COLUMN "company_id" UUID;
UPDATE "quotations" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "quotations" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "quotations_company_id_idx" ON "quotations"("company_id");
DROP INDEX IF EXISTS "quotations_legacy_id_key";
CREATE UNIQUE INDEX "quotations_company_id_legacy_id_key" ON "quotations"("company_id", "legacy_id");
DROP INDEX IF EXISTS "quotations_quote_number_key";
CREATE UNIQUE INDEX "quotations_company_id_quote_number_key" ON "quotations"("company_id", "quote_number");

ALTER TABLE "invoices" ADD COLUMN "company_id" UUID;
UPDATE "invoices" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "invoices" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "invoices_company_id_idx" ON "invoices"("company_id");
DROP INDEX IF EXISTS "invoices_legacy_id_key";
CREATE UNIQUE INDEX "invoices_company_id_legacy_id_key" ON "invoices"("company_id", "legacy_id");
DROP INDEX IF EXISTS "invoices_invoice_number_key";
CREATE UNIQUE INDEX "invoices_company_id_invoice_number_key" ON "invoices"("company_id", "invoice_number");

ALTER TABLE "credit_notes" ADD COLUMN "company_id" UUID;
UPDATE "credit_notes" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "credit_notes" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "credit_notes_company_id_idx" ON "credit_notes"("company_id");
DROP INDEX IF EXISTS "credit_notes_credit_number_key";
CREATE UNIQUE INDEX "credit_notes_company_id_credit_number_key" ON "credit_notes"("company_id", "credit_number");

ALTER TABLE "parts" ADD COLUMN "company_id" UUID;
UPDATE "parts" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "parts" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "parts" ADD CONSTRAINT "parts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "parts_company_id_idx" ON "parts"("company_id");
DROP INDEX IF EXISTS "parts_legacy_id_key";
CREATE UNIQUE INDEX "parts_company_id_legacy_id_key" ON "parts"("company_id", "legacy_id");
DROP INDEX IF EXISTS "parts_sku_key";
CREATE UNIQUE INDEX "parts_company_id_sku_key" ON "parts"("company_id", "sku");

ALTER TABLE "inventory_movements" ADD COLUMN "company_id" UUID;
UPDATE "inventory_movements" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "inventory_movements" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "inventory_movements_company_id_idx" ON "inventory_movements"("company_id");
DROP INDEX IF EXISTS "inventory_movements_legacy_id_key";
CREATE UNIQUE INDEX "inventory_movements_company_id_legacy_id_key" ON "inventory_movements"("company_id", "legacy_id");

ALTER TABLE "customer_notifications" ADD COLUMN "company_id" UUID;
UPDATE "customer_notifications" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "customer_notifications" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "customer_notifications_company_id_idx" ON "customer_notifications"("company_id");
DROP INDEX IF EXISTS "customer_notifications_legacy_id_key";
CREATE UNIQUE INDEX "customer_notifications_company_id_legacy_id_key" ON "customer_notifications"("company_id", "legacy_id");

ALTER TABLE "checklist_templates" ADD COLUMN "company_id" UUID;
UPDATE "checklist_templates" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "checklist_templates" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "checklist_templates" ADD CONSTRAINT "checklist_templates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "checklist_templates_company_id_idx" ON "checklist_templates"("company_id");

ALTER TABLE "audit_log" ADD COLUMN "company_id" UUID;
UPDATE "audit_log" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "audit_log" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "audit_log_company_id_idx" ON "audit_log"("company_id");

ALTER TABLE "maintenance_agreements" ADD COLUMN "company_id" UUID;
UPDATE "maintenance_agreements" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "maintenance_agreements" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "maintenance_agreements" ADD CONSTRAINT "maintenance_agreements_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "maintenance_agreements_company_id_idx" ON "maintenance_agreements"("company_id");

ALTER TABLE "certificates" ADD COLUMN "company_id" UUID;
UPDATE "certificates" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "certificates" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE INDEX "certificates_company_id_idx" ON "certificates"("company_id");
DROP INDEX IF EXISTS "certificates_cert_number_key";
CREATE UNIQUE INDEX "certificates_company_id_cert_number_key" ON "certificates"("company_id", "cert_number");

-- Settings: one row per company; make sure the default company has one even if the old table was empty.
INSERT INTO "company_settings" ("id", "company_name", "available_vat_rates", "terms_and_conditions", "bank_details", "updated_at")
SELECT 1, "name", ARRAY[0, 5, 20], '', '{}', now() FROM "companies" WHERE NOT EXISTS (SELECT 1 FROM "company_settings");
-- Settings: one row per company (was the single id = 1 row).
ALTER TABLE "company_settings" ADD COLUMN "company_id" UUID;
UPDATE "company_settings" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "company_settings" DROP CONSTRAINT "company_settings_pkey", DROP COLUMN "id";
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_pkey" PRIMARY KEY ("company_id");
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Counters are per company.
ALTER TABLE "counters" ADD COLUMN "company_id" UUID;
UPDATE "counters" SET "company_id" = (SELECT "id" FROM "companies" LIMIT 1);
ALTER TABLE "counters" ALTER COLUMN "company_id" SET NOT NULL;
ALTER TABLE "counters" DROP CONSTRAINT "counters_pkey";
ALTER TABLE "counters" ADD CONSTRAINT "counters_pkey" PRIMARY KEY ("company_id", "key", "year");
ALTER TABLE "counters" ADD CONSTRAINT "counters_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Duplicate-email guard on customers is per company.
DROP INDEX IF EXISTS "customers_active_email_key";
CREATE UNIQUE INDEX "customers_active_email_key" ON "customers" ("company_id", lower("email")) WHERE "archived" = false AND "is_deleted" = false AND "email" <> '';

-- Safety net + optional create types in Prisma: the API always sets company_id itself, so this default only fires for code that forgot (and fails loudly).
ALTER TABLE "users" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "technicians" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "customers" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "service_locations" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "equipment" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "service_requests" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "jobs" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "quotations" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "invoices" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "credit_notes" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "parts" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "inventory_movements" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "customer_notifications" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "checklist_templates" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "audit_log" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "maintenance_agreements" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "certificates" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
ALTER TABLE "counters" ALTER COLUMN "company_id" SET DEFAULT (current_setting('app.company_id'))::uuid;
