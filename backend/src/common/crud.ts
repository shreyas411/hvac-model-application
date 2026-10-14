import { Router } from 'express';
import type { ZodTypeAny } from 'zod';
import type { UserRole } from '../types.js';
import { allow } from './auth.js';
import { h } from './errors.js';
import { paginate } from './paginate.js';
import { must, type Repo } from './store.js';

interface Opts<T extends { id: string }> {
  repo: Repo<T>;
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
  r.get('/', allow(...o.read), h((req) => paginate(o.filter ? o.filter(o.repo.all(), req.query) : o.repo.all(), req.query)));
  r.get('/:id', allow(...o.read), h((req) => must(o.repo, req.params.id, o.label)));
  r.post('/', allow(...o.write), h((req) => {
    const data = o.create.parse(req.body);
    return o.repo.insert(o.beforeCreate ? o.beforeCreate(data, req) : data);
  }, 201));
  r.patch('/:id', allow(...o.write), h((req) => {
    const cur = must(o.repo, req.params.id, o.label);
    const data = o.update.parse(req.body);
    return o.repo.update(cur.id, o.beforeUpdate ? o.beforeUpdate(cur, data) : data);
  }));
  if (o.del) r.delete('/:id', allow(...o.write), h((req) => { must(o.repo, req.params.id, o.label); o.repo.remove(req.params.id); }));
  return r;
}
