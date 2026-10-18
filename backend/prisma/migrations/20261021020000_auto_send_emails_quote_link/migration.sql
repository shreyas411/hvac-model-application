ALTER TABLE "company_settings" ADD COLUMN "auto_send_emails" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "customer_notifications" ADD COLUMN "quotation_id" UUID;
