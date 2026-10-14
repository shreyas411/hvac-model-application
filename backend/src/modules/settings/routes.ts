import { Router } from 'express';
import { z } from 'zod';
import { allow } from '../../common/auth.js';
import { h } from '../../common/errors.js';
import { getSettings, updateSettings } from './service.js';

export const settingsSchema = z.object({
  companyName: z.string(), tradingName: z.string(), gasSafeRegisterNo: z.string(), fGasCertNo: z.string(),
  vatNumber: z.string(), companyNumber: z.string(), email: z.string(), phone: z.string(),
  addressLine1: z.string(), city: z.string(), postcode: z.string(), website: z.string(),
  currencySymbol: z.string(), defaultVatRate: z.number().min(0).max(100),
  availableVatRates: z.array(z.number().min(0).max(100)),
  workingHoursStart: z.string(), workingHoursEnd: z.string(), enableInventory: z.boolean(),
  prefixJob: z.string(), prefixQuote: z.string(), prefixInvoice: z.string(),
  bankDetails: z.object({
    bankName: z.string(), accountName: z.string(), sortCode: z.string(), accountNumber: z.string(), iban: z.string().optional(),
  }),
  termsAndConditions: z.string(),
}).partial();

export const settingsRouter = Router();
settingsRouter.get('/', h(getSettings));
settingsRouter.patch('/', allow('admin'), h((req) => updateSettings(settingsSchema.parse(req.body))));
