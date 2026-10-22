-- One active customer per email (case-insensitive). Archived customers are exempt so a returning customer can be re-added or restored.
CREATE UNIQUE INDEX "customers_active_email_key" ON "customers" (lower("email")) WHERE "archived" = false AND "email" <> '';
