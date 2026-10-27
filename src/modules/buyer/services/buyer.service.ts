import { buyerUseCases } from '@/application/use-cases/buyer';
import type {
  BuyerCatalogs,
  OpportunityItem,
  OpportunityDetail,
  FollowUpTask,
  CampaignItem,
  ImpulseAlertItem,
  AIDecisionItem,
  AgentStatsData,
  BuyerOperationalKpis,
  BuyerMartKpiData,
} from '../types/buyer.types';

const useApi = import.meta.env.VITE_USE_API !== 'false';
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

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

  // ── CAPTACIÓN PÚBLICA (LANDING PAGE) ────────────────────────────────
  registerOpportunity: async (data: {
    nombre: string;
    telefono: string;
    motivo_consulta?: string;
    id_servicio?: number | null;
    id_sede?: number | null;
    email?: string | null;
    consentimiento_atencion: boolean;
    utm_source?: string;
    utm_campaign?: string;
  }) => {
    const payload = {
      nombres: data.nombre.split(' ')[0] || data.nombre,
      apellidos: data.nombre.split(' ').slice(1).join(' ') || '.',
      numero: data.telefono,
      email: data.email || null,
      id_canal: 4, // Página Web
      id_fuente: 2, // Búsqueda Orgánica (SEO / Maps)
      id_servicio: data.id_servicio || null,
      id_sede: data.id_sede || null,
      necesidad_declarada: data.motivo_consulta || 'Información de orientación y tratamientos dentales',
      autoriza_contacto: data.consentimiento_atencion,
      consentimiento_atencion: data.consentimiento_atencion,
      utm_source: data.utm_source,
      utm_campaign: data.utm_campaign,
    };

    const res = await fetch(`${API_URL}/buyer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || errorData.message || 'Error al procesar la solicitud de contacto');
    }
    return res.json();
  },

  // ── GESTIÓN DE OPORTUNIDADES (BUYER INTERNO) ────────────────────────
  getOpportunities: async (params?: Record<string, any>): Promise<{ success: boolean; count: number; data: OpportunityItem[] }> => {
    const query = new URLSearchParams(params || {});
    const res = await fetch(`${API_URL}/buyer/opportunities?${query.toString()}`);
    if (!res.ok) throw new Error('Error al cargar oportunidades de captación');
    return res.json();
  },

  getOpportunityDetail: async (id: number): Promise<{ success: boolean; data: OpportunityDetail }> => {
    const res = await fetch(`${API_URL}/buyer/opportunities/${id}`);
    if (!res.ok) throw new Error(`Error al obtener detalle de oportunidad #${id}`);
    return res.json();
  },

  updateOpportunityStatus: async (id: number, nuevo_estado: string, motivo?: string) => {
    const res = await fetch(`${API_URL}/buyer/opportunities/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nuevo_estado, motivo }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al actualizar estado de oportunidad');
    }
    return res.json();
  },

  convertOpportunityToLead: async (id: number, payload?: { motivo?: string; prioridad?: string }) => {
    const res = await fetch(`${API_URL}/buyer/opportunities/${id}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload || {}),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al convertir oportunidad a LEAD');
    }
    return res.json();
  },

  createOpportunityManual: async (data: any) => {
    const res = await fetch(`${API_URL}/buyer/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al registrar contacto comercial');
    }
    return res.json();
  },

  // ── BANDEJA DE SEGUIMIENTO (SLA COMERCIAL) ──────────────────────────
  getFollowUps: async (): Promise<{ success: boolean; count: number; data: FollowUpTask[] }> => {
    const res = await fetch(`${API_URL}/buyer/follow-ups`);
    if (!res.ok) throw new Error('Error al cargar bandeja de seguimiento comercial');
    return res.json();
  },

  // ── IMPULSE ALERTS ──────────────────────────────────────────────────
  getAlerts: async (params?: Record<string, any>): Promise<{ success: boolean; count: number; data: ImpulseAlertItem[] }> => {
    const query = new URLSearchParams(params || {});
    const res = await fetch(`${API_URL}/buyer/alerts?${query.toString()}`);
    if (!res.ok) throw new Error('Error al cargar Impulse Alerts');
    return res.json();
  },

  resolveAlert: async (id: number, motivo_resolucion: string, id_usuario = 1) => {
    const res = await fetch(`${API_URL}/buyer/alerts/${id}/resolve`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ motivo_resolucion, id_usuario }),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al resolver alerta');
    }
    return res.json();
  },

  scanSLAAlerts: async () => {
    const res = await fetch(`${API_URL}/buyer/alerts/scan-sla`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new Error('Error al ejecutar escaneo de alertas SLA');
    return res.json();
  },

  // ── GESTIÓN DE CAMPAÑAS Y GASTOS ────────────────────────────────────
  getCampaigns: async (): Promise<{ success: boolean; count: number; data: CampaignItem[] }> => {
    const res = await fetch(`${API_URL}/buyer/campaigns`);
    if (!res.ok) throw new Error('Error al obtener campañas comerciales');
    return res.json();
  },

  createCampaign: async (payload: {
    nombre: string;
    descripcion?: string;
    id_fuente?: number;
    id_canal?: number;
    fecha_inicio?: string;
    fecha_fin?: string;
  }) => {
    const res = await fetch(`${API_URL}/buyer/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al crear campaña publicitaria');
    }
    return res.json();
  },

  addCampaignExpense: async (campaignId: number, payload: { importe: number; fecha?: string; descripcion?: string }) => {
    const res = await fetch(`${API_URL}/buyer/campaigns/${campaignId}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      throw new Error(errorData.error || 'Error al registrar gasto publicitario');
    }
    return res.json();
  },

  // ── AGENTE INTELIGENTE DE MARKETING IA ──────────────────────────────
  getAgentHistory: async (limit = 50): Promise<{ success: boolean; count: number; data: AIDecisionItem[] }> => {
    const res = await fetch(`${API_URL}/buyer/agent/history?limit=${limit}`);
    if (!res.ok) throw new Error('Error al cargar historial del Agente de Marketing');
    return res.json();
  },

  getAgentStats: async (): Promise<{ success: boolean; data: AgentStatsData }> => {
    const res = await fetch(`${API_URL}/buyer/agent/stats`);
    if (!res.ok) throw new Error('Error al cargar estadísticas del Agente de Marketing');
    return res.json();
  },

  analyzeOpportunityWithAI: async (id: number) => {
    const res = await fetch(`${API_URL}/buyer/opportunities/${id}/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al solicitar análisis de IA');
    }
    return res.json();
  },

  analyzeTextWithAI: async (texto: string, id_canal = 4) => {
    const res = await fetch(`${API_URL}/buyer/agent/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ texto, id_canal }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al analizar texto con IA');
    }
    return res.json();
  },

  // ── KPIS Y BUSINESS INTELLIGENCE ───────────────────────────────────
  getOperationalKPIs: async (): Promise<BuyerOperationalKpis> => {
    const res = await fetch(`${API_URL}/buyer/kpis`);
    if (!res.ok) throw new Error('Error al cargar KPIs operativos de captación');
    return res.json();
  },

  getMartKPIs: async (period?: string): Promise<{ success: boolean; data: BuyerMartKpiData }> => {
    const query = period ? `?period=${period}` : '';
    const res = await fetch(`${API_URL}/reports/buyer/kpis${query}`);
    if (!res.ok) throw new Error('Error al cargar KPIs analíticos del Data Mart');
    return res.json();
  },

  // ── COMPATIBILIDAD CON VISTAS LEGACY ────────────────────────────────
  getAllBuyers: async () => {
    if (!useApi) return buyerUseCases.getAllBuyers();
    const res = await fetch(`${API_URL}/buyer`);
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
};
