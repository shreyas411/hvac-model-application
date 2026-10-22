import { inflateSync } from 'node:zlib';

const MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/**
 * A signature must be a real PNG of drawable size with at least one inked pixel: the pad draws on a transparent canvas,
 * so an empty or stub image (e.g. just the 8-byte header) is not evidence of sign-off.
 * ponytail: ink is only checked for PNGs with an alpha channel (what canvas.toDataURL gives); other colour types pass on size alone.
 */
export function isInkedPng(dataUrl: string): boolean {
  const b64 = dataUrl.match(/^data:image\/png;base64,([A-Za-z0-9+/=]+)$/)?.[1];
  if (!b64) return false;
  try {
    const png = Buffer.from(b64, 'base64');
    if (png.length < 33 || !png.subarray(0, 8).equals(MAGIC)) return false;
    let width = 0, height = 0, depth = 0, colour = -1;
    const data: Buffer[] = [];
    for (let at = 8; at + 8 <= png.length;) {
      const len = png.readUInt32BE(at), type = png.toString('latin1', at + 4, at + 8), body = png.subarray(at + 8, at + 8 + len);
      if (type === 'IHDR') { width = body.readUInt32BE(0); height = body.readUInt32BE(4); depth = body[8]; colour = body[9]; }
      if (type === 'IDAT') data.push(body);
      if (type === 'IEND') break;
      at += 12 + len;
    }
    if (width < 50 || height < 20 || !data.length) return false;
    if (depth !== 8 || (colour !== 6 && colour !== 4)) return true; // not the canvas format: size check only
    const raw = inflateSync(Buffer.concat(data)), stride = 1 + width * (colour === 6 ? 4 : 2);
    // Filters turn all-zero (transparent) rows into all-zero residuals, so any non-zero byte after a row's filter byte is ink.
    for (let i = 0; i < raw.length; i++) if (i % stride !== 0 && raw[i] !== 0) return true;
    return false;
  } catch {
    return false;
  }
}
