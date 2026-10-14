import { Router } from 'express';
import type { ZodTypeAny } from 'zod';
import type { UserRole } from '../types.js';
import { allow } from './auth.js';
import { h, notFound } from './errors.js';
import { paginate } from './paginate.js';

/** Store behind a crud() router (sync or async). */
interface Store<T> {
  all(): T[] | Promise<T[]>;
  find(id: string): T | undefined | Promise<T | undefined>;
  insert(row: any): T | Promise<T>;
  update(id: string, patch: any): T | Promise<T>;
  remove(id: string): unknown;
}

interface Opts<T extends { id: string }> {
  repo: Store<T>;
  label: string;
  read: UserRole[];
  write: UserRole[];
  create: ZodTypeAny;
  update: ZodTypeAny;
  /** Extra list filtering (e.g. lowStock). */
  filter?: (rows: T[], query: any) => T[];
  /** Validate references / derive fields before insert. */
  beforeCreate?: (data: any, req: import('express').Request) => any;
  beforeUpdate?: (current: T, data: any) => any;
  del?: boolean;
}

/** Plain list/get/create/patch(/delete) router. Modules with real rules add routes before mounting this. */
export function crud<T extends { id: string }>(o: Opts<T>) {
  const r = Router();
  const must = async (id: string) => (await o.repo.find(id)) ?? Promise.reject(notFound(o.label));
  r.get('/', allow(...o.read), h(async (req) => paginate(o.filter ? o.filter(await o.repo.all(), req.query) : await o.repo.all(), req.query)));
  r.get('/:id', allow(...o.read), h((req) => must(req.params.id)));
  r.post('/', allow(...o.write), h((req) => {
    const data = o.create.parse(req.body);
    return o.repo.insert(o.beforeCreate ? o.beforeCreate(data, req) : data);
  }, 201));
  r.patch('/:id', allow(...o.write), h(async (req) => {
    const cur = await must(req.params.id);
    const data = o.update.parse(req.body);
    return o.repo.update(cur.id, o.beforeUpdate ? o.beforeUpdate(cur, data) : data);
  }));
  if (o.del) r.delete('/:id', allow(...o.write), h(async (req) => { await must(req.params.id); await o.repo.remove(req.params.id); }));
  return r;
}
