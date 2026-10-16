import { createHash } from 'node:crypto';
import type { RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { logger } from './logger.js';
import { unprocessable } from './errors.js';
import { prisma } from './prisma.js';

const STUCK_AFTER_MS = 60_000; // a key still unanswered after this belongs to a crashed request: let the retry take it over

/**
 * Writes carrying `x-idempotency-key` (set by the service worker's queue) run once per (user, key):
 * a replay after a lost response gets the stored status/body instead of creating a duplicate.
 * The key is bound to method + path + body: reusing it for a different request is a 422, not someone else's response.
 * Only successful (<400) responses are kept; failures commit nothing, so their key is freed and a retry re-runs.
 * Pruned after 7 days (the queue's retention) by pg_cron, or by the worker's daily sweep where pg_cron is missing.
 */
export const idempotency: RequestHandler = async (req, res, next) => {
  const key = req.header('x-idempotency-key');
  if (req.method === 'GET' || !key) return next();
  if (!/^[\w-]{1,64}$/.test(key)) return next(unprocessable('BAD_IDEMPOTENCY_KEY', 'x-idempotency-key must be 1-64 word characters'));
  const userId = req.user.id;
  const where = { key_userId: { key, userId } };
  const fingerprint = createHash('sha256').update(`${req.method} ${req.baseUrl}${req.path}\n${JSON.stringify(req.body ?? null)}`).digest('hex');
  try {
    for (let attempt = 0; ; attempt++) {
      try {
        await prisma.idempotencyKey.create({ data: { key, userId, fingerprint } });
        break;
      } catch (e) {
        if ((e as { code?: string }).code !== 'P2002') throw e;
        const hit = await prisma.idempotencyKey.findUnique({ where });
        if (!hit) continue; // freed between create and read
        if (hit.fingerprint !== fingerprint) return next(unprocessable('IDEMPOTENCY_KEY_REUSED', 'This idempotency key was already used for a different request'));
        if (hit.status) return void (hit.body === null ? res.status(hit.status).end() : res.status(hit.status).json(hit.body));
        if (attempt === 0 && Date.now() - hit.createdAt.getTime() > STUCK_AFTER_MS) {
          await prisma.idempotencyKey.deleteMany({ where: { key, userId, status: null } });
          continue;
        }
        return void res.status(503).set('retry-after', '1').json({ title: 'IN_PROGRESS', status: 503, code: 'IN_PROGRESS' }); // first attempt still running: the queue retries
      }
    }
  } catch (e) {
    return next(e);
  }
  let sent: unknown = null;
  const json = res.json.bind(res);
  res.json = (b) => ((sent = b), json(b));
  res.on('finish', () => {
    (res.statusCode >= 400
      ? prisma.idempotencyKey.delete({ where })
      : prisma.idempotencyKey.update({ where, data: { status: res.statusCode, body: sent ?? Prisma.JsonNull } })
    ).catch((e) => logger.error(e, 'idempotency key not finalised')); // left unanswered: reclaimed after STUCK_AFTER_MS
  });
  next();
};

export const pruneIdempotencyKeys = async () => (await prisma.idempotencyKey.deleteMany({ where: { createdAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } })).count;
