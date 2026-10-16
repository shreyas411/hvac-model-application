-- Local-login password hash (APP_ENV=local only; Supabase handles real passwords). IF NOT EXISTS: dev databases got it via db push.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "password" TEXT;
