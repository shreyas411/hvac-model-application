-- Per-line VAT override (NULL = the document's rate) and the VAT share of each credit note.
ALTER TABLE "line_items" ADD COLUMN IF NOT EXISTS "vat_rate_percent" DECIMAL(5,2);
ALTER TABLE "credit_notes" ADD COLUMN IF NOT EXISTS "vat_amount" DECIMAL(12,2) NOT NULL DEFAULT 0;
