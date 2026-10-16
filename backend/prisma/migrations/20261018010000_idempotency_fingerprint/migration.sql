-- Binds a key to the request that first used it (sha256 of method + path + body).
ALTER TABLE "idempotency_keys" ADD COLUMN IF NOT EXISTS "fingerprint" TEXT NOT NULL DEFAULT '';
