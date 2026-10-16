-- Generic audit trail for money/compliance actions.
CREATE TABLE IF NOT EXISTS "audit_log" (
    "id" UUID NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- One live invoice per quotation (a quote can't be billed twice).
CREATE UNIQUE INDEX IF NOT EXISTS "invoices_quote_id_live_key" ON "invoices"("quote_id") WHERE "quote_id" IS NOT NULL AND "status" <> 'void';

-- Lookup indexes the list/report queries filter on.
CREATE INDEX IF NOT EXISTS "jobs_customer_id_idx" ON "jobs"("customer_id");
CREATE INDEX IF NOT EXISTS "invoices_customer_id_idx" ON "invoices"("customer_id");
CREATE INDEX IF NOT EXISTS "invoices_job_id_idx" ON "invoices"("job_id");
CREATE INDEX IF NOT EXISTS "invoices_issue_date_idx" ON "invoices"("issue_date");
CREATE INDEX IF NOT EXISTS "quotations_customer_id_idx" ON "quotations"("customer_id");
CREATE INDEX IF NOT EXISTS "inventory_movements_job_id_idx" ON "inventory_movements"("job_id");
CREATE INDEX IF NOT EXISTS "payments_date_idx" ON "payments"("date");

-- Money/stock invariants enforced in the database, not just the app.
DO $$ BEGIN
  ALTER TABLE "invoices" ADD CONSTRAINT "invoices_amount_paid_nonneg" CHECK ("amount_paid" >= 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "payments" ADD CONSTRAINT "payments_amount_positive" CHECK ("amount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_amount_positive" CHECK ("amount" > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- RLS: the init migration only covered tables that existed then. Cover every public table now,
-- and any created by a later migration via the event trigger below.
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION public.rls_auto_enable() RETURNS event_trigger LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN SELECT * FROM pg_event_trigger_ddl_commands() WHERE command_tag = 'CREATE TABLE' AND schema_name = 'public' LOOP
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', r.object_identity);
  END LOOP;
END $$;
DROP EVENT TRIGGER IF EXISTS rls_auto_enable;
CREATE EVENT TRIGGER rls_auto_enable ON ddl_command_end WHEN TAG IN ('CREATE TABLE') EXECUTE FUNCTION public.rls_auto_enable();
