import type { RequestHandler } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { crud } from '../../common/crud.js';
import { plain, prisma, prismaRepo } from '../../common/prisma.js';
import { h, unprocessable } from '../../common/errors.js';
import type { CustomFieldDefinition, CustomFieldEntity, CustomFieldValues } from '../../types.js';

const ENTITIES = ['customer', 'equipment', 'request', 'job', 'quotation', 'invoice', 'part', 'maintenance'] as const;

/** Request-body field for every module that carries custom fields; the values are cleaned by withCustomFields(). */
export const customFieldsInput = z.custom<CustomFieldValues>((v) => typeof v === 'object' && v !== null && !Array.isArray(v), 'Expected an object').optional();
const def = z.object({
  entity: z.enum(ENTITIES),
  label: z.string().trim().min(1),
  type: z.enum(['text', 'number', 'date', 'select', 'checkbox']),
  options: z.array(z.string().trim().min(1)).default([]),
  required: z.boolean().default(false),
}).refine((d) => d.type !== 'select' || d.options.length > 0, { message: 'A dropdown field needs at least one option', path: ['options'] });

const out = (r: object) => plain(r, ['createdAt', 'position']) as unknown as CustomFieldDefinition;
const base = prismaRepo<CustomFieldDefinition>(prisma.customFieldDefinition);

// Everyone reads (forms render from it); only admin edits. `entity` and `type` are fixed once created: stored values depend on them.
export const customFieldsRouter = crud<CustomFieldDefinition>({
  repo: {
    ...base,
    all: async () => (await prisma.customFieldDefinition.findMany({ orderBy: [{ position: 'asc' }, { createdAt: 'asc' }] })).map(out),
    insert: async (data: z.infer<typeof def>) => {
      const { _max } = await prisma.customFieldDefinition.aggregate({ where: { entity: data.entity }, _max: { position: true } });
      return out(await prisma.customFieldDefinition.create({ data: { ...data, position: (_max.position ?? 0) + 1 } }));
    },
    update: async (id: string, patch: object) => out(await prisma.customFieldDefinition.update({ where: { id }, data: patch })),
  },
  label: 'Custom field',
  read: ['admin', 'dispatcher', 'technician', 'accountant'],
  write: ['admin'],
  create: def,
  update: z.object({ label: z.string().trim().min(1), options: z.array(z.string().trim().min(1)), required: z.boolean(), inactive: z.boolean() }).partial().strict(),
  del: true,
});

/**
 * Checks `values` (definition id → value) against the company's active fields for `entity` and returns the cleaned object:
 * blank values are dropped, unknown ids / wrong types / values outside a dropdown's options are 422, required fields must be filled.
 */
export async function checkCustomFields(entity: CustomFieldEntity, values: Record<string, unknown> = {}) {
  const defs = await prisma.customFieldDefinition.findMany({ where: { entity, inactive: false } });
  const byId = new Map(defs.map((d) => [d.id, d]));
  const clean: Record<string, string | number | boolean> = {};
  for (const [id, v] of Object.entries(values)) {
    const d = byId.get(id);
    if (!d) continue; // inactive/deleted fields keep nothing new; ignore rather than fail old clients
    if (v === '' || v === null || v === undefined) continue;
    const ok = d.type === 'number' ? typeof v === 'number' && Number.isFinite(v)
      : d.type === 'checkbox' ? typeof v === 'boolean'
      : d.type === 'date' ? typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
      : d.type === 'select' ? typeof v === 'string' && d.options.includes(v)
      : typeof v === 'string';
    if (!ok) throw unprocessable('INVALID_CUSTOM_FIELD', `"${d.label}" has an invalid value`);
    clean[id] = v as string | number | boolean;
  }
  const missing = defs.find((d) => d.required && d.type !== 'checkbox' && !(d.id in clean));
  if (missing) throw unprocessable('CUSTOM_FIELD_REQUIRED', `"${missing.label}" is required`);
  return clean;
}

/**
 * Router middleware for a module: validates `customFields` on POST / (a missing object still enforces required fields) and PATCH /:id (only when sent).
 * Mount before the module's routes; the module's zod schema must list `customFieldsInput` or the cleaned values are stripped.
 */
export const withCustomFields = (entity: CustomFieldEntity): RequestHandler => (req, _res, next) => {
  const create = req.method === 'POST' && req.path === '/';
  const edit = req.method === 'PATCH' && /^\/[^/]+$/.test(req.path);
  if (!(create || (edit && req.body?.customFields !== undefined))) return next();
  checkCustomFields(entity, req.body?.customFields).then((v) => { req.body = { ...req.body, customFields: v }; next(); }, next);
};

// Body: ids in the desired order (one module's list); position = index.
customFieldsRouter.post('/reorder', allow('admin'), h(async (req) => {
  const { ids } = z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(req.body);
  await prisma.$transaction(ids.map((id, position) => prisma.customFieldDefinition.updateMany({ where: { id }, data: { position } })));
}, 204));
