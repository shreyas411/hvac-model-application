ALTER TABLE "quotations" ADD COLUMN "accepted_signature" TEXT, ADD COLUMN "approval_token_hash" TEXT;
CREATE UNIQUE INDEX "quotations_approval_token_hash_key" ON "quotations"("approval_token_hash");
