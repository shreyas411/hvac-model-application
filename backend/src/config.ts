import dotenv from 'dotenv';

// APP_ENV: local | staging | production. Loads .env.<APP_ENV> first, then .env (existing vars win).
const appEnv = process.env.APP_ENV ?? 'local';
dotenv.config({ path: [`.env.${appEnv}`, '.env'] });

export const config = {
  appEnv,
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  jwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  jwksUrl: process.env.SUPABASE_JWKS_URL ?? '',
  workerInline: process.env.WORKER_INLINE !== 'false',
};
export const isProd = config.env === 'production';
