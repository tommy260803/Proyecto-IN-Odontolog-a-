import { createHash, createHmac } from 'node:crypto';
import { TransferError } from './leadPayerTransfer';

export function leadWhatsAppSettings() {
  const base = process.env.OPENWA_BASE_URL?.trim();
  const apiKey = process.env.OPENWA_API_KEY?.trim();
  const sessionId = process.env.OPENWA_SESSION_ID?.trim();
  if (!base || !apiKey || !sessionId) {
    throw new TransferError('Configura la URL, la clave y la sesión de OpenWA en el backend.', 503);
  }
  const gateway = URL.parse(base);
  if (!gateway || !['http:', 'https:'].includes(gateway.protocol) || gateway.username ||
      gateway.password || gateway.search || gateway.hash) {
    throw new TransferError('La URL de OpenWA no es válida.', 503);
  }

  const publicBase = process.env.LEAD_PUBLIC_RESERVATION_URL?.trim();
  const publicUrl = publicBase ? URL.parse(publicBase) : null;
  const localReservation = publicUrl !== null &&
    ['localhost', '127.0.0.1', '[::1]'].includes(publicUrl.hostname);
  const localHttp = localReservation && publicUrl.protocol === 'http:';
  if (publicBase && (!publicUrl || (!localHttp && publicUrl.protocol !== 'https:') ||
      publicUrl.username || publicUrl.password || publicUrl.search || publicUrl.hash)) {
    throw new TransferError('Configura una URL HTTPS o una URL HTTP en localhost para la prerreserva.', 503);
  }

  return { base: gateway.href.replace(/\/+$/, ''), apiKey, sessionId, publicUrl, localReservation };
}

export function whatsAppChatId(phone: string | null) {
  const value = phone?.trim() ?? '';
  if (!/^\+?[\d\s().-]+$/.test(value)) {
    throw new TransferError('El cliente necesita un número válido para WhatsApp.', 422);
  }
  let digits = value.replace(/\D/g, '');
  if (digits.startsWith('00') && !value.startsWith('+')) digits = digits.slice(2);
  else if (digits.length === 9 && !value.startsWith('+')) digits = '51' + digits;
  if (!/^[1-9]\d{7,14}$/.test(digits) || (digits.startsWith('51') && !/^519\d{8}$/.test(digits))) {
    throw new TransferError('El cliente necesita un número válido para WhatsApp.', 422);
  }
  return digits + '@c.us';
}

type Settings = ReturnType<typeof leadWhatsAppSettings>;

// The same offer and recipient must get the same link on a retry.
export function proposalWhatsAppToken(settings: Settings, fingerprint: string, chatId: string) {
  return createHmac('sha256', settings.apiKey)
    .update(JSON.stringify(['nexosalud:lead:whatsapp:reservation:v1', settings.sessionId, fingerprint, chatId]))
    .digest('hex');
}

export async function sendLeadWhatsApp(settings: Settings, fingerprint: string, chatId: string, text: string, imageUrl?: string) {
  if (imageUrl && text.length > 1024) {
    throw new TransferError('El mensaje es demasiado largo para acompañar al flyer. Puedes enviarlo solo como texto.', 422);
  }
  const endpoint = imageUrl ? 'send-image' : 'send-text';
  const body = JSON.stringify(imageUrl
    ? { chatId, url: imageUrl, caption: text }
    : { chatId, text, linkPreview: false });
  const key = 'nexosalud-lead-' + createHash('sha256').update(fingerprint).update(body).digest('hex');
  const url = `${settings.base}/api/sessions/${encodeURIComponent(settings.sessionId)}/messages/${endpoint}`;
  let response: Awaited<ReturnType<typeof fetch>>;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-Key': settings.apiKey, 'Idempotency-Key': key },
      body,
      redirect: 'error',
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    throw new TransferError('OpenWA no confirmó el envío. Verifica el chat antes de intentar otro envío.', 502);
  }

  const result = await response.json().catch(() => null) as { messageId?: unknown; code?: string } | null;
  if (response.status === 201 && typeof result?.messageId === 'string' && result.messageId.trim()) {
    return { messageId: result.messageId, reused: response.headers.get('Idempotent-Replayed') === 'true' };
  }
  if (result?.code === 'IDEMPOTENCY_KEY_IN_PROGRESS') {
    throw new TransferError('OpenWA todavía está procesando este envío.', 409);
  }
  if (result?.code === 'IDEMPOTENCY_OUTCOME_UNKNOWN' || response.status >= 500 || response.ok) {
    throw new TransferError('OpenWA no confirmó el envío. Verifica el chat antes de intentar otro envío.', 502);
  }
  if (response.status === 401 || response.status === 403 || response.status === 404) {
    throw new TransferError('OpenWA rechazó la clave o la sesión configurada.', 503);
  }
  if (response.status === 409) {
    throw new TransferError('La sesión de WhatsApp no está lista. Revisa OpenWA antes de enviar.', 409);
  }
  if (response.status === 429) {
    throw new TransferError('OpenWA pidió esperar antes de enviar otro mensaje.', 429);
  }
  throw new TransferError(imageUrl
    ? 'OpenWA rechazó el envío con flyer. Vuelve a generar el flyer o desmarca el adjunto.'
    : 'OpenWA rechazó el mensaje. Verifica el número y la sesión.', 422);
}
