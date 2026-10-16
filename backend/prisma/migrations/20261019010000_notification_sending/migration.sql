-- Delivery claims a row by status instead of holding a transaction open during the provider call.
ALTER TYPE "NotificationStatus" ADD VALUE IF NOT EXISTS 'sending';
ALTER TABLE "customer_notifications" ADD COLUMN IF NOT EXISTS "claimed_at" TIMESTAMPTZ;
