import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { getInvoice } from './service.js';
import { getSettings } from '../settings/service.js';
import { getCustomer } from '../customers/service.js';
import { round2 } from '../../common/money.js';

export async function generateInvoicePdf(invoiceId: string): Promise<Uint8Array> {
  const invoice = await getInvoice(invoiceId);
  const settings = await getSettings();
  const pdfDoc = await PDFDocument.create();
  let page = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page.getSize();
  
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontReg = await pdfDoc.embedFont(StandardFonts.Helvetica);

  let cursorY = height - 50;

  // --- Header ---
  page.drawText(settings.companyName, { x: 50, y: cursorY, size: 20, font: fontBold, color: rgb(0, 0, 0) });
  cursorY -= 20;
  page.drawText(settings.tradingName, { x: 50, y: cursorY, size: 10, font: fontReg });
  cursorY -= 15;
  page.drawText(`VAT Reg: ${settings.vatNumber}`, { x: 50, y: cursorY, size: 10, font: fontReg });
  
  page.drawText('INVOICE', { x: width - 100, y: height - 50, size: 24, font: fontBold, color: rgb(0.2, 0.5, 0.8) });
  cursorY -= 40;

  // --- Invoice Details ---
  page.drawText(`Invoice #: ${invoice.invoiceNumber}`, { x: 50, y: cursorY, size: 12, font: fontBold });
  page.drawText(`Date: ${invoice.issueDate}`, { x: width - 150, y: cursorY, size: 10, font: fontReg });
  cursorY -= 20;
  page.drawText(`Due Date: ${invoice.dueDate}`, { x: width - 150, y: cursorY, size: 10, font: fontReg });
  cursorY -= 30;

  // --- Bill To ---
  page.drawText('Bill To:', { x: 50, y: cursorY, size: 12, font: fontBold });
  cursorY -= 15;
  // Invoice includes customer details via relation in service, we assume invoice object passed here is enriched
  // For this implementation, we'll use the basic fields available on the invoice model or fetch them.
  page.drawText((await getCustomer(invoice.customerId)).name, { x: 50, y: cursorY, size: 10, font: fontReg });
  cursorY -= 40;

  // --- Table Header ---
  const colX = [50, 300, 400, 500];
  page.drawRectangle({ x: 50, y: cursorY - 5, width: width - 100, height: 20, color: rgb(0.9, 0.9, 0.9) });
  page.drawText('Description', { x: colX[0], y: cursorY, size: 10, font: fontBold });
  page.drawText('Qty', { x: colX[1], y: cursorY, size: 10, font: fontBold });
  page.drawText('Price', { x: colX[2], y: cursorY, size: 10, font: fontBold });
  page.drawText('Total', { x: colX[3], y: cursorY, size: 10, font: fontBold });
  cursorY -= 25;

  // --- Items ---
  // Assuming invoice.items is available
  const items = (invoice as any).items || [];
  for (const item of items) {
    if (cursorY < 100) {
      page = pdfDoc.addPage([595.28, 841.89]);
      cursorY = height - 50;
    }
    page.drawText(item.description.substring(0, 35), { x: colX[0], y: cursorY, size: 10, font: fontReg });
    page.drawText(item.quantity.toString(), { x: colX[1], y: cursorY, size: 10, font: fontReg });
    page.drawText(`£${round2(item.unitPrice)}`, { x: colX[2], y: cursorY, size: 10, font: fontReg });
    page.drawText(`£${round2(item.amount)}`, { x: colX[3], y: cursorY, size: 10, font: fontReg });
    cursorY -= 20;
  }

  cursorY -= 20;
  const lineY = cursorY;
  page.drawLine({ start: { x: 50, y: lineY }, end: { x: width - 50, y: lineY }, thickness: 1 });
  cursorY -= 20;

  // --- Totals ---
  page.drawText('Subtotal:', { x: width - 150, y: cursorY, size: 10, font: fontReg });
  page.drawText(`£${round2(invoice.subtotal)}`, { x: width - 80, y: cursorY, size: 10, font: fontReg });
  cursorY -= 15;
  page.drawText(`VAT (${invoice.vatRatePercent}%):`, { x: width - 150, y: cursorY, size: 10, font: fontReg });
  page.drawText(`£${round2(invoice.vatAmount)}`, { x: width - 80, y: cursorY, size: 10, font: fontReg });
  cursorY -= 20;
  page.drawText('Total Amount:', { x: width - 150, y: cursorY, size: 12, font: fontBold });
  page.drawText(`£${round2(invoice.total)}`, { x: width - 80, y: cursorY, size: 12, font: fontBold });

  // --- Footer ---
  cursorY = 50;
  page.drawText('Payment Details:', { x: 50, y: cursorY, size: 10, font: fontBold });
  cursorY -= 15;
  const bank = settings.bankDetails as any;
  page.drawText(`Account: ${bank.accountName} | Sort Code: ${bank.sortCode} | Acc No: ${bank.accountNumber}`, { x: 50, y: cursorY, size: 9, font: fontReg });

  return await pdfDoc.save();
}
