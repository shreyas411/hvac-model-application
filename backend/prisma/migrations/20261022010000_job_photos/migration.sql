CREATE TABLE "job_photos" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "mime" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "caption" TEXT NOT NULL DEFAULT '',
    "taken_by" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "job_photos_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "job_photos_job_id_idx" ON "job_photos"("job_id");
ALTER TABLE "job_photos" ADD CONSTRAINT "job_photos_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
