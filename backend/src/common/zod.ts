import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
export const priority = z.enum(['low', 'medium', 'high', 'emergency']);
export const money = z.number().finite().nonnegative();

export const lineItems = z.array(z.object({
  type: z.enum(['labour', 'part', 'equipment', 'travel', 'discount', 'fee']),
  description: z.string().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite(), // discounts are negative
}));
