-- Prune idempotency keys after 7 days (the offline queue's own retention), same pg_cron pattern as the other sweeps.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    RAISE NOTICE 'pg_cron is not available here: sweep not scheduled in the database';
    RETURN;
  END IF;
  CREATE EXTENSION IF NOT EXISTS pg_cron;
  PERFORM cron.schedule('hvac-prune-idempotency-keys', '10 0 * * *', $job$
    DELETE FROM public.idempotency_keys WHERE created_at < now() - interval '7 days'
  $job$);
END $$;
