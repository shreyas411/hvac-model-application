/** Round half-up (away from zero) to 2dp; the epsilon absorbs float noise like 1.005. */
export const round2 = (n: number) => Math.sign(n) * Math.round((Math.abs(n) + 1e-9) * 100) / 100;

export const totals = (amounts: number[], vatRatePercent: number) => {
  const subtotal = round2(amounts.reduce((a, b) => a + b, 0));
  const vatAmount = round2(subtotal * (vatRatePercent / 100));
  return { subtotal, vatAmount, total: round2(subtotal + vatAmount) };
};
