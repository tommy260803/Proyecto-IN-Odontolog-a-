import { randomUUID } from 'node:crypto';
import type { CanvaAutofillResult } from './canvaService';
import { TransferError } from './leadPayerTransfer';

const attachments = new Map<string, { fingerprint: string; url: string; expiresAt: number }>();
const canvaExportHost = 'export-download.canva.com';
// The base64 representation of a 16 MiB PNG fits in OpenWA's 25 MB JSON request limit.
const maxFlyerBytes = 16 * 1024 * 1024;
const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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

export async function downloadLeadFlyer(url: string): Promise<Buffer> {
  const signal = AbortSignal.timeout(12_000);
  let nextUrl = URL.parse(url);
  try {
    for (let redirect = 0; redirect <= 3; redirect++) {
      if (!nextUrl || nextUrl.origin !== `https://${canvaExportHost}` || nextUrl.username || nextUrl.password) {
        throw new TransferError('La dirección de descarga del flyer no corresponde a Canva. Vuelve a generar el adjunto.', 422);
      }
      const response = await fetch(nextUrl, { redirect: 'manual', signal });
      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get('location');
        await response.body?.cancel();
        nextUrl = location ? URL.parse(location, nextUrl) : null;
        continue;
      }
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new TransferError('Canva no entregó el archivo del flyer. Vuelve a generarlo o desmarca el adjunto.', 422);
      }
      const sizeError = new TransferError('El flyer supera el límite de 16 MiB. Genera una imagen más pequeña o desmarca el adjunto.', 413);
      if (Number(response.headers.get('content-length')) > maxFlyerBytes) {
        await response.body.cancel();
        throw sizeError;
      }
      const reader = response.body.getReader();
      const chunks: Uint8Array[] = [];
      let bytes = 0;
      try {
        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          bytes += value.byteLength;
          if (bytes > maxFlyerBytes) {
            await reader.cancel();
            throw sizeError;
          }
          chunks.push(value);
        }
      } finally {
        reader.releaseLock();
      }
      const png = Buffer.concat(chunks, bytes);
      if (png.length < 24 || !png.subarray(0, pngSignature.length).equals(pngSignature) ||
          png.toString('ascii', 12, 16) !== 'IHDR') {
        throw new TransferError('Canva no devolvió una imagen PNG válida para el flyer. Vuelve a generarlo.', 422);
      }
      return png;
    }
    throw new TransferError('Canva redirigió demasiadas veces la descarga del flyer. Vuelve a generarlo.', 422);
  } catch (error) {
    if (error instanceof TransferError) throw error;
    throw new TransferError('No se pudo descargar el flyer desde Canva. Revisa la conexión y vuelve a intentar el envío.', 502);
  }
}
