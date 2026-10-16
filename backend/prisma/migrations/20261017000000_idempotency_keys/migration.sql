-- Replay guard for the offline write queue (x-idempotency-key).
CREATE TABLE "idempotency_keys" (
    "key" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" INTEGER,
    "body" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("key","user_id")
);
