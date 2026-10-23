const cell = (v: unknown) => {
  const s = String(v ?? '');
  return /^[=+\-@\t\r]/.test(s) ? `'${s}` : s; // stop spreadsheets running a customer-typed value as a formula
};

/** Saves `rows` (first row = headers) as a CSV file. */
export function downloadCsv(filename: string, rows: unknown[][]) {
  const text = rows.map((r) => r.map((v) => `"${cell(v).replace(/"/g, '""')}"`).join(',')).join('\r\n');
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob(['﻿' + text], { type: 'text/csv' })), download: filename });
  a.click();
  URL.revokeObjectURL(a.href);
}
