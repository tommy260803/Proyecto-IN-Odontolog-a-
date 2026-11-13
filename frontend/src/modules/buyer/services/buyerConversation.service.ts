import type { ChatTurn, ConversationPage, HistoryPage, PendingChatSend, StaffBearerSession } from '../types/buyerConversation.types';

const root = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api').replace(/\/$/, '');
export class ChatApiError extends Error {
  readonly status: number;
  readonly code?: string;
  constructor(status: number, message: string, code?: string) { super(message); this.status = status; this.code = code; }
}
// send comprueba TURN_PENDING antes de INSERT. Otros códigos, errores técnicos
// o respuestas ilegibles no acreditan que el mensaje no se haya registrado.
export const isConfirmedTurnPending = (cause: unknown): cause is ChatApiError =>
  cause instanceof ChatApiError && cause.status === 409 && cause.code === 'TURN_PENDING';
async function request<T>(path: string, init: RequestInit, token?: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(root + path, { ...init, headers: {
      ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init.headers,
    } });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ChatApiError(0, 'No se recibió confirmación del servidor. Conservamos el envío original.');
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new ChatApiError(response.status,
      response.status === 401 ? 'Sesión no válida o vencida. Vuelve a identificarte.' :
      response.status === 403 ? 'No tienes acceso administrativo a esta persona.' :
      response.status === 404 ? 'La función o el recurso solicitado no están disponibles.' :
      response.status === 429 ? 'Demasiados intentos. Intenta más tarde.' :
      typeof data.error === 'string' ? data.error : 'No se pudo completar la operación.', data.code);
  }
  if (response.status === 204) return undefined as T;
  try { return await response.json() as T; }
  catch { throw new ChatApiError(0, 'Respuesta no legible. Conservamos el envío original para comprobarlo.'); }
}
const base = (personId: string) => `/buyer/${encodeURIComponent(personId)}/conversations`;
export const buyerConversationService = {
  login: (email: string, password: string, signal?: AbortSignal) => request<StaffBearerSession>(
    '/lead/commercial/staff/session', { method: 'POST', body: JSON.stringify({ email, password }), signal }),
  logout: (token: string, signal?: AbortSignal) => request<void>('/lead/commercial/staff/session', { method: 'DELETE', signal }, token),
  list: (personId: string, token: string, after = 0, signal?: AbortSignal) => request<ConversationPage>(
    `${base(personId)}?after=${after}&limit=20`, { signal }, token),
  history: (personId: string, conversationId: string, token: string, after = 0, signal?: AbortSignal) => request<HistoryPage>(
    `${base(personId)}/${encodeURIComponent(conversationId)}?after=${after}`, { signal }, token),
  send: async (pending: PendingChatSend, token: string, signal?: AbortSignal) => {
    const turn=await request<ChatTurn>(`${base(pending.personId)}/messages`, { method: 'POST', body: pending.body,
      headers: { 'Idempotency-Key': pending.key }, signal }, token);
    const destination=JSON.parse(pending.body).conversationId;
    // Un 2xx sin identidad/historial de turno legibles tampoco confirma el envío.
    if(!turn || !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(turn.conversationId) ||
      (destination!==undefined && destination!==turn.conversationId) ||
      !Number.isSafeInteger(turn.turnId) || turn.turnId<1 || !Number.isSafeInteger(turn.interactionId) || turn.interactionId<1 ||
      !['COMPLETADA','PENDIENTE','PROCESANDO'].includes(turn.status) || typeof turn.retryable!=='boolean' ||
      !Array.isArray(turn.messages) || turn.messages.some(m=>!m || !['paciente','operador_transcriptor','asistente','sistema'].includes(m.role) ||
        typeof m.text!=='string' || typeof m.origin!=='string' || typeof m.at!=='string') || !Array.isArray(turn.attempts)) {
      throw new ChatApiError(0,'Respuesta de turno incompleta o de otra conversación. Conservamos el envío original.');
    }
    return turn;
  },
  retry: (personId: string, conversationId: string, turnId: number, token: string, signal?: AbortSignal) => request<ChatTurn>(
    `${base(personId)}/${encodeURIComponent(conversationId)}/turns/${turnId}/retry`,
    { method: 'POST', body: '{}', signal }, token),
};

const pendingKey = (personId: string) => `nexosalud_buyer_chat_pending_v1:${personId}`;
const rejectedKey = (personId: string, actorId: number) => `nexosalud_buyer_chat_rejected_v1:${personId}:${actorId}`;
function readEnvelope(raw: string | null, personId: string): PendingChatSend | null {
  try {
    const p = JSON.parse(raw || 'null');
    if (p?.personId !== personId || !Number.isSafeInteger(p.actorId) || p.actorId < 1 ||
      typeof p.key !== 'string' || !/^[\x21-\x7e]{8,128}$/.test(p.key) || typeof p.body !== 'string') return null;
    if(p.recoveredDraftKey!==undefined && (typeof p.recoveredDraftKey!=='string' || !/^[\x21-\x7e]{8,128}$/.test(p.recoveredDraftKey))) return null;
    const body = JSON.parse(p.body);
    if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 2000 ||
      !['OPERADOR','OPERADOR_TRANSCRIPTOR'].includes(body.origin) ||
      (body.conversationId !== undefined && (typeof body.conversationId !== 'string' ||
        !/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/.test(body.conversationId))) ||
      Object.keys(body).some(k => !['message','origin','conversationId'].includes(k))) return null;
    return p;
  } catch { return null; }
}
export function loadPendingSend(personId: string, actorId?: number): PendingChatSend | null {
  try {
    const owned=actorId?readEnvelope(sessionStorage.getItem(`${pendingKey(personId)}:${actorId}`),personId):null;
    const envelope=owned||readEnvelope(sessionStorage.getItem(pendingKey(personId)),personId);
    return envelope && (actorId===undefined||envelope.actorId===actorId)?envelope:null;
  } catch {return null;}
}
export function storePendingSend(personId: string, pending: PendingChatSend | null, actorId?: number) {
  if (pending) {
    const previous=readEnvelope(sessionStorage.getItem(pendingKey(personId)),personId);
    if(previous && previous.actorId!==pending.actorId)sessionStorage.setItem(`${pendingKey(personId)}:${previous.actorId}`,JSON.stringify(previous));
    const serialized=JSON.stringify(pending);
    sessionStorage.setItem(`${pendingKey(personId)}:${pending.actorId}`,serialized);
    sessionStorage.setItem(pendingKey(personId),serialized); // compatibilidad con sobres previos
  } else {
    if(actorId!==undefined)sessionStorage.removeItem(`${pendingKey(personId)}:${actorId}`);
    const legacy=readEnvelope(sessionStorage.getItem(pendingKey(personId)),personId);
    if(actorId===undefined||legacy?.actorId===actorId)sessionStorage.removeItem(pendingKey(personId));
  }
}
export function loadRejectedDraft(personId: string, actorId: number): PendingChatSend | null {
  try {
    const envelope=readEnvelope(sessionStorage.getItem(rejectedKey(personId,actorId)),personId);
    return envelope?.actorId===actorId?envelope:null;
  } catch {return null;}
}
export function storeRejectedDraft(personId: string, actorId: number, draft: PendingChatSend | null) {
  if(draft) {
    if(draft.personId!==personId || draft.actorId!==actorId) throw new Error('Borrador de otra persona u operador rechazado.');
    sessionStorage.setItem(rejectedKey(personId,actorId),JSON.stringify(draft));
  } else sessionStorage.removeItem(rejectedKey(personId,actorId));
}
