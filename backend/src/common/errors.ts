import type { ErrorRequestHandler, Request, RequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}
export const notFound = (what: string) => new ApiError(404, 'NOT_FOUND', `${what} not found`);
export const conflict = (code: string, msg: string) => new ApiError(409, code, msg);
export const unprocessable = (code: string, msg: string) => new ApiError(422, code, msg);
export const forbidden = (msg = 'Forbidden') => new ApiError(403, 'FORBIDDEN', msg);

/** Wrap a (possibly async) handler: returns its value as JSON, forwards throws to the error handler. */
export const h =
  (fn: (req: Request) => unknown, status = 200): RequestHandler =>
  (req, res, next) =>
    Promise.resolve()
      .then(() => fn(req))
      .then((r) => (r === undefined ? res.sendStatus(204) : res.status(status).json(r)))
      .catch(next);

// Constraint violations that escape the service-level checks (races, bad foreign keys).
const PRISMA: Record<string, [number, string, string]> = {
  P2002: [409, 'DUPLICATE', 'A record with these unique values already exists'],
  P2023: [422, 'INVALID_ID', 'Malformed id'],
  P2003: [422, 'INVALID_REFERENCE', 'Referenced record does not exist or is still in use'],
  P2025: [404, 'NOT_FOUND', 'Record not found'],
};

// RFC 7807
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  let status = 500, code = 'INTERNAL', detail = 'Internal server error', extra = {};
  if (err instanceof ApiError) ({ status, code } = err), (detail = err.message);
  else if (err instanceof ZodError) (status = 400), (code = 'VALIDATION'), (detail = 'Invalid request'), (extra = { issues: err.issues });
  else if (err instanceof Prisma.PrismaClientKnownRequestError && PRISMA[err.code]) ([status, code] = PRISMA[err.code]), (detail = PRISMA[err.code][2]);
  else if (String(err?.message).includes('jobs_technician_no_overlap')) (status = 409), (code = 'SCHEDULE_CONFLICT'), (detail = 'Scheduling Conflict: technician already booked in that time');
  else if (err?.type === 'entity.too.large') (status = 413), (code = 'TOO_LARGE'), (detail = 'Request body too large');
  else if (err?.type === 'entity.parse.failed') (status = 400), (code = 'BAD_JSON'), (detail = 'Malformed JSON');
  else (req as any).log?.error(err);
  res.status(status).type('application/problem+json').json({ type: 'about:blank', title: code, status, code, detail, ...extra });
};
