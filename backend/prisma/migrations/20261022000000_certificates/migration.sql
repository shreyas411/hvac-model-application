CREATE TYPE "CertificateType" AS ENUM ('cp12', 'service_record', 'commissioning');

CREATE TABLE "certificates" (
    "id" UUID NOT NULL,
    "cert_number" TEXT NOT NULL,
    "type" "CertificateType" NOT NULL,
    "job_id" UUID,
    "customer_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "technician_id" UUID NOT NULL,
    "engineer_name" TEXT NOT NULL,
    "gas_safe_number" TEXT NOT NULL,
    "issue_date" DATE NOT NULL,
    "expiry_date" DATE,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "certificates_cert_number_key" ON "certificates"("cert_number");
CREATE INDEX "certificates_customer_id_idx" ON "certificates"("customer_id");
CREATE INDEX "certificates_job_id_idx" ON "certificates"("job_id");
CREATE INDEX "certificates_expiry_date_idx" ON "certificates"("expiry_date");
