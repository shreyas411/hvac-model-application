import { randomUUID } from 'node:crypto';
import { hashPassword } from '../common/auth.js';
import { unscoped } from '../common/prisma.js';

// npm run company:create -- <slug> "<Company name>" <admin email> <admin password> [supabase auth user id]
// With Supabase auth the admin must already exist in auth.users: pass its id (the password then lives in Supabase, not here).
const [slug, name, email, password, id] = process.argv.slice(2);
if (!slug || !name || !email || !password) throw new Error('usage: company:create <slug> "<name>" <admin email> <admin password> [auth user id]');
const company = await unscoped.company.create({ data: { slug: slug.toLowerCase(), name } });
await unscoped.companySettings.create({ data: { companyId: company.id, companyName: name, availableVatRates: [0, 5, 20] } });
await unscoped.user.create({ data: { id: id ?? randomUUID(), companyId: company.id, name: 'Admin', email, role: 'admin', password: id ? null : hashPassword(password) } });
console.log(`Created company "${company.slug}" with admin ${email}`);
await unscoped.$disconnect();
