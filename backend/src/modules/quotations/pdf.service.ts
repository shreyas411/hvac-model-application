import { renderDocument } from '../../common/documentPdf.js';
import { totals } from '../../common/money.js';
import { getQuotation } from './service.js';
import { getSettings } from '../settings/service.js';
import { getCustomer } from '../customers/service.js';

export async function generateQuotationPdf(quotationId: string) {
  const [q, s] = [await getQuotation(quotationId), await getSettings()];
  const shared = q.items.filter((i) => !i.option);
  const tiers = [...new Set(q.items.flatMap((i) => (i.option ? [i.option] : [])))];
  const options: [string, string][] = tiers.length
    ? [['Total above = cheapest option.', ''], ['Price per option (inc. VAT):', ''], ...tiers.map((t): [string, string] => [t, `£${totals([...shared, ...q.items.filter((i) => i.option === t)], q.vatRatePercent).total.toFixed(2)}`])]
    : [];
  return renderDocument({
    company: { name: s.companyName, tradingName: s.tradingName, vatNumber: s.vatNumber },
    title: 'Quotation', number: q.quoteNumber, issueDate: q.issueDate, secondDate: { label: 'Valid until', value: q.expiryDate },
    customerName: (await getCustomer(q.customerId)).name, items: q.items.map((i) => (i.option ? { ...i, description: `[${i.option}] ${i.description}` } : i)),
    subtotal: q.subtotal, vatRatePercent: q.vatRatePercent, vatAmount: q.vatAmount, total: q.total,
    extra: options,
    footer: q.terms ? [q.terms.slice(0, 110)] : [],
  });
}
