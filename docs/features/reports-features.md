# Reports Features

The Reports view ("Reports & Business Insights") is a read-only dashboard that keeps three money figures separate (invoiced, collected, quoted pipeline), shows per-technician output, four operational ratios, and a CSV export of summary metrics. Everything is computed on render from `AppContext` data. Source: `frontend/src/components/reports/ReportsView.tsx`.

## Financial trio (`ReportsView.tsx:21-27`, `:95-131`)

| Card | Calculation |
|---|---|
| 1. Invoiced Revenue | sum of `invoice.total` over all invoices |
| 2. Recorded Payments (Collected) | sum of `invoice.amountPaid` over all invoices |
| 3. Estimated Pipeline (Quotes) | sum of `quotation.total` over all quotations; the caption also shows the sum for `status === 'accepted'` quotes |

No invoice or quote status filtering is applied to the first three totals (draft, cancelled, rejected etc. are all included).

## Technician utilisation table (`ReportsView.tsx:30-46`, `:134-176`)

One row per technician in `technicians`, matching jobs by `job.technicianId`:

| Column | Calculation |
|---|---|
| Engineer Name | name plus colour dot (`tech.color`) |
| Certification / Core Skills | first two entries of `skills`, joined by " · " |
| Assigned Jobs | count of the technician's jobs (any status) |
| Completed | jobs with `status === 'completed'` |
| Logged Hours | sum of `labourHours` (missing treated as 0), 1 decimal |
| Billable Labour Value | sum of `labourHours * (hourlyRate \|\| 85)` (85 is a hard-coded fallback rate) |

The header text "4 Active Engineers" is a hard-coded string, not derived from data.

## Operational ratios (`ReportsView.tsx:179-217`)

All rounded to whole percent; show "0%" when the denominator is 0.

| Ratio | Formula |
|---|---|
| Job Completion Rate | completed jobs / all jobs |
| Quote Conversion Rate | accepted quotes / all quotes |
| Invoice Collection Rate | recorded payments / invoiced revenue |
| Repeat Customer Ratio | customers with more than one job (by `customerId`) / all customers |

## CSV export (`ReportsView.tsx:49-69`)

"Export Summary (CSV)" builds a two-column Metric/Value table and downloads `ApexHVAC_Financial_Report_<timestamp>.csv` using a data URI and a temporary anchor. Rows: Invoiced Revenue, Recorded Payments, Outstanding Balance (invoiced minus payments), Estimated Pipeline, Accepted Quotes (all in GBP, 2 decimals, labelled with "(£)"), Total Completed Jobs, Total Open Jobs (not `completed` and not `cancelled`). Rows are joined with plain commas; no quoting or escaping.

## Roles and data

- Nav access: admin and accountant only (`Navbar.tsx:45`). The view has no internal role check.
- Reads from `AppContext`: `jobs`, `technicians`, `invoices`, `quotations`, `customers` (`parts` is destructured but unused). It calls no actions and writes nothing.

## Limitations

- The `dateRange` state (`this_month` / `last_month` / `all`) is declared but never used in the UI or calculations; all figures cover all time.
- No charts despite the "BarChart3"/"TrendingUp" imports; tables and cards only.
- Totals include every invoice/quote regardless of status; invoice "Invoiced Revenue" caption mentions "completed work" but this is not enforced.
- Hard-coded "4 Active Engineers" and 85 hourly fallback.
- Export covers only the eight summary metrics, not the technician table or ratios.
- Currency is fixed to GBP.

## Updates: VAT return

`GET /reports/vat?start&end` returns output VAT (box 1), input VAT on stock purchases (box 4) and net VAT for a period; see [billing-corrections-features.md](billing-corrections-features.md). The Reports screen itself does not yet show it.

## Updates: period filter, profitability, aged debtors

- The **This month / Last month / All time** selector now filters the numbers: jobs by appointment date, invoices by issue date, quotations by created date. The CSV export includes the period.
- "Active Engineers" shows the real technician count.
- **Job Profitability** table: completed jobs in the period with revenue (labour billed plus parts price), parts cost and margin. Labour cost is not tracked, so margin overstates true profit.
- **Aged Debtors**: unpaid balances on issued, overdue and part-paid invoices bucketed Current, 1-30, 31-60, 61-90 and 90+ days past due. Not affected by the period filter.
- All calculated in the browser from loaded data; no new API.
