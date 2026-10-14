import type { Prisma } from '@prisma/client';
import type { CompanySettings } from '../../types.js';
import { plain, prisma } from '../../common/prisma.js';

// The single row (id = 1) is created by the migration.
const toSettings = ({ id, updatedAt, availableVatRates, ...s }: Prisma.CompanySettingsGetPayload<object>) =>
  ({ ...plain(s), availableVatRates: availableVatRates.map(Number) }) as unknown as CompanySettings;

export const getSettings = async () => toSettings(await prisma.companySettings.findUniqueOrThrow({ where: { id: 1 } }));

export const settingsUpdateOp = (patch: Partial<CompanySettings>) => prisma.companySettings.update({ where: { id: 1 }, data: patch });
export const updateSettings = async (patch: Partial<CompanySettings>) => toSettings(await settingsUpdateOp(patch));
