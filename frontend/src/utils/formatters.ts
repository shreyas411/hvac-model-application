import type { JobStatus } from '../types';

export const formatGBP = (amount: number): string => {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
};

export const getTodayISO = (): string => {
  return new Date().toLocaleDateString('en-CA'); // local YYYY-MM-DD (toISOString is UTC: wrong day after midnight in BST)
};

/** Adds whole days to a YYYY-MM-DD date using local time (no UTC drift). */
export const addDaysISO = (iso: string, days: number): string => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d + days).toLocaleDateString('en-CA');
};

export const formatDateUK = (dateString: string): string => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(d);
};

export const formatDateTimeUK = (dateString: string): string => {
  if (!dateString) return '';
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return dateString;
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
};

export const formatTimeOnly = (timeString: string): string => {
  if (!timeString) return '';
  if (timeString.includes('T')) {
    const d = new Date(timeString);
    return new Intl.DateTimeFormat('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(d);
  }
  return timeString;
};

// Mirror of backend TRANSITIONS (jobs/service.ts); the API rejects anything else with 409 INVALID_TRANSITION.
const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  new: ['awaiting_approval', 'scheduled', 'cancelled'],
  awaiting_approval: ['new', 'scheduled', 'cancelled'],
  scheduled: ['new', 'dispatched', 'on_hold', 'cancelled'],
  dispatched: ['scheduled', 'in_progress', 'on_hold', 'cancelled'],
  in_progress: ['on_hold', 'completed', 'cancelled'],
  on_hold: ['scheduled', 'dispatched', 'in_progress', 'cancelled'],
  completed: [],
  cancelled: [],
};
export const canMoveJob = (from: JobStatus, to: JobStatus) => JOB_TRANSITIONS[from].includes(to);

/** Total (inc. VAT) of the shared lines plus each tier's lines, mirroring the server's pricing; empty when the quote has no tiers. */
export const tierPrices = (items: { amount: number; option?: string; vatRatePercent?: number }[], vatRate: number) => {
  const gross = (ls: typeof items) => ls.reduce((a, l) => a + l.amount * (1 + (l.vatRatePercent ?? vatRate) / 100), 0);
  const shared = items.filter((i) => !i.option);
  return [...new Set(items.flatMap((i) => (i.option ? [i.option] : [])))]
    .map((name) => ({ name, total: gross([...shared, ...items.filter((i) => i.option === name)]) }));
};
