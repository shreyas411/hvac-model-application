import type { Actor } from '../../common/auth.js';
import { notFound, unprocessable } from '../../common/errors.js';
import { isUuid, prisma } from '../../common/prisma.js';

const MAX_BYTES = 600_000, MAX_PER_JOB = 30;

/** data URL → bytes. WebP only (the client compresses to it); checked from the RIFF....WEBP header, never from what the client claims. */
function decode(dataUrl: string) {
  const buf = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1), 'base64');
  if (buf.subarray(0, 4).toString('latin1') !== 'RIFF' || buf.subarray(8, 12).toString('latin1') !== 'WEBP') throw unprocessable('BAD_IMAGE', 'Only WebP photos are accepted');
  if (buf.length > MAX_BYTES) throw unprocessable('IMAGE_TOO_LARGE', 'Photo is larger than 600 KB: compress it first');
  return { buf, mime: 'image/webp' };
}

const meta = { id: true, jobId: true, caption: true, takenBy: true, createdAt: true, mime: true } as const;

export const listPhotos = (jobId: string) => prisma.jobPhoto.findMany({ where: { jobId }, select: meta, orderBy: { createdAt: 'asc' } });

export async function addPhoto(jobId: string, dataUrl: string, caption: string, who: Actor) {
  const { buf, mime } = decode(dataUrl);
  if ((await prisma.jobPhoto.count({ where: { jobId } })) >= MAX_PER_JOB) throw unprocessable('TOO_MANY_PHOTOS', `A job can hold ${MAX_PER_JOB} photos`);
  return prisma.jobPhoto.create({ data: { jobId, mime, data: buf, caption, takenBy: who.name }, select: meta });
}

export async function getPhoto(jobId: string, id: string) {
  const p = isUuid(id) ? await prisma.jobPhoto.findFirst({ where: { id, jobId } }) : null;
  if (!p) throw notFound('Photo');
  return p;
}

export async function removePhoto(jobId: string, id: string) {
  await getPhoto(jobId, id);
  await prisma.jobPhoto.delete({ where: { id } });
}
