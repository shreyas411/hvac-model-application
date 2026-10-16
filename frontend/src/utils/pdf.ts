/** Saves a modal's `[data-pdf-sheet]` (the same markup shown on screen) as an A4 PDF. */
export async function downloadSheet(from: HTMLElement, filename: string) {
  const sheet = from.closest('.fixed')?.querySelector<HTMLElement>('[data-pdf-sheet]');
  if (!sheet) return;
  // html2canvas-pro (not html2canvas): Tailwind v4 colours are oklch(), which the original can't parse.
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([import('html2canvas-pro'), import('jspdf')]);
  // The live sheet is clipped by the modal (flex + max-h + overflow); capture an unclipped offscreen copy instead.
  const copy = sheet.cloneNode(true) as HTMLElement;
  Object.assign(copy.style, { position: 'fixed', left: '-10000px', top: '0', width: `${sheet.offsetWidth}px`, height: 'auto', maxHeight: 'none', overflow: 'visible' });
  document.body.appendChild(copy);
  const canvas = await html2canvas(copy, { scale: 3, backgroundColor: '#fff' }).finally(() => copy.remove());
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const [w, h] = [pdf.internal.pageSize.getWidth(), pdf.internal.pageSize.getHeight()];
  const imgH = (canvas.height * w) / canvas.width;
  const img = canvas.toDataURL('image/png');
  // ponytail: slices the image at page height, so a row can split across pages; add row-aware breaks if that matters
  for (let y = 0; y < imgH; y += h) {
    if (y) pdf.addPage();
    pdf.addImage(img, 'PNG', 0, -y, w, imgH);
  }
  pdf.save(filename);
}
