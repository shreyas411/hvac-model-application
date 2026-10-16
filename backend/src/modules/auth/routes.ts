import { Router, type Response } from 'express';
import { z } from 'zod';
import { accessTokenFrom, authenticate, checkPassword, clearSessionCookies, DUMMY_HASH, devAuth, generateLocalToken, refreshLocalSession, refreshTokenFrom, requireCsrfHeader, setSessionCookies } from '../../common/auth.js';
import { ApiError, h } from '../../common/errors.js';
import { config } from '../../config.js';
import { prisma } from '../../common/prisma.js';

// Thin proxy to Supabase Auth (GoTrue); the API itself never sees or stores passwords.
async function gotrue(path: string, init: RequestInit & { token?: string }) {
  if (!config.supabaseUrl) throw new ApiError(501, 'AUTH_NOT_CONFIGURED', 'SUPABASE_URL is not set');
  const res = await fetch(`${config.supabaseUrl}/auth/v1/${path}`, {
    ...init,
    headers: { 'content-type': 'application/json', apikey: config.supabaseAnonKey, ...(init.token && { authorization: `Bearer ${init.token}` }) },
  });
  const body: any = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status === 400 ? 401 : res.status, 'AUTH_FAILED', body.error_description ?? body.msg ?? 'Auth failed');
  return body;
}
const session = (b: any) => ({ accessToken: b.access_token, refreshToken: b.refresh_token, expiresIn: b.expires_in });

export const authRouter = Router();
authRouter.use(requireCsrfHeader);

type Tokens = { accessToken: string; refreshToken: string; expiresIn: number };
/** Tokens go out as httpOnly cookies, never in the body. */
const start = (res: Response, t: Tokens) => (setSessionCookies(res, t), { expiresIn: t.expiresIn });

authRouter.post('/login', (req, res, next) => void Promise.resolve().then(async () => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  if (devAuth) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (!checkPassword(password, user?.password ?? DUMMY_HASH) || !user) throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid email or password');
    return start(res, { accessToken: await generateLocalToken(user), refreshToken: await generateLocalToken(user, 'refresh'), expiresIn: 3600 });
  }
  return start(res, session(await gotrue('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) })));
}).then((r) => res.json(r), next));

authRouter.post('/refresh', (req, res, next) => void Promise.resolve().then(async () => {
  const refreshToken = refreshTokenFrom(req);
  if (!refreshToken) throw new ApiError(401, 'UNAUTHENTICATED', 'No refresh token');
  if (devAuth) return start(res, await refreshLocalSession(refreshToken));
  return start(res, session(await gotrue('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) })));
}).then((r) => res.json(r), (e) => (clearSessionCookies(res), next(e))));

authRouter.post('/logout', (req, res, next) => void Promise.resolve().then(async () => {
  const token = accessTokenFrom(req);
  clearSessionCookies(res);
  if (token && !devAuth) await gotrue('logout', { method: 'POST', token }).catch(() => {}); // cookies are gone either way
}).then(() => res.sendStatus(204), next));

authRouter.get('/me', authenticate, h((req) => req.user));
