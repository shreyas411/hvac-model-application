import { Router } from 'express';
import { z } from 'zod';
import { authenticate } from '../../common/auth.js';
import { ApiError, h } from '../../common/errors.js';
import { config } from '../../config.js';

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
authRouter.post('/login', h(async (req) => {
  const { email, password } = z.object({ email: z.string().email(), password: z.string().min(1) }).parse(req.body);
  return session(await gotrue('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) }));
}));
authRouter.post('/refresh', h(async (req) => {
  const { refreshToken } = z.object({ refreshToken: z.string().min(1) }).parse(req.body);
  return session(await gotrue('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: refreshToken }) }));
}));
authRouter.post('/logout', h(async (req) => {
  const token = req.headers.authorization?.replace(/^Bearer /, '');
  if (token) await gotrue('logout', { method: 'POST', token });
}));
authRouter.get('/me', authenticate, h((req) => req.user));
