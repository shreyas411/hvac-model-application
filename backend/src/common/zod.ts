import { z } from 'zod';

export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'YYYY-MM-DD');
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'HH:MM');
// Royal Mail format: outward code (A9, A99, AA9, AA99, A9A, AA9A) + inward code (9AA, no C I K M O V). Stored as "LS1 4AB".
const UK_POSTCODE = /^(GIR 0AA|[A-PR-UWYZ]([0-9]{1,2}|[A-HK-Y][0-9]([0-9]|[ABEHMNPRV-Y])?|[0-9][A-HJKPSTUW]) [0-9][ABD-HJLNP-UW-Z]{2})$/;
export const ukPostcode = z.string().trim().toUpperCase()
  .transform((v) => v.replace(/\s+/g, '').replace(/^(.+)(.{3})$/, '$1 $2'))
  .refine((v) => UK_POSTCODE.test(v), 'Enter a valid UK postcode, e.g. LS1 4AB');
export const priority = z.enum(['low', 'medium', 'high', 'emergency']);
export const money = z.number().finite().nonnegative();

export const lineItems = z.array(z.object({
  type: z.enum(['labour', 'part', 'equipment', 'travel', 'discount', 'fee']),
  description: z.string().min(1),
  quantity: z.number().finite().positive(),
  unitPrice: z.number().finite(), // discounts are negative
  vatRatePercent: z.number().min(0).max(100).optional(), // overrides the document's VAT rate for this line
}));

/** PATCH schema: `.partial()`, but keys absent from the body stay absent (zod 4 applies `.default()` inside `.partial()`, which would reset stored fields). */
export const patch = <S extends z.ZodObject>(s: S) => z.unknown().transform((body) => {
  const out: Record<string, unknown> = s.partial().parse(body);
  for (const k of Object.keys(out)) if (!(k in (body as object))) delete out[k];
  return out as Partial<z.output<S>>;
});
