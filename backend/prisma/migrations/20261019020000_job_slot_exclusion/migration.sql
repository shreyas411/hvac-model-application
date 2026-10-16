-- Backstop for the app-level slot check: one technician can't hold two overlapping non-cancelled jobs.
-- The range is built from the date + HH:MM text columns with immutable operations only (text::time is not immutable).
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE OR REPLACE FUNCTION job_slot(d date, hhmm text) RETURNS timestamp LANGUAGE sql IMMUTABLE AS
$$ SELECT d::timestamp + (split_part(hhmm, ':', 1)::int * 60 + split_part(hhmm, ':', 2)::int) * interval '1 minute' $$;

DO $$ BEGIN
  ALTER TABLE "jobs" ADD CONSTRAINT "jobs_technician_no_overlap" EXCLUDE USING gist (
    "technician_id" WITH =,
    tsrange(job_slot("appointment_date", "start_time"), job_slot("appointment_date", "end_time")) WITH &&
  ) WHERE ("technician_id" IS NOT NULL AND "status" <> 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN exclusion_violation THEN RAISE NOTICE 'jobs_technician_no_overlap NOT created: existing jobs overlap. Fix the data, then re-run this ALTER TABLE.';
END $$;
