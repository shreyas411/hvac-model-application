-- Keep array order of embedded child rows, and don't round labour hours / quantities to 2dp (100 min = 1.6667 h).
ALTER TABLE "job_checklist_items" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "job_parts_used" ADD COLUMN "created_at" TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE "jobs" ALTER COLUMN "labour_hours" TYPE NUMERIC(8,4);
ALTER TABLE "line_items" ALTER COLUMN "quantity" TYPE NUMERIC(10,4);
