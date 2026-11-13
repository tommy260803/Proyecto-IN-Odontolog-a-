import { buyerUseCases } from '@/application/use-cases/buyer';
import type {
  BuyerCatalogs,
  SedeCatalogItem,
  ServicioCatalogItem,
} from '../types/buyer.types';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

const webRequests = new Map<string, string>();

export interface BuyerPage {
  items: Awaited<ReturnType<typeof buyerUseCases.getAllBuyers>>;
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
  indicators?: {
    period: string;
    b1: { numerator: number; denominator: number; rate: number | null };
    b2: { numerator: number; denominator: number; rate: number | null };
    b3: { averageDays: number | null; conversions: number; totalDays: number | null };
  };
}

async function postBuyerWeb(data: object) {
  const body = JSON.stringify(data);
  let key = webRequests.get(body);
  if (!key) {
    key = crypto.randomUUID();
    if (webRequests.size >= 20) {
      const oldest = webRequests.keys().next().value;
      if (oldest) webRequests.delete(oldest);
    }
    webRequests.set(body, key);
  }
  const response = await fetch(`${API_URL}/buyer/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Idempotency-Key': key },
    body,
  });
  if (response.status < 500 && webRequests.get(body) === key) webRequests.delete(body);
  return response;
}

export const buyerService = {
  // ── CATÁLOGOS COMERCIALES ──────────────────────────────────────────
  getCatalogs: async (): Promise<BuyerCatalogs> => {
    if (!useApi) {
      return {
        servicios: [
          { id_servicio: 1, nombre: 'Evaluación General' },
          { id_servicio: 2, nombre: 'Ortodoncia Inicial' },
          { id_servicio: 3, nombre: 'Blanqueamiento Dental' },
          { id_servicio: 4, nombre: 'Implante Dental' },
          { id_servicio: 5, nombre: 'Diseño de Sonrisa' },
          { id_servicio: 6, nombre: 'Odontopediatría' },
        ],
        canales: [
          { id_canal: 1, nombre: 'Presencial (Recepción en Sede)' },
          { id_canal: 2, nombre: 'Llamada Telefónica' },
          { id_canal: 3, nombre: 'WhatsApp Directo' },
          { id_canal: 4, nombre: 'Página Web / Portal Online' },
          { id_canal: 5, nombre: 'Redes Sociales (Instagram / FB / TikTok)' },
          { id_canal: 6, nombre: 'Recomendación / Referido' },
        ],
        fuentes: [
          { id_fuente: 1, nombre: 'Visita Espontánea / Walk-in' },
          { id_fuente: 2, nombre: 'Meta Ads (Instagram / FB)' },
          { id_fuente: 3, nombre: 'Google Ads / Búsqueda' },
          { id_fuente: 4, nombre: 'Búsqueda Orgánica Web' },
          { id_fuente: 5, nombre: 'Recomendación de Paciente' },
        ],
        sedes: [
          { id_sede: 1, nombre: 'Sede California', direccion: 'Av. Larco 820, Urb. California, Trujillo' },
          { id_sede: 2, nombre: 'Sede Primavera', direccion: 'Av. Teodoro Valcárcel 345, Urb. Primavera, Trujillo' },
          { id_sede: 3, nombre: 'Sede Centro Histórico', direccion: 'Jr. Pizarro 456, Centro Histórico, Trujillo' },
        ],
        modalidades: [
          { id_modalidad: 1, nombre: 'Presencial' },
          { id_modalidad: 2, nombre: 'Virtual' },
          { id_modalidad: 3, nombre: 'Teleconsulta' },
          { id_modalidad: 4, nombre: 'Domiciliaria' },
        ],
        horarios: [],
      };
    }
    const res = await fetch(`${API_URL}/buyer/catalogs`);
    if (!res.ok) throw new Error('Error al cargar catálogos comerciales');
    return res.json();
  },

  // ── DEDUPLICACIÓN EN TIEMPO REAL ────────────────────────────────────
  checkDuplicate: async (params: { phone?: string; email?: string; dni?: string; excludeId?: string | number }) => {
    const query = new URLSearchParams();
    if (params.phone) query.append('phone', params.phone);
    if (params.email) query.append('email', params.email);
    if (params.dni) query.append('dni', params.dni);
    if (params.excludeId !== undefined && params.excludeId !== null) query.append('excludeId', String(params.excludeId));

    try {
      const res = await fetch(`${API_URL}/buyer/check-duplicate?${query.toString()}`);
      if (!res.ok) return { isDuplicate: false };
      return res.json();
    } catch (e) {
      console.warn('Error checking duplicate:', e);
      return { isDuplicate: false };
    }
  },

  // ── CAPTACIÓN PÚBLICA (LANDING PAGE - FORMULARIO INTUITIVO) ───────────
  registerOpportunity: async (data: {
    nombre: string;
    telefono: string;
    motivo_consulta?: string;
    id_servicio?: number | null;
    id_sede?: number | null;
    sede_preferida?: string | null;
    horario_preferido?: string | null;
    dni?: string | null;
    email?: string | null;
    consentimiento_atencion: boolean;
    utm_source?: string;
    utm_campaign?: string;
    id_interaccion_previa?: number | null;
  }) => {
    const nameParts = data.nombre.trim().split(/\s+/);
    const firstName = nameParts[0] || data.nombre;
    const lastName = nameParts.slice(1).join(' ') || 'General';

    const payload = {
      nombres: firstName,
      apellidos: lastName,
      numero: data.telefono,
      dni: data.dni || null,
      email: data.email || null,
      id_servicio: data.id_servicio || null,
      id_sede: data.id_sede || null,
      sede_preferida: data.sede_preferida || null,
      horario_preferido: data.horario_preferido || null,
      necesidad_declarada: data.motivo_consulta || 'Información de orientación y tratamientos dentales',
      motivo_consulta: data.motivo_consulta || 'Información de orientación y tratamientos dentales',
      autoriza_contacto: data.consentimiento_atencion,
      consentimiento_atencion: data.consentimiento_atencion,
      utm_source: data.utm_source,
      utm_campaign: data.utm_campaign,
      id_interaccion_previa: data.id_interaccion_previa || null,
    };

    const res = await postBuyerWeb(payload);
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Error al registrar la solicitud');
    }
    return res.json();
  },

  // ── REGISTRO Y CONVERSIÓN CON RESILIENCIA ───────────────────────────
  registerAndConvert: async (data: any) => {
    try {
      const res = await postBuyerWeb(data);
      if (res.ok) {
        return await res.json();
      }
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Error al registrar la solicitud');
    } catch (err: any) {
      if (!useApi) {
        const buyer = await buyerUseCases.createBuyer(data);
        return buyerUseCases.convertToLead((buyer as any).id || (buyer as any).id_persona);
      }
      throw err;
    }
  },

  // ── OBTENER BUYER POR ID CON FALLBACK ──────────────────────────────
  getBuyerById: async (id: string | number) => {
    if (!useApi) {
      const all = await buyerUseCases.getAllBuyers();
      return all.find((b: any) => String(b.id) === String(id) || String(b.personId) === String(id)) || null;
    }
    try {
      const res = await fetch(`${API_URL}/buyer/${id}`);
      if (res.ok) {
        return res.json();
      }
      if (res.status >= 500) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || 'Error del servidor al cargar el prospecto');
      }
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Error del servidor')) {
        throw e;
      }
      console.warn('Error fetching buyer by id directly, trying fallback:', e);
    }
    try {
      const allRes = await fetch(`${API_URL}/buyer`);
      if (allRes.ok) {
        const list = await allRes.json();
        const items = Array.isArray(list) ? list : (list.items || []);
        return (
          items.find(
            (b: any) =>
              String(b.id) === String(id) ||
              String(b.personId) === String(id) ||
              String(b.id_oportunidad) === String(id)
          ) || null
        );
      }
    } catch (_) {}
    return null;
  },

  // ── EVALUACIÓN Y PERSISTENCIA UNIFICADA CON GEMINI ───────────────────
  evaluateBuyer: async (id: string | number, options?: { message?: string }) => {
    if (!useApi) {
      return { success: true };
    }
    const res = await fetch(`${API_URL}/buyer/${id}/evaluate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(options || {}),
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al evaluar el mensaje del prospecto con Gemini');
    }
    return res.json();
  },

  retryEvaluation: async (interactionId: string | number) => {
    if (!useApi) {
      return { success: true };
    }
    const res = await fetch(`${API_URL}/buyer/evaluations/${interactionId}/retry`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || 'Error al reintentar la evaluación');
    }
    return res.json();
  },

  // ── VISTAS Y ADMINISTRACIÓN ─────────────────────────────────────────
  getAllBuyers: async () => {
    if (!useApi) return buyerUseCases.getAllBuyers();
    const res = await fetch(`${API_URL}/buyer`);
    if (!res.ok) throw new Error('Error al cargar buyers');
    return res.json();
  },

  getBuyersPage: async (params: {
    page: number;
    pageSize: number;
    search?: string;
    states?: string[];
    channels?: string[];
    fromDate?: string;
    toDate?: string;
  }): Promise<BuyerPage> => {
    if (!useApi) {
      const all = await buyerUseCases.getAllBuyers();
      const start = (params.page - 1) * params.pageSize;
      return {
        items: all.slice(start, start + params.pageSize),
        pagination: {
          page: params.page,
          pageSize: params.pageSize,
          total: all.length,
          totalPages: Math.max(1, Math.ceil(all.length / params.pageSize)),
        },
      };
    }

    const query = new URLSearchParams({
      page: String(params.page),
      pageSize: String(params.pageSize),
    });
    if (params.search) query.set('search', params.search);
    if (params.states?.length) query.set('states', params.states.join(','));
    if (params.channels?.length) query.set('channels', params.channels.join(','));
    if (params.fromDate) query.set('fromDate', params.fromDate);
    if (params.toDate) query.set('toDate', params.toDate);

    const res = await fetch(`${API_URL}/buyer?${query.toString()}`);
    if (!res.ok) throw new Error('Error al cargar buyers');
    return res.json();
  },

  createBuyer: async (data: any) => {
    if (!useApi) return buyerUseCases.createBuyer(data);
    const res = await fetch(`${API_URL}/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al crear buyer');
    }
    return res.json();
  },

  updateBuyer: async (id: string, data: any) => {
    if (!useApi) return buyerUseCases.updateBuyer(id, data);
    const res = await fetch(`${API_URL}/buyer/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar buyer');
    }
    return res.json();
  },

  convertToLead: async (id: string, payload?: any) => {
    if (!useApi) return buyerUseCases.convertToLead(id);
    const res = await fetch(`${API_URL}/buyer/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al convertir buyer a lead');
    }
    return res.json();
  },

  chatWithBuyerAssistant: async (payload: {
    messages: Array<{ role: 'user' | 'model'; text: string }>;
    collectedData?: {
      nombre?: string | null;
      telefono?: string | null;
      dni?: string | null;
      email?: string | null;
      sede_nombre?: string | null;
      servicio_nombre?: string | null;
      horario_nombre?: string | null;
      motivo_consulta?: string | null;
      autoriza_contacto?: boolean | null;
    };
  }) => {
    const res = await fetch(`${API_URL}/buyer/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al comunicarse con el asistente');
    }
    const json = await res.json();
    return json.data as {
      reply: string;
      intent: 'ORIENTACION' | 'FAQ' | 'INTERES_CONTACTO' | 'LISTO_PARA_REGISTRO';
      extracted: {
        nombre?: string | null;
        telefono?: string | null;
        dni?: string | null;
        email?: string | null;
        sede_nombre?: string | null;
        servicio_nombre?: string | null;
        horario_nombre?: string | null;
        motivo_consulta?: string | null;
        autoriza_contacto?: boolean | null;
      };
      suggestedActions: string[];
      readyToRegister: boolean;
      source: 'gemini' | 'fallback';
    };
  },

  getAgentRules: async () => {
    const res = await fetch(`${API_URL}/buyer/agent-rules`);
    if (!res.ok) throw new Error('No se pudieron cargar las reglas del agente');
    const json = await res.json();
    return json.data;
  },

  saveAgentRules: async (rules: any) => {
    const res = await fetch(`${API_URL}/buyer/agent-rules`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(rules),
    });
    if (!res.ok) throw new Error('No se pudieron guardar las reglas del agente');
    const json = await res.json();
    return json.data;
  },

  generatePersuasionStrategy: async (id: string) => {
    const res = await fetch(`${API_URL}/buyer/${id}/persuasion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('No se pudo generar la estrategia de persuasión');
    const json = await res.json();
    return json.data as {
      id_persona: number;
      angulo_principal: string;
      argumentos: string[];
      reglas_aplicadas: string[];
      objecion_probable: string;
      guion_whatsapp: string;
      source: 'gemini' | 'reglas_locales';
      descuento_recomendado: {
        activo: boolean;
        porcentaje: number;
        datos_completados: string[];
        datos_faltantes: string[];
        total_datos: number;
        urgencia_texto: string;
        frases_gancho: string[];
      };
    };
  },
};
