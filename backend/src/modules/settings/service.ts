import type { Prisma } from '@prisma/client';
import type { CompanySettings } from '../../types.js';
import { currentCompany, plain, prisma } from '../../common/prisma.js';

// One row per company, created with the company.
const toSettings = ({ companyId, updatedAt, availableVatRates, ...s }: Prisma.CompanySettingsGetPayload<object>) =>
  ({ ...plain(s), availableVatRates: availableVatRates.map(Number) }) as unknown as CompanySettings;

export const getSettings = async (db: Pick<typeof prisma, 'companySettings'> = prisma) => toSettings(await db.companySettings.findUniqueOrThrow({ where: { companyId: currentCompany() } }));

export const settingsUpdateOp = (patch: Partial<CompanySettings>) => prisma.companySettings.update({ where: { companyId: currentCompany() }, data: patch });
export const updateSettings = async (patch: Partial<CompanySettings>) => toSettings(await settingsUpdateOp(patch));
