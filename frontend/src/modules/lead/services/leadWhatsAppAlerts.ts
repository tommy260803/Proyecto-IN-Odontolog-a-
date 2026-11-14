import { useSyncExternalStore } from 'react';
import { staffAuthService } from '@/shared/services/staffAuthService';

export const leadCommercialUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001/api') + '/lead/commercial';
export const leadWhatsAppAlertsKey = ['lead', 'whatsapp-alerts'] as const;
export const leadWhatsAppControlChanged = 'lead:whatsapp-control-changed';
export const requiresLeadStaff = import.meta.env.VITE_LEAD_STAFF_AUTH_ENABLED === 'true' ||
  import.meta.env.VITE_LEAD_STAFF_AUTH_QA === 'true';

export type LeadStaffSession = {
  token: string;
  expira_en: string;
  usuario: { nombres: string; apellidos: string; rol: string };
};

export type WhatsAppAlert = {
  id: string; requestId: number; personId: number; receivedAt: string;
  prioridad?: { orden: number; motivo: string; accion: string };
};

export function whatsappAlertRoute(alert: WhatsAppAlert) {
  return `/lead/${alert.personId}/negotiation?solicitud=${alert.requestId}&conversacion=whatsapp`;
}

const localOperators = new Map<string, string>();

export function whatsAppStaffHeaders(staffToken?: string | null): Record<string, string> {
  if (staffToken) return { Authorization: 'Bearer ' + staffToken };
  const user = staffAuthService.getSession();
  const key = 'nexosalud:lead:operator:' + (user?.email ?? 'local');
  let token = localOperators.get(key) ?? crypto.randomUUID();
  try {
    const stored = localStorage.getItem(key);
    if (stored) token = stored;
    else localStorage.setItem(key, token);
  } catch { /* The current tab can still use its in-memory identity. */ }
  localOperators.set(key, token);
  return { 'X-Lead-Operator': token, 'X-Lead-Operator-Name': user ? encodeURIComponent(`${user.nombres} ${user.apellidos}`.trim()) : '' };
}
let session: LeadStaffSession | null = null;
const listeners = new Set<() => void>();
function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function useLeadStaffSession() {
  return useSyncExternalStore(subscribe, () => session);
}

export function setLeadStaffSession(value: LeadStaffSession | null) {
  session = value;
  listeners.forEach(listener => listener());
}

export async function getLeadWhatsAppAlerts(signal: AbortSignal, token?: string) {
  const response = await fetch(leadCommercialUrl + '/whatsapp/alerts', {
    signal, cache: 'no-store', headers: token ? { Authorization: 'Bearer ' + token } : undefined,
  });
  if (response.status === 401 && token && session?.token === token) setLeadStaffSession(null);
  if (response.status === 401 || response.status === 403) return [];
  if (!response.ok) throw new Error('No se pudieron consultar las alertas de WhatsApp LEAD.');
  const result: { alerts: WhatsAppAlert[] } = await response.json();
  return result.alerts;
}

export async function watchLeadWhatsAppAlerts(signal: AbortSignal, onRefresh: () => void, token?: string) {
  const connection = new AbortController();
  const expire = () => window.setTimeout(() => connection.abort(), 35_000);
  let deadline = expire();
  try {
    const response = await fetch(leadCommercialUrl + '/whatsapp/alerts/stream', {
      signal: AbortSignal.any([signal, connection.signal]), cache: 'no-store',
      headers: { Accept: 'text/event-stream', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    });
    if (response.status === 401 && token && session?.token === token) setLeadStaffSession(null);
    if (!response.ok || !response.body || !response.headers.get('Content-Type')?.includes('text/event-stream')) return;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let incomplete = '';
    try {
      while (!signal.aborted && !connection.signal.aborted) {
        const { value, done } = await reader.read();
        if (done) break;
        window.clearTimeout(deadline);
        deadline = expire();
        const lines = (incomplete + decoder.decode(value, { stream: true })).split('\n');
        incomplete = lines.pop() ?? '';
        if (lines.some(line => line.trimEnd() === 'data: refresh')) onRefresh();
      }
    } finally {
      reader.releaseLock();
    }
  } finally {
    window.clearTimeout(deadline);
    connection.abort();
  }
}
