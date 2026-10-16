-- Admin-defined order within a job type.
ALTER TABLE "checklist_templates" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "checklist_templates" t SET "position" = r.rn
FROM (SELECT id, row_number() OVER (PARTITION BY "job_type" ORDER BY "created_at") AS rn FROM "checklist_templates") r
WHERE t.id = r.id;
