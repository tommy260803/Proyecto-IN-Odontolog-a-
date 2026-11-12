import { randomUUID } from 'node:crypto';
import type { CanvaAutofillResult } from './canvaService';
import { TransferError } from './leadPayerTransfer';

const attachments = new Map<string, { fingerprint: string; url: string; expiresAt: number }>();

export function registerLeadFlyer(fingerprint: string, validUntil: Date, flyer: CanvaAutofillResult) {
  const url = flyer.downloadPngUrl && URL.parse(flyer.downloadPngUrl);
  const now = Date.now();
  const expiresAt = Math.min(validUntil.getTime(), now + 30 * 60_000);
  if (flyer.source !== 'canva_autofill' || flyer.status !== 'completed' ||
      !url || url.protocol !== 'https:' || url.username || url.password || expiresAt <= now) return;

  for (const [id, attachment] of attachments) {
    if (attachment.expiresAt <= now) attachments.delete(id);
  }
  if (attachments.size >= 256) attachments.delete(attachments.keys().next().value!);

  const id = randomUUID();
  attachments.set(id, { fingerprint, url: url.href, expiresAt });
  return id;
}

export function resolveLeadFlyer(id: unknown, fingerprint: string) {
  if (id === undefined) return;
  const attachment = typeof id === 'string' ? attachments.get(id) : undefined;
  if (!attachment || attachment.fingerprint !== fingerprint || attachment.expiresAt <= Date.now()) {
    throw new TransferError('El flyer ya no está disponible para esta propuesta. Vuelve a generarlo o desmarca el adjunto.', 409);
  }
  return attachment.url;
}
