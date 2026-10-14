-- Daily sweeps (TECH_SPEC §6.6, §6.7, §12.4), scheduled with pg_cron at 00:05 UTC.
-- Skipped with a notice where pg_cron isn't available (plain local Postgres); the API worker runs the same sweeps as a fallback.
-- They are idempotent, so both running is harmless. updated_at is set by hand: Prisma's @updatedAt has no database default.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not available here: sweeps not scheduled in the database';
    RETURN;
  END IF;
  CREATE EXTENSION IF NOT EXISTS pg_cron;

  -- cron.schedule(name, ...) replaces a job with the same name, so re-running this migration is safe
  PERFORM cron.schedule('hvac-overdue-invoices', '5 0 * * *', $job$
    UPDATE public.invoices SET status = 'overdue', updated_at = now()
    WHERE status IN ('issued', 'partially_paid') AND due_date < (now() AT TIME ZONE 'utc')::date
  $job$);
  PERFORM cron.schedule('hvac-expire-quotations', '5 0 * * *', $job$
    UPDATE public.quotations SET status = 'expired', updated_at = now()
    WHERE status IN ('sent', 'viewed') AND expiry_date < (now() AT TIME ZONE 'utc')::date
  $job$);
END $$;
