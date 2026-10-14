import type { Request, RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { User, UserRole } from '../types.js';
import { config, isProd } from '../config.js';
import { ApiError, forbidden } from './errors.js';
import { db } from './store.js';

declare module 'express-serve-static-core' {
  interface Request { user: User }
}

const key = config.jwksUrl ? createRemoteJWKSet(new URL(config.jwksUrl)) : new TextEncoder().encode(config.jwtSecret);

/** Verifies the Supabase JWT, loads the `users` profile keyed by the token `sub`. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    let userId: string | undefined;
    if (bearer && (config.jwksUrl || config.jwtSecret)) {
      userId = (await jwtVerify(bearer, key as any)).payload.sub;
    } else if (!isProd && !config.jwksUrl && !config.jwtSecret) {
      userId = req.headers['x-dev-user'] as string | undefined; // dev only: no auth configured
    }
    const user = userId ? db.users.find(userId) : undefined;
    if (!user) throw new ApiError(401, 'UNAUTHENTICATED', 'Missing, invalid or unknown user token');
    req.user = user;
    next();
  } catch (e) {
    next(e instanceof ApiError ? e : new ApiError(401, 'UNAUTHENTICATED', 'Invalid token'));
  }
};

export const allow = (...roles: UserRole[]): RequestHandler => (req, _res, next) =>
  next(roles.includes(req.user.role) ? undefined : forbidden(`Requires role: ${roles.join(', ')}`));

export const actor = (req: Request) => ({ id: req.user.id, name: req.user.name, role: req.user.role });
export type Actor = ReturnType<typeof actor>;

/** Dev convenience: one profile per role so `x-dev-user: dev-admin` works without auth set up. */
export function seedDevUsers() {
  if (isProd) return;
  // The dev technician is linked to profile 'tech-1', the id the frontend's demo data (and /import) uses.
  db.technicians.insert({ id: 'tech-1', name: 'Dev technician', phone: '', email: 'technician@dev.local', skills: [], color: '#0ea5e9', active: true });
  for (const role of ['admin', 'dispatcher', 'technician', 'accountant'] as UserRole[])
    db.users.insert({ id: `dev-${role}`, name: `Dev ${role}`, email: `${role}@dev.local`, role, phone: '', ...(role === 'technician' && { technicianId: 'tech-1' }) });
}
