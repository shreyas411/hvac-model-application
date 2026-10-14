-- The single company_settings row (id = 1); the API only ever updates it.
INSERT INTO "company_settings" ("id", "company_name", "available_vat_rates", "terms_and_conditions", "bank_details", "updated_at")
VALUES (1, 'My HVAC Company', ARRAY[20, 5, 0], 'Payment due within 14 days of invoice issue.',
        '{"bankName":"","accountName":"","sortCode":"","accountNumber":""}', now())
ON CONFLICT ("id") DO NOTHING;
