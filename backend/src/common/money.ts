/** Round half-up (away from zero) to 2dp; the epsilon absorbs float noise like 1.005. */
export const round2 = (n: number) => Math.sign(n) * Math.round((Math.abs(n) + 1e-9) * 100) / 100;

/** Lines may carry their own VAT rate (zero-rated or reduced-rate work); the rest use the document's default rate. */
export const totals = (lines: { amount: number; vatRatePercent?: number | null }[], defaultVatPercent: number) => {
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  const vatAmount = round2(lines.reduce((a, l) => a + l.amount * ((l.vatRatePercent ?? defaultVatPercent) / 100), 0));
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
};
