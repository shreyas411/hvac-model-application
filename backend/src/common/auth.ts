import type { Request, RequestHandler, Response } from 'express';
import { createRemoteJWKSet, jwtVerify, SignJWT } from 'jose';
import type { User, UserRole } from '../types.js';
import { config, isProd } from '../config.js';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { ApiError, forbidden } from './errors.js';
import { isUuid, plain, prisma } from './prisma.js';

declare module 'express-serve-static-core' {
  interface Request { user: User }
}

const authConfigured = !!(config.jwksUrl || config.jwtSecret);
export const devAuth = !isProd && config.appEnv === 'local' && !authConfigured;

if (!authConfigured && !devAuth) throw new Error('Set SUPABASE_JWT_SECRET or SUPABASE_JWKS_URL: dev auth is only allowed when APP_ENV=local');

// Dev auth must never be reachable from a real deployment: refuse to boot if the allowed origin isn't local.
if (devAuth && !config.corsOrigins.every((o) => /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(o))) throw new Error('Dev auth is enabled but APP_URL is not localhost: set SUPABASE_JWT_SECRET/SUPABASE_JWKS_URL');

// Local dev signs with a per-process random secret (tokens die on restart); there is no hardcoded fallback to leak.
const jwtSecret = config.jwtSecret || randomBytes(32).toString('hex');
const key = config.jwksUrl ? createRemoteJWKSet(new URL(config.jwksUrl)) : new TextEncoder().encode(jwtSecret);

const profile = async (where: { id: string } | { email: string }) => {
  const u = await prisma.user.findUnique({ where });
  // We cast to 'any' then 'User' to satisfy TS when database nulls map to optional properties
  return u ? (plain(u, ['createdAt', 'updatedAt', 'password']) as any as User) : undefined;
};

/** Local-login password storage: `salt:scrypt(password, salt)` hex. Never store the plain password. */
export const hashPassword = (password: string, salt = randomBytes(16).toString('hex')) =>
  `${salt}:${scryptSync(password, salt, 32).toString('hex')}`;
export const checkPassword = (password: string, stored?: string | null) => {
  const [salt] = stored?.split(':') ?? [];
  if (!stored || !salt) return false;
  const a = Buffer.from(hashPassword(password, salt)), b = Buffer.from(stored);
  return a.length === b.length && timingSafeEqual(a, b);
};

/** Hash of a throwaway password, checked when the email is unknown so login timing doesn't reveal which accounts exist. */
export const DUMMY_HASH = hashPassword('not-a-real-password');

/** Local (dev-only) JWTs. `typ: refresh` tokens are rejected by `authenticate`. */
export async function generateLocalToken(user: Pick<User, 'id' | 'role'>, kind: 'access' | 'refresh' = 'access') {
  return await new SignJWT({ sub: user.id, typ: kind })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(kind === 'access' ? '1h' : '7d')
    .sign(key as any);
}

export async function refreshLocalSession(refreshToken: string) {
  const { payload } = await jwtVerify(refreshToken, key as any, { algorithms: ['HS256'] }).catch(() => { throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid refresh token'); });
  const user = payload.typ === 'refresh' && isUuid(payload.sub) ? await profile({ id: payload.sub }) : undefined;
  if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid refresh token');
  return { accessToken: await generateLocalToken(user), refreshToken: await generateLocalToken(user, 'refresh'), expiresIn: 3600 };
}

// Sessions live in httpOnly cookies (invisible to page scripts, so an XSS can't steal them). A Bearer header still works for API clients.
const ACCESS = 'hvac_at', REFRESH = 'hvac_rt';
export const CSRF_HEADER = 'x-requested-with';
const csrfOk = (req: Request) => req.headers[CSRF_HEADER] === 'apexhvac';

export const readCookie = (req: Request, name: string) => {
  const hit = req.headers.cookie?.split(/;\s*/).find((c) => c.startsWith(`${name}=`));
  return hit ? decodeURIComponent(hit.slice(name.length + 1)) : undefined;
};
const cookieOpts = (path: string, maxAgeSec: number) => ({ httpOnly: true, secure: config.appEnv !== 'local', sameSite: config.cookieSameSite, path, maxAge: maxAgeSec * 1000 });

export function setSessionCookies(res: Response, s: { accessToken: string; refreshToken: string; expiresIn: number }) {
  res.cookie(ACCESS, s.accessToken, cookieOpts('/api/v1', s.expiresIn));
  res.cookie(REFRESH, s.refreshToken, cookieOpts('/api/v1/auth', 7 * 24 * 3600));
}
export function clearSessionCookies(res: Response) {
  res.clearCookie(ACCESS, cookieOpts('/api/v1', 0));
  res.clearCookie(REFRESH, cookieOpts('/api/v1/auth', 0));
}
export const refreshTokenFrom = (req: Request) => readCookie(req, REFRESH);
export const accessTokenFrom = (req: Request) => req.headers.authorization?.match(/^Bearer (.+)$/)?.[1] ?? readCookie(req, ACCESS);

/** Cookies are sent by the browser on cross-site requests too, so cookie-authenticated writes must carry the custom header (a plain cross-site form/fetch can't). */
export const requireCsrfHeader: RequestHandler = (req, _res, next) =>
  next(req.method === 'GET' || req.method === 'HEAD' || req.method === 'OPTIONS' || csrfOk(req) ? undefined : forbidden('Missing x-requested-with header'));

/** Verifies the Supabase JWT or Local JWT, loads the `users` profile keyed by the token `sub`. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = accessTokenFrom(req);
    if (bearer && !req.headers.authorization) requireCsrfHeader(req, _res, (e) => { if (e) throw e; }); // cookie session: CSRF guard
    let sub: string | undefined;
    if (bearer) {
      try { 
        const { payload } = await jwtVerify(bearer, key as any, {
          algorithms: config.jwksUrl ? ['RS256', 'ES256'] : ['HS256'], 
          audience: config.jwksUrl ? 'authenticated' : undefined,
          ...(config.supabaseUrl && { issuer: `${config.supabaseUrl}/auth/v1` }),
        });
        if (payload.typ === 'refresh') throw new Error('refresh token used as access token');
        sub = payload.sub;
      } catch { 
        // In local dev, if token is invalid but we have x-dev-user, we can fallback
        if (!devAuth) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid token'); 
      }
    }
    const dev = devAuth ? (req.headers['x-dev-user'] as string | undefined) : undefined;
    const user = isUuid(sub) ? await profile({ id: sub }) : dev?.startsWith('dev-') ? await profile({ email: `${dev.slice(4)}@dev.local` }) : undefined;
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Missing, invalid or unknown user token');
    req.user = user;
    next();
  } catch (e) {
    next(e);
  }
};

export const allow = (...roles: UserRole[]): RequestHandler => (req, _res, next) =>
  next(roles.includes(req.user.role) ? undefined : forbidden(`Requires role: ${roles.join(', ')}`));

export const actor = (req: Request) => ({ id: req.user.id, name: req.user.name, role: req.user.role });
export type Actor = ReturnType<typeof actor>;

/** Dev convenience: one profile per role so `x-dev-user: dev-admin` works. Only when Supabase auth isn't configured; idempotent. */
export async function seedDevUsers() {
  if (!devAuth) return;
  const tech = await prisma.technician.upsert({
    where: { legacyId: 'tech-1' }, update: {},
    create: { legacyId: 'tech-1', name: 'Dev technician', phone: '', email: 'technician@dev.local', skills: [], color: '#0ea5e9', active: true },
  });
  for (const role of ['admin', 'dispatcher', 'technician', 'accountant'] as UserRole[])
    await prisma.user.upsert({
      where: { email: `${role}@dev.local` }, update: {},
      create: { id: randomUUID(), name: `Dev ${role}`, email: `${role}@dev.local`, role, phone: '', ...(role === 'technician' && { technicianId: tech.id }) },
    });
}
