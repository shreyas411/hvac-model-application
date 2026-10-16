-- Credit notes, payment refunds, stock VAT. Idempotent: dev databases already got these via db push.
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'credited';
ALTER TABLE "inventory_movements" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "refunded" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS "credit_notes" (
    "id" UUID NOT NULL,
    "credit_number" TEXT NOT NULL,
    "invoice_id" UUID NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "credit_notes_credit_number_key" ON "credit_notes"("credit_number");
CREATE INDEX IF NOT EXISTS "credit_notes_invoice_id_idx" ON "credit_notes"("invoice_id");
DO $$ BEGIN
  ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
