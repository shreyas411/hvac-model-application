-- one live invoice per quote still holds, except for staged (deposit / stage / final) invoices
DROP INDEX IF EXISTS "invoices_quote_id_live_key";
CREATE UNIQUE INDEX "invoices_quote_id_live_key" ON "invoices"("quote_id") WHERE "quote_id" IS NOT NULL AND "status" <> 'void' AND "stage_label" IS NULL;
