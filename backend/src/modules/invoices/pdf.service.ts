import { renderDocument } from '../../common/documentPdf.js';
import { getInvoice } from './service.js';
import { getSettings } from '../settings/service.js';
import { getCustomer } from '../customers/service.js';

export async function generateInvoicePdf(invoiceId: string) {
  const [inv, s] = [await getInvoice(invoiceId), await getSettings()];
  const bank = s.bankDetails;
  const customer = await getCustomer(inv.customerId);
  return renderDocument({
    company: { name: s.companyName, tradingName: s.tradingName, vatNumber: s.vatNumber },
    title: 'Invoice', number: inv.invoiceNumber, issueDate: inv.issueDate, secondDate: { label: 'Due Date', value: inv.dueDate },
    customerName: customer.name, items: inv.items,
    subtotal: inv.subtotal, vatRatePercent: inv.vatRatePercent, vatAmount: inv.vatAmount, total: inv.total,
    extra: [
      ...(inv.reverseCharge ? [['Domestic reverse charge: customer to account for VAT', ''] as [string, string]] : []),
      ...(inv.cisDeduction ? [[`Less CIS deduction (${inv.cisRatePercent}% of labour)`, `-${inv.cisDeduction.toFixed(2)}`] as [string, string]] : []),
      ...(inv.retentionHeld ? [[`Less retention held (${inv.retentionPercent}%)`, `-${inv.retentionHeld.toFixed(2)}`] as [string, string]] : []),
    ],
    footer: [...(customer.type === 'commercial' ? ['Late payment by a business may incur statutory interest and costs (Late Payment of Commercial Debts (Interest) Act 1998).'] : []), 'Payment details', `Account: ${bank.accountName} | Sort Code: ${bank.sortCode} | Acc No: ${bank.accountNumber}`],
  });
}
