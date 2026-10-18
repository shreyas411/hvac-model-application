import { PDFDocument, rgb, StandardFonts, type PDFFont } from 'pdf-lib';
import type { LineItem } from '../types.js';
import { round2 } from './money.js';

export interface DocumentPdf {
  company: { name: string; tradingName: string; vatNumber: string };
  title: string; number: string; issueDate: string; secondDate: { label: string; value: string };
  customerName: string; items: LineItem[];
  subtotal: number; vatRatePercent: number; vatAmount: number; total: number;
  /** Extra totals rows (CIS, retention, reverse-charge note) shown under Total. */
  extra?: [string, string][];
  footer: string[];
}

const A4: [number, number] = [595.28, 841.89];
// pdf-lib's standard fonts only encode WinAnsi: replace anything else so one odd character can't fail the whole document.
const safe = (s: string) => s.replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

/** Greedy word wrap to `max` points. */
function wrap(text: string, font: PDFFont, size: number, max: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of safe(text).split(/\s+/)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > max) { lines.push(line); line = word; } else line = next;
  }
  return [...lines, line];
}

/** Shared by invoice and quotation PDFs: header, bill-to, line-item table (wrapped, paged), totals, footer. */
export async function renderDocument(d: DocumentPdf) {
  const pdf = await PDFDocument.create();
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const reg = await pdf.embedFont(StandardFonts.Helvetica);
  let page = pdf.addPage(A4);
  const [w, h] = A4;
  const text = (t: string, x: number, y: number, size = 10, font = reg) => page.drawText(safe(t), { x, y, size, font });
  const money = (n: number) => `\xa3${round2(n).toFixed(2)}`;
  const right = (t: string, x: number, y: number, size = 10, font = reg) => text(t, x - font.widthOfTextAtSize(safe(t), size), y, size, font);

  let y = h - 50;
  text(d.company.name, 50, y, 20, bold);
  page.drawText(d.title.toUpperCase(), { x: w - 50 - bold.widthOfTextAtSize(d.title.toUpperCase(), 22), y, size: 22, font: bold, color: rgb(0.2, 0.5, 0.8) });
  y -= 18; text(d.company.tradingName, 50, y);
  y -= 14; text(`VAT Reg: ${d.company.vatNumber}`, 50, y);
  y -= 36; text(`${d.title} #: ${d.number}`, 50, y, 12, bold);
  right(`Date: ${d.issueDate}`, w - 50, y); y -= 15;
  right(`${d.secondDate.label}: ${d.secondDate.value}`, w - 50, y);
  y -= 22; text('Bill To:', 50, y, 11, bold);
  y -= 15; text(d.customerName, 50, y);
  y -= 34;

  const col = { desc: 50, qty: 330, price: 440, total: w - 50 };
  const header = () => {
    page.drawRectangle({ x: 50, y: y - 5, width: w - 100, height: 20, color: rgb(0.9, 0.9, 0.9) });
    text('Description', col.desc + 4, y, 10, bold); right('Qty', col.qty + 30, y, 10, bold);
    right('Price', col.price + 20, y, 10, bold); right('Total', col.total - 4, y, 10, bold);
    y -= 24;
  };
  header();
  for (const it of d.items) {
    const lines = wrap(it.description, reg, 10, 260);
    if (y - lines.length * 13 < 130) { page = pdf.addPage(A4); y = h - 50; header(); }
    lines.forEach((l, i) => text(l, col.desc + 4, y - i * 13));
    right(String(it.quantity), col.qty + 30, y); right(money(it.unitPrice), col.price + 20, y); right(money(it.amount), col.total - 4, y);
    y -= lines.length * 13 + 6;
  }

  if (y < 150) { page = pdf.addPage(A4); y = h - 50; }
  y -= 8; page.drawLine({ start: { x: 330, y }, end: { x: w - 50, y }, thickness: 1 });
  y -= 18; text('Subtotal', 330, y); right(money(d.subtotal), w - 54, y);
  y -= 15; text(`VAT (${d.vatRatePercent}%)`, 330, y); right(money(d.vatAmount), w - 54, y);
  y -= 20; text('Total', 330, y, 12, bold); right(money(d.total), w - 54, y, 12, bold);
  for (const [label, value] of d.extra ?? []) { y -= 15; text(label, 330, y, 9); if (value) right(value, w - 54, y, 9); }

  let fy = 30 + (d.footer.length - 1) * 12;
  for (const l of d.footer) { text(l, 50, fy, 9); fy -= 12; }
  return pdf.save();
}
