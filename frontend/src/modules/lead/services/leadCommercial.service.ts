const api = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export interface OpportunityRow {
  id_solicitud: number;
  id_persona: number;
  nombres: string;
  apellidos: string;
  servicio: string | null;
  negociador: string | null;
  dia_ingreso: string;
  resultado_comercial_lead: string | null;
  archivada_lead_en: string | null;
  fecha_primera_respuesta: string | null;
  fecha_proximo_seguimiento: string | null;
  ultima_interaccion: string | null;
  estado_seguimiento: 'vencido' | 'hoy' | 'futuro' | 'sin_programar' | null;
  prioridad_operativa: 1 | 2 | 3 | 4;
}

export interface OpportunityDetail {
  oportunidad: Pick<OpportunityRow, 'id_solicitud' | 'resultado_comercial_lead' | 'archivada_lead_en' | 'fecha_primera_respuesta' | 'fecha_proximo_seguimiento'> & {
    ingreso_lead_documentado: string;
    motivo: string | null;
    valor_acordado_lead: string | null;
    id_propuesta_aceptada_lead: number | null;
    fecha_decision_comercial_lead: string | null;
    motivo_cierre_lead: string | null;
  };
  cabecera: { paciente: string; servicio: string | null; negociador: string | null };
  propuestas: {
    id_propuesta: number;
    id_propuesta_logica: number;
    numero_version: number;
    orden_version: number;
    precio_cotizado: string;
    id_promocion_lead: number | null;
    promocion_registrada: string | null;
    promocion_catalogo: string | null;
    estado: string;
    fecha_presentacion: string;
    fecha_decision: string | null;
    motivo_rechazo: string | null;
    categoria_rechazo: string | null;
    sede: string | null;
  }[];
  tarifa_referencia: { id_tarifa: number; precio: string; fecha_inicio: string; fecha_fin: string | null } | null;
  promociones_disponibles: { id_promocion: number; nombre: string; tipo_promocion: string }[];
  alternativas: {
    id_opcion: number;
    estado_respuesta: string | null;
    seleccionada: boolean;
    _count: { Reservas: number };
    archivada_lead_en: string | null;
    fecha_ofrecida: string;
    fecha_respuesta: string | null;
    pref_turno_lead: string | null;
    ofr_turno_lead: string | null;
  }[];
  preferencias: {
    id_preferencia: number;
    sede_preferida: string | null;
    profesional_preferido: string | null;
    fecha_inicio: string;
    fecha_fin: string | null;
    Horario: { dia_semana: number | null; hora_inicio: string | null; hora_fin: string | null } | null;
    ServicioInteres: { nombre: string } | null;
  }[];
  modificaciones: {
    id_cambio: number; id_opcion: number; campo_modificado: string; motivo_cambio: string;
    fecha_cambio: string;
    valor_anterior: string | null; valor_nuevo: string | null;
  }[];
  condiciones_ofrecidas: {
    id_opcion: number; revision: string; origen: string; dia: string; inicio: string; fin: string;
    sede: string; profesional: string; precio: string;
    dia_preferido: string | null; dia_semana_preferido: number | null;
    inicio_preferido: string | null; fin_preferido: string | null;
    turno_preferido: string | null; turno_ofrecido: string | null;
    motivo_rechazo: string | null; categoria_rechazo: string | null;
    dia_inicial: string; inicio_inicial: string; fin_inicial: string;
    sede_inicial: string; profesional_inicial: string; precio_inicial: string;
  }[];
}

export interface Candidate {
  id_disponibilidad: number;
  id_sede: number;
  id_profesional: number;
  dia: string;
  inicio: string;
  fin: string;
  inicio_exacto: string;
  fin_exacto: string;
  sede: string;
  profesional: string;
}

interface RecordedInteraction {
  id_interaccion: number;
  tipo: string;
  mensaje: string | null;
  dia_registrado: string;
  hora_registrada: string;
  canal: string | null;
  actor: string | null;
  es_respuesta_util: boolean;
}

interface PayerReadiness {
  estado: 'preparado' | 'bloqueado';
  requisitos: {
    codigo: string;
    etiqueta: string;
    estado: 'cumple' | 'bloqueado' | 'pendiente';
    detalle: string;
  }[];
}

async function get<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(`${api}/lead/commercial${path}`, { signal });
  if (!response.ok) {
    if (response.status === 400) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.error === 'string' ? body.error : 'Revisa los filtros de LEAD.');
    }
    if (response.status === 404) throw new Error('La oportunidad no existe.');
    if (response.status === 409) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.error === 'string' ? body.error : 'La oportunidad no está disponible para esta consulta.');
    }
    throw new Error('No se pudo consultar LEAD. Intenta de nuevo.');
  }
  return response.json();
}

export const leadCommercialService = {
  async changeAlternative(id: string, option: number, token: string, data: object) {
    const response = await fetch(`${api}/lead/commercial/opportunities/${id}/alternatives/${option}`, {
      method: 'PATCH', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(typeof body?.error === 'string' ? body.error : 'No se pudo actualizar la alternativa.');
    }
  },
  reasons: (signal: AbortSignal) =>
    get<{ motivos: { id_motivo_rechazo: number; motivo: string; ambito: string }[] }>('/catalogs', signal),
  list: (params: URLSearchParams, signal: AbortSignal) =>
    get<{ oportunidades: OpportunityRow[]; hay_siguiente: boolean }>(`/opportunities?${params}`, signal),
  detail: (id: string, signal: AbortSignal) => get<OpportunityDetail>(`/opportunities/${id}?incluir_interacciones=false`, signal),
  payerReadiness: (id: string, signal: AbortSignal) => get<PayerReadiness>(`/opportunities/${id}/payer-readiness`, signal),
  activity: (id: string, page: number, signal: AbortSignal) =>
    get<{ interacciones: RecordedInteraction[]; hay_siguiente: boolean }>(
      `/opportunities/${id}/activity?pagina=${page}`, signal,
    ),
  availability: (id: string, day: string, page: number, signal: AbortSignal) =>
    get<{ candidatas: Candidate[]; hay_siguiente: boolean }>(
      `/opportunities/${id}/availability?${new URLSearchParams({ fecha: day, pagina: String(page) })}`, signal,
    ),
  filters: (signal: AbortSignal) => get<{
    servicios: { id_servicio: number; nombre: string }[];
    negociadores: { id_usuario: number; nombre: string }[];
  }>('/opportunity-filters', signal),
};

const limaDateTime = new Intl.DateTimeFormat('es-PE', {
  dateStyle: 'short', timeStyle: 'short', timeZone: 'America/Lima',
});

export function formatFollowUp(value: string | null): string {
  return value ? limaDateTime.format(new Date(value)) : 'Sin programar';
}

export function validLeadId(id: string): boolean {
  return /^\d+$/.test(id) && Number(id) > 0 && Number(id) <= 2147483647;
}

export function commercialStatus(result: string | null): string {
  switch (result) {
    case 'PENDIENTE': return 'Pendiente';
    case 'ACEPTADA': return 'Aceptada';
    case 'CERRADA_SIN_ACUERDO': return 'Cerrada sin acuerdo';
    default: return 'Sin resultado documentado';
  }
}
