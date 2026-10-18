import { PDFDocument, rgb, StandardFonts, type PDFFont, type PDFPage } from 'pdf-lib';
import { getCertificate } from './service.js';
import { getSettings } from '../settings/service.js';
import { getCustomer } from '../customers/service.js';

const TITLES = { cp12: 'Landlord Gas Safety Record', service_record: 'Gas Appliance Service Record', commissioning: 'Gas Commissioning Record' } as const;
const SUBTITLES = { cp12: 'CP12 - Gas Safety (Installation and Use) Regulations', service_record: 'Annual service and safety check', commissioning: 'New installation commissioning' } as const;
const yn = (b: boolean) => (b ? 'Yes' : 'No');
const CHECK = { pass: 'Pass', fail: 'FAIL', na: 'N/A' } as Record<string, string>;
const BLUE = rgb(0.12, 0.31, 0.55), GREY = rgb(0.92, 0.94, 0.96), RED = rgb(0.75, 0.1, 0.1);
const W = 595.28, H = 841.89, M = 40;

// pdf-lib's standard fonts only encode WinAnsi.
const safe = (s: unknown) => String(s ?? '').replace(/[^\x20-\x7e\xa0-\xff]/g, '?');

export async function generateCertificatePdf(id: string) {
  const [c, s] = [await getCertificate(id), await getSettings()];
  const customer = await getCustomer(c.customerId);
  const site = customer.serviceLocations.find((l: any) => l.id === c.locationId);
  const pdf = await PDFDocument.create();
  const [bold, reg] = [await pdf.embedFont(StandardFonts.HelveticaBold), await pdf.embedFont(StandardFonts.Helvetica)];
  let page: PDFPage = pdf.addPage([W, H]);
  let y = H - M;

  const newPage = () => { page = pdf.addPage([W, H]); y = H - M; };
  const need = (h: number) => { if (y - h < 70) newPage(); };
  const text = (t: unknown, x: number, size = 9, font: PDFFont = reg, color = rgb(0.1, 0.1, 0.1)) => page.drawText(safe(t), { x, y, size, font, color });
  const wrap = (t: unknown, width: number, size = 9, font = reg) => {
    const out: string[] = []; let line = '';
    for (const word of safe(t).split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(next, size) > width) { out.push(line); line = word; } else line = next;
    }
    return [...out, line];
  };
  const section = (title: string) => {
    need(40); y -= 8;
    page.drawRectangle({ x: M, y: y - 4, width: W - 2 * M, height: 16, color: GREY });
    text(title.toUpperCase(), M + 6, 9, bold, BLUE); y -= 20;
  };
  const para = (label: string, value: unknown) => {
    const rows = wrap(value || 'None', W - 2 * M - 110);
    need(rows.length * 12 + 4);
    text(label, M + 6, 9, bold);
    rows.forEach((r) => { text(r, M + 110); y -= 12; });
  };
  const pairs = (all: [string, unknown][]) => {
    const items = all.filter(([, v]) => v !== '' && v != null);
    need(14 * Math.ceil(items.length / 2));
    items.forEach(([k, v], i) => {
      const x = M + 6 + (i % 2) * ((W - 2 * M) / 2);
      text(`${k}: `, x, 9, bold); text(v, x + bold.widthOfTextAtSize(`${safe(k)}: `, 9));
      if (i % 2) y -= 14;
    });
    if (items.length % 2) y -= 14;
  };

  // Header band
  page.drawRectangle({ x: 0, y: H - 90, width: W, height: 90, color: BLUE });
  page.drawText(safe(TITLES[c.type as keyof typeof TITLES]), { x: M, y: H - 42, size: 20, font: bold, color: rgb(1, 1, 1) });
  page.drawText(safe(SUBTITLES[c.type as keyof typeof SUBTITLES]), { x: M, y: H - 60, size: 9, font: reg, color: rgb(0.85, 0.9, 1) });
  const num = `No. ${c.certNumber}`;
  page.drawText(num, { x: W - M - bold.widthOfTextAtSize(num, 12), y: H - 42, size: 12, font: bold, color: rgb(1, 1, 1) });
  page.drawText(safe(`Issued ${c.issueDate}`), { x: W - M - reg.widthOfTextAtSize(safe(`Issued ${c.issueDate}`), 9), y: H - 60, size: 9, font: reg, color: rgb(0.85, 0.9, 1) });
  y = H - 110;

  section('Contractor');
  pairs([['Company', s.companyName], ['Trading as', s.tradingName], ['Gas Safe register no.', s.gasSafeRegisterNo], ['Phone', s.phone], ['Address', [s.addressLine1, s.city, s.postcode].filter(Boolean).join(', ')], ['Email', s.email]]);

  section('Customer and site');
  pairs([['Customer', customer.name], ['Phone', customer.phone], ['Site', site ? `${site.label}` : ''],
    ['Address', site ? [site.addressLine1, site.addressLine2, site.city, site.postcode].filter(Boolean).join(', ') : '']]);

  const d = c.data;
  if (c.type === 'cp12') {
    section('Appliances inspected');
    const cols = [['Appliance', 140], ['Flue', 55], ['Ventilation', 65], ['Safety dev.', 65], ['Tightness', 60], ['Safe to use', 60]] as const;
    const head = () => {
      let x = M + 4; need(30);
      cols.forEach(([n, w]) => { text(n, x, 8, bold, BLUE); x += w; });
      y -= 5; page.drawLine({ start: { x: M, y }, end: { x: W - M, y }, thickness: 0.5, color: BLUE }); y -= 11;
    };
    head();
    for (const a of d.appliances) {
      const name = wrap(`${a.description}${a.location ? ` (${a.location})` : ''}${a.make ? ` - ${a.make} ${a.model ?? ''}` : ''}`, 134, 8);
      if (y - name.length * 10 < 70) { newPage(); head(); }
      let x = M + 4;
      name.forEach((n, i) => page.drawText(n, { x, y: y - i * 10, size: 8, font: reg }));
      x += 140;
      [a.flueOperation, a.ventilation, a.safetyDevice, a.gasTightness].forEach((v, i) => {
        page.drawText(CHECK[v] ?? v, { x, y, size: 8, font: v === 'fail' ? bold : reg, color: v === 'fail' ? RED : rgb(0.1, 0.1, 0.1) }); x += cols[i + 1][1];
      });
      page.drawText(yn(a.safeToUse), { x, y, size: 8, font: a.safeToUse ? reg : bold, color: a.safeToUse ? rgb(0.1, 0.1, 0.1) : RED });
      y -= name.length * 10 + 5;
    }
    section('Defects and notices');
    para('Defects', d.defects);
    para('Warning notice', yn(d.warningNoticeIssued));
    if (c.expiryDate) para('Next inspection due', c.expiryDate);
  } else if (c.type === 'service_record') {
    section('Work carried out');
    para('Work', d.workCarried);
    if (d.checks.length) { section('Checks'); d.checks.forEach((k: any) => { need(13); text(`${k.ok ? '[x]' : '[ ]'}  ${k.item}`, M + 6); y -= 13; }); }
    if (d.notes) { section('Notes'); para('Notes', d.notes); }
  } else {
    section('Appliance');
    pairs([['Make', d.applianceMake], ['Model', d.applianceModel], ['Serial no.', d.serialNumber]]);
    section('Commissioning readings');
    pairs([['Inlet pressure', `${d.inletPressureMbar} mbar`], ['Burner pressure', `${d.burnerPressureMbar} mbar`], ['CO', `${d.coPpm} ppm`], ['CO2', `${d.co2Percent}%`], ['Flue test passed', yn(d.flueTestPassed)]]);
    if (d.notes) { section('Notes'); para('Notes', d.notes); }
  }

  section('Engineer');
  pairs([['Name', c.engineerName], ['Gas Safe ID', c.gasSafeNumber], ['Date', c.issueDate]]);
  need(50); y -= 24;
  page.drawLine({ start: { x: M + 6, y }, end: { x: M + 200, y }, thickness: 0.5 });
  page.drawLine({ start: { x: W / 2 + 6, y }, end: { x: W / 2 + 200, y }, thickness: 0.5 });
  y -= 11; text('Engineer signature', M + 6, 8); text('Customer / tenant signature', W / 2 + 6, 8);

  // Footer on every page
  pdf.getPages().forEach((p, i, all) => p.drawText(safe(`${c.certNumber} - page ${i + 1} of ${all.length}`), { x: M, y: 28, size: 8, font: reg, color: rgb(0.45, 0.45, 0.45) }));
  return pdf.save();
}
