ALTER TABLE "maintenance_agreements"
  ADD COLUMN "annual_price" DECIMAL(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN "end_date" DATE,
  ADD COLUMN "sla_response_hours" INTEGER,
  ADD COLUMN "auto_invoice" BOOLEAN NOT NULL DEFAULT false;
