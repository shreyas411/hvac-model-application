-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'dispatcher', 'technician', 'accountant');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('residential', 'commercial');

-- CreateEnum
CREATE TYPE "CommunicationPreference" AS ENUM ('email', 'sms', 'both');

-- CreateEnum
CREATE TYPE "EquipmentType" AS ENUM ('combi_boiler', 'system_boiler', 'heat_pump', 'air_conditioning', 'ventilation', 'chiller');

-- CreateEnum
CREATE TYPE "MaintenanceFrequency" AS ENUM ('quarterly', 'biannual', 'annual');

-- CreateEnum
CREATE TYPE "EquipmentStatus" AS ENUM ('operational', 'requires_attention', 'decommissioned');

-- CreateEnum
CREATE TYPE "Priority" AS ENUM ('low', 'medium', 'high', 'emergency');

-- CreateEnum
CREATE TYPE "PreferredSlot" AS ENUM ('morning', 'afternoon', 'all_day', 'urgent');

-- CreateEnum
CREATE TYPE "ServiceRequestStatus" AS ENUM ('new', 'awaiting_approval', 'converted', 'cancelled');

-- CreateEnum
CREATE TYPE "JobType" AS ENUM ('installation', 'repair', 'inspection', 'emergency_callout', 'preventive_maintenance');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('new', 'awaiting_approval', 'scheduled', 'dispatched', 'in_progress', 'on_hold', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "ChecklistCategory" AS ENUM ('gas_safety', 'electrical', 'refrigerant', 'general');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('draft', 'issued', 'partially_paid', 'paid', 'overdue', 'void');

-- CreateEnum
CREATE TYPE "LineItemType" AS ENUM ('labour', 'part', 'equipment', 'travel', 'discount', 'fee');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('bacs', 'card', 'cheque', 'cash');

-- CreateEnum
CREATE TYPE "MovementType" AS ENUM ('used_on_job', 'stock_adjustment', 'restock_purchase');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('booking_confirmation', 'appointment_reminder', 'technician_arriving', 'quotation_ready', 'invoice_issued');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('email', 'sms');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('draft', 'ready_to_send', 'sent', 'failed');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "avatar" TEXT,
    "technician_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "technicians" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "gas_safe_license" TEXT,
    "f_gas_license" TEXT,
    "skills" TEXT[],
    "color" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "van_registration" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "company_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "company_name" TEXT NOT NULL,
    "trading_name" TEXT NOT NULL DEFAULT '',
    "gas_safe_register_no" TEXT NOT NULL DEFAULT '',
    "f_gas_cert_no" TEXT NOT NULL DEFAULT '',
    "vat_number" TEXT NOT NULL DEFAULT '',
    "company_number" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "address_line1" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "postcode" TEXT NOT NULL DEFAULT '',
    "website" TEXT NOT NULL DEFAULT '',
    "currency_symbol" TEXT NOT NULL DEFAULT '£',
    "default_vat_rate" DECIMAL(5,2) NOT NULL DEFAULT 20,
    "available_vat_rates" DECIMAL(5,2)[],
    "working_hours_start" TEXT NOT NULL DEFAULT '08:00',
    "working_hours_end" TEXT NOT NULL DEFAULT '17:30',
    "enable_inventory" BOOLEAN NOT NULL DEFAULT true,
    "prefix_job" TEXT NOT NULL DEFAULT 'JOB-',
    "prefix_quote" TEXT NOT NULL DEFAULT 'QTE-',
    "prefix_invoice" TEXT NOT NULL DEFAULT 'INV-',
    "bank_details" JSONB NOT NULL DEFAULT '{}',
    "terms_and_conditions" TEXT NOT NULL DEFAULT '',
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "company_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counters" (
    "key" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "next_value" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "counters_pkey" PRIMARY KEY ("key","year")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "type" "CustomerType" NOT NULL,
    "name" TEXT NOT NULL,
    "company_name" TEXT,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "billing_address" JSONB NOT NULL,
    "notes" TEXT,
    "communication_preference" "CommunicationPreference" NOT NULL DEFAULT 'email',
    "gdpr_consent" BOOLEAN NOT NULL DEFAULT false,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_locations" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "customer_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "address_line1" TEXT NOT NULL,
    "address_line2" TEXT,
    "city" TEXT NOT NULL,
    "postcode" TEXT NOT NULL,
    "access_notes" TEXT,
    "contact_name" TEXT,
    "contact_phone" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_locations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "customer_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "type" "EquipmentType" NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "serial_number" TEXT NOT NULL DEFAULT '',
    "installation_date" DATE,
    "warranty_expiry_date" DATE,
    "maintenance_frequency" "MaintenanceFrequency" NOT NULL,
    "last_service_date" DATE,
    "next_service_due_date" DATE,
    "status" "EquipmentStatus" NOT NULL DEFAULT 'operational',
    "location_notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_service_records" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "equipment_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "job_id" UUID,
    "technician_name" TEXT NOT NULL,
    "service_type" TEXT NOT NULL,
    "findings" TEXT NOT NULL DEFAULT '',
    "readings" JSONB,
    "parts_replaced" TEXT[],
    "recommendations" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "equipment_service_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_requests" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "request_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "equipment_id" UUID,
    "reported_problem" TEXT NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "preferred_slot" "PreferredSlot" NOT NULL DEFAULT 'morning',
    "status" "ServiceRequestStatus" NOT NULL DEFAULT 'new',
    "contact_person" TEXT,
    "contact_phone" TEXT,
    "internal_notes" TEXT,
    "converted_job_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "service_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "job_number" TEXT NOT NULL,
    "request_id" UUID,
    "customer_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "type" "JobType" NOT NULL,
    "priority" "Priority" NOT NULL DEFAULT 'medium',
    "status" "JobStatus" NOT NULL DEFAULT 'new',
    "technician_id" UUID,
    "appointment_date" DATE NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "estimated_duration_minutes" INTEGER NOT NULL DEFAULT 60,
    "required_skills" TEXT[],
    "description" TEXT NOT NULL DEFAULT '',
    "internal_notes" TEXT,
    "work_performed" TEXT,
    "labour_hours" DECIMAL(6,2) NOT NULL DEFAULT 0,
    "hourly_rate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "travel_time_minutes" INTEGER NOT NULL DEFAULT 0,
    "travel_charge" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "customer_signature" JSONB,
    "follow_up_recommended" BOOLEAN,
    "follow_up_notes" TEXT,
    "arrival_time" TIMESTAMPTZ,
    "completion_time" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_equipment" (
    "job_id" UUID NOT NULL,
    "equipment_id" UUID NOT NULL,

    CONSTRAINT "job_equipment_pkey" PRIMARY KEY ("job_id","equipment_id")
);

-- CreateTable
CREATE TABLE "job_parts_used" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "part_id" UUID,
    "part_name" TEXT NOT NULL,
    "sku" TEXT NOT NULL DEFAULT '',
    "quantity" INTEGER NOT NULL,
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,

    CONSTRAINT "job_parts_used_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_checklist_items" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL,
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "notes" TEXT,

    CONSTRAINT "job_checklist_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_audit_log" (
    "id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "user_name" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "quote_number" TEXT NOT NULL,
    "customer_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "job_id" UUID,
    "issue_date" DATE NOT NULL,
    "expiry_date" DATE NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vat_rate_percent" DECIMAL(5,2) NOT NULL,
    "vat_amount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "terms" TEXT NOT NULL DEFAULT '',
    "notes" TEXT,
    "accepted_at" TIMESTAMPTZ,
    "accepted_by" TEXT,
    "converted_to_job_id" UUID,
    "converted_to_invoice_id" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "invoice_number" TEXT NOT NULL,
    "quote_id" UUID,
    "job_id" UUID,
    "customer_id" UUID NOT NULL,
    "location_id" UUID NOT NULL,
    "issue_date" DATE NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'draft',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "vat_rate_percent" DECIMAL(5,2) NOT NULL,
    "vat_amount" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "amount_paid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balance_due" DECIMAL(12,2) NOT NULL,
    "payment_terms_days" INTEGER NOT NULL DEFAULT 30,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "line_items" (
    "id" UUID NOT NULL,
    "quotation_id" UUID,
    "invoice_id" UUID,
    "type" "LineItemType" NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unit_price" DECIMAL(12,2) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "position" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "invoice_id" UUID NOT NULL,
    "date" DATE NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT NOT NULL DEFAULT '',
    "recorded_by" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "parts" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "name" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "unit_cost" DECIMAL(12,2) NOT NULL,
    "selling_price" DECIMAL(12,2) NOT NULL,
    "stock_quantity" INTEGER NOT NULL DEFAULT 0,
    "min_stock_level" INTEGER NOT NULL DEFAULT 0,
    "location" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL,

    CONSTRAINT "parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inventory_movements" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "part_id" UUID NOT NULL,
    "type" "MovementType" NOT NULL,
    "quantity_delta" INTEGER NOT NULL,
    "job_id" UUID,
    "notes" TEXT NOT NULL DEFAULT '',
    "user_name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inventory_movements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_notifications" (
    "id" UUID NOT NULL,
    "legacy_id" TEXT,
    "customer_id" UUID NOT NULL,
    "type" "NotificationType" NOT NULL,
    "recipient" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "subject" TEXT NOT NULL,
    "message_body" TEXT NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'draft',
    "sent_at" TIMESTAMPTZ,
    "approved_by" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_technician_id_key" ON "users"("technician_id");

-- CreateIndex
CREATE UNIQUE INDEX "technicians_legacy_id_key" ON "technicians"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "customers_legacy_id_key" ON "customers"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_locations_legacy_id_key" ON "service_locations"("legacy_id");

-- CreateIndex
CREATE INDEX "service_locations_customer_id_idx" ON "service_locations"("customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_legacy_id_key" ON "equipment"("legacy_id");

-- CreateIndex
CREATE INDEX "equipment_customer_id_idx" ON "equipment"("customer_id");

-- CreateIndex
CREATE INDEX "equipment_next_service_due_date_idx" ON "equipment"("next_service_due_date");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_service_records_legacy_id_key" ON "equipment_service_records"("legacy_id");

-- CreateIndex
CREATE INDEX "equipment_service_records_equipment_id_idx" ON "equipment_service_records"("equipment_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_legacy_id_key" ON "service_requests"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_request_number_key" ON "service_requests"("request_number");

-- CreateIndex
CREATE UNIQUE INDEX "service_requests_converted_job_id_key" ON "service_requests"("converted_job_id");

-- CreateIndex
CREATE INDEX "service_requests_status_idx" ON "service_requests"("status");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_legacy_id_key" ON "jobs"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_job_number_key" ON "jobs"("job_number");

-- CreateIndex
CREATE INDEX "jobs_technician_id_appointment_date_idx" ON "jobs"("technician_id", "appointment_date");

-- CreateIndex
CREATE INDEX "jobs_status_idx" ON "jobs"("status");

-- CreateIndex
CREATE INDEX "job_parts_used_job_id_idx" ON "job_parts_used"("job_id");

-- CreateIndex
CREATE INDEX "job_checklist_items_job_id_idx" ON "job_checklist_items"("job_id");

-- CreateIndex
CREATE INDEX "job_audit_log_job_id_idx" ON "job_audit_log"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_legacy_id_key" ON "quotations"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quote_number_key" ON "quotations"("quote_number");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_converted_to_invoice_id_key" ON "quotations"("converted_to_invoice_id");

-- CreateIndex
CREATE INDEX "quotations_status_expiry_date_idx" ON "quotations"("status", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_legacy_id_key" ON "invoices"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_invoice_number_key" ON "invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "invoices_status_due_date_idx" ON "invoices"("status", "due_date");

-- CreateIndex
CREATE INDEX "line_items_quotation_id_idx" ON "line_items"("quotation_id");

-- CreateIndex
CREATE INDEX "line_items_invoice_id_idx" ON "line_items"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "payments_legacy_id_key" ON "payments"("legacy_id");

-- CreateIndex
CREATE INDEX "payments_invoice_id_idx" ON "payments"("invoice_id");

-- CreateIndex
CREATE UNIQUE INDEX "parts_legacy_id_key" ON "parts"("legacy_id");

-- CreateIndex
CREATE UNIQUE INDEX "parts_sku_key" ON "parts"("sku");

-- CreateIndex
CREATE UNIQUE INDEX "inventory_movements_legacy_id_key" ON "inventory_movements"("legacy_id");

-- CreateIndex
CREATE INDEX "inventory_movements_part_id_idx" ON "inventory_movements"("part_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_notifications_legacy_id_key" ON "customer_notifications"("legacy_id");

-- CreateIndex
CREATE INDEX "customer_notifications_status_idx" ON "customer_notifications"("status");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_locations" ADD CONSTRAINT "service_locations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment" ADD CONSTRAINT "equipment_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_service_records" ADD CONSTRAINT "equipment_service_records_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_service_records" ADD CONSTRAINT "equipment_service_records_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_requests" ADD CONSTRAINT "service_requests_converted_job_id_fkey" FOREIGN KEY ("converted_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "service_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "technicians"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_equipment" ADD CONSTRAINT "job_equipment_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_equipment" ADD CONSTRAINT "job_equipment_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts_used" ADD CONSTRAINT "job_parts_used_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_parts_used" ADD CONSTRAINT "job_parts_used_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_checklist_items" ADD CONSTRAINT "job_checklist_items_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_audit_log" ADD CONSTRAINT "job_audit_log_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_converted_to_job_id_fkey" FOREIGN KEY ("converted_to_job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_converted_to_invoice_id_fkey" FOREIGN KEY ("converted_to_invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_quote_id_fkey" FOREIGN KEY ("quote_id") REFERENCES "quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_location_id_fkey" FOREIGN KEY ("location_id") REFERENCES "service_locations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_part_id_fkey" FOREIGN KEY ("part_id") REFERENCES "parts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inventory_movements" ADD CONSTRAINT "inventory_movements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_notifications" ADD CONSTRAINT "customer_notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Hand-written additions (TECH_SPEC §4, §6.8, §12.4)
ALTER TABLE "parts" ADD CONSTRAINT "parts_stock_quantity_check" CHECK ("stock_quantity" >= 0);
ALTER TABLE "company_settings" ADD CONSTRAINT "company_settings_single_row" CHECK ("id" = 1);
ALTER TABLE "line_items" ADD CONSTRAINT "line_items_one_parent" CHECK (("quotation_id" IS NULL) <> ("invoice_id" IS NULL));

-- RLS on every table, no policies: the anon key reads nothing; only the API (service role / direct connection) has access
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
