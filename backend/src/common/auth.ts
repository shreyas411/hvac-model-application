import type { Request, RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { User, UserRole } from '../types.js';
import { config, isProd } from '../config.js';
import { randomUUID } from 'node:crypto';
import { ApiError, forbidden } from './errors.js';
import { isUuid, plain, prisma } from './prisma.js';

declare module 'express-serve-static-core' {
  interface Request { user: User }
}

const authConfigured = !!(config.jwksUrl || config.jwtSecret);
const key = config.jwksUrl ? createRemoteJWKSet(new URL(config.jwksUrl)) : new TextEncoder().encode(config.jwtSecret);

const profile = async (where: { id: string } | { email: string }) => {
  const u = await prisma.user.findUnique({ where });
  return u ? (plain(u, ['createdAt', 'updatedAt']) as unknown as User) : undefined;
};

/** Verifies the Supabase JWT, loads the `users` profile keyed by the token `sub`. */
export const authenticate: RequestHandler = async (req, _res, next) => {
  try {
    const bearer = req.headers.authorization?.match(/^Bearer (.+)$/)?.[1];
    let sub: string | undefined;
    if (bearer && authConfigured) {
      try { sub = (await jwtVerify(bearer, key as any)).payload.sub; } catch { throw new ApiError(401, 'UNAUTHENTICATED', 'Invalid token'); }
    }
    const dev = !isProd && !authConfigured ? (req.headers['x-dev-user'] as string | undefined) : undefined; // dev only: `dev-<role>`
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
  if (isProd || authConfigured) return;
  // The dev technician has legacy id 'tech-1', the id the frontend's demo data uses, so /import keeps the user linked to it.
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
