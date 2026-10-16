import dotenv from 'dotenv';

// APP_ENV: local | staging | production. Loads .env.<APP_ENV> first, then .env (existing vars win).
// Defaults to production under NODE_ENV=production so a forgotten APP_ENV can never enable dev auth.
const appEnv = process.env.APP_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'local');
dotenv.config({ path: [`.env.${appEnv}`, '.env'] });

export const config = {
  appEnv,
  env: process.env.NODE_ENV ?? 'development',
  port: Number(process.env.PORT ?? 3001),
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  corsOrigins: (process.env.APP_URL ?? 'http://localhost:3000').split(',').map((o) => o.trim()).filter(Boolean),
  supabaseUrl: process.env.SUPABASE_URL ?? '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
  jwtSecret: process.env.SUPABASE_JWT_SECRET ?? '',
  jwksUrl: process.env.SUPABASE_JWKS_URL ?? '',
  // Cookies are Secure outside local dev. Use COOKIE_SAMESITE=none only when the web app and API sit on different sites (needs HTTPS).
  cookieSameSite: (process.env.COOKIE_SAMESITE ?? 'lax') as 'lax' | 'strict' | 'none',
  trustProxy: Number(process.env.TRUST_PROXY ?? 0), // reverse-proxy hops in front of the API, so rate limiting sees client IPs
  // Inline worker only for local dev; deployed replicas must opt in (otherwise every replica runs the sweeps).
  workerInline: process.env.WORKER_INLINE ? process.env.WORKER_INLINE === 'true' : appEnv === 'local',
};
export const isProd = config.env === 'production';
