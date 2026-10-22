export const today = () => new Date().toISOString().slice(0, 10);
/** Date-only value (Date or YYYY-MM-DD) is before today: the `expired` flag on quotes, certificates, warranties and licences. */
export const isPast = (d?: Date | string | null) => !!d && new Date(d) < new Date(today());
export const addDays = (date: string, days: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};
export const addMonths = (date: string, months: number) => {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
};
/** '2026-10-19' -> '19 Oct 2026' for customer-facing text. */
export const ukDate = (d: string | Date) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
export const toMinutes = (t: string) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
