-- Admin-managed checklist items per job type.
CREATE TABLE "checklist_templates" (
    "id" UUID NOT NULL,
    "job_type" "JobType" NOT NULL,
    "label" TEXT NOT NULL,
    "category" "ChecklistCategory" NOT NULL DEFAULT 'general',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "checklist_templates_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "checklist_templates_job_type_idx" ON "checklist_templates"("job_type");

INSERT INTO "checklist_templates" ("id","job_type","label","category","created_at") VALUES
  (gen_random_uuid(), 'installation', 'Confirm site survey and unit sizing', 'general', clock_timestamp()),
  (gen_random_uuid(), 'installation', 'Isolate and test electrical supply', 'electrical', clock_timestamp()),
  (gen_random_uuid(), 'installation', 'Pressure test and evacuate refrigerant lines', 'refrigerant', clock_timestamp()),
  (gen_random_uuid(), 'installation', 'Gas tightness test on new connections', 'gas_safety', clock_timestamp()),
  (gen_random_uuid(), 'installation', 'Commission unit and brief customer', 'general', clock_timestamp()),
  (gen_random_uuid(), 'repair', 'Initial visual survey and isolate supply', 'general', clock_timestamp()),
  (gen_random_uuid(), 'repair', 'Perform diagnostic testing', 'general', clock_timestamp()),
  (gen_random_uuid(), 'repair', 'Check wiring, fuses and controls', 'electrical', clock_timestamp()),
  (gen_random_uuid(), 'repair', 'Check for refrigerant leaks', 'refrigerant', clock_timestamp()),
  (gen_random_uuid(), 'repair', 'Verify operational safety and test cycle', 'general', clock_timestamp()),
  (gen_random_uuid(), 'inspection', 'Visual inspection of unit and surroundings', 'general', clock_timestamp()),
  (gen_random_uuid(), 'inspection', 'Check flue / ventilation and gas pressure', 'gas_safety', clock_timestamp()),
  (gen_random_uuid(), 'inspection', 'Electrical safety checks', 'electrical', clock_timestamp()),
  (gen_random_uuid(), 'inspection', 'F-Gas leak check and log', 'refrigerant', clock_timestamp()),
  (gen_random_uuid(), 'emergency_callout', 'Make safe: isolate gas / power', 'gas_safety', clock_timestamp()),
  (gen_random_uuid(), 'emergency_callout', 'Diagnose fault', 'general', clock_timestamp()),
  (gen_random_uuid(), 'emergency_callout', 'Temporary or permanent repair', 'general', clock_timestamp()),
  (gen_random_uuid(), 'emergency_callout', 'Confirm safe operation and report follow-up work', 'general', clock_timestamp()),
  (gen_random_uuid(), 'preventive_maintenance', 'Clean filters, coils and condensate drain', 'general', clock_timestamp()),
  (gen_random_uuid(), 'preventive_maintenance', 'Check electrical connections and amp draw', 'electrical', clock_timestamp()),
  (gen_random_uuid(), 'preventive_maintenance', 'Check refrigerant pressures and leaks', 'refrigerant', clock_timestamp()),
  (gen_random_uuid(), 'preventive_maintenance', 'Combustion analysis and safety devices', 'gas_safety', clock_timestamp()),
  (gen_random_uuid(), 'preventive_maintenance', 'Record readings and service sign-off', 'general', clock_timestamp());
