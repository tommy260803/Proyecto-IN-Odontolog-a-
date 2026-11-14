import type { LeadNegotiationSlot } from './leadNegotiationSlots';
import { formatAppointmentTime } from '../utils/appointmentTime';

export type AgentActivity = {
  codigo: 'CAP-01' | 'CAP-02' | 'CAP-03' | 'CAP-04' | 'CAP-05';
  detalle: string;
};

type NegotiationPlan = {
  actividadAgente?: AgentActivity;
  accionComercial?: 'MEJORA_PROMOCION';
  slots?: unknown[];
  selectedSlot?: unknown;
  confirmedOffer?: boolean;
  confirmationLink?: boolean;
};

const activities = new Set(['CAP-01', 'CAP-02', 'CAP-03', 'CAP-04', 'CAP-05']);

function isSlot(value: unknown): value is LeadNegotiationSlot {
  if (!value || typeof value !== 'object') return false;
  const slot = value as LeadNegotiationSlot;
  return [slot.id_disponibilidad, slot.id_sede, slot.id_profesional].every(id => Number.isInteger(id) && id > 0) &&
    typeof slot.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(slot.fecha) &&
    [slot.inicio, slot.fin].every(time => typeof time === 'string' && /^\d{2}:\d{2}$/.test(time)) &&
    typeof slot.sede === 'string' && typeof slot.profesional === 'string';
}

export function describeAgendaActivity(count: number): AgentActivity {
  return {
    codigo: 'CAP-02',
    detalle: count === 0 ? 'Consultó la agenda y no encontró horarios compatibles con la preferencia indicada.'
      : count === 1 ? 'Encontró un horario compatible.' : `Encontró ${count} horarios compatibles.`,
  };
}

function readPlan(savedPlan: string | null | undefined): NegotiationPlan | null {
  try {
    return savedPlan ? JSON.parse(savedPlan) as NegotiationPlan : null;
  } catch {
    return null;
  }
}

export function describeSelectedWhatsAppSlot(slot: LeadNegotiationSlot, time = formatAppointmentTime(slot.inicio)) {
  return `Anoté que prefieres ${slot.fecha} a las ${time} en ${slot.sede}. Un asesor verificará el turno y preparará la propuesta.`;
}

function recoverSelectedSlot(text: string, previousAgendaPlan: string | null | undefined) {
  const slots = readPlan(previousAgendaPlan)?.slots;
  if (!Array.isArray(slots)) return undefined;
  const matches = slots.filter(isSlot).filter(slot =>
    describeSelectedWhatsAppSlot(slot) === text || describeSelectedWhatsAppSlot(slot, slot.inicio) === text,
  );
  return matches.length === 1 ? matches[0] : undefined;
}

export function describeWhatsAppNegotiation(decision: string | null, savedPlan: string | null, needsAdvisor: boolean,
  offer?: { id_opcion: number | null; id_propuesta: number | null; huella?: string | null; texto?: string; plan_agenda_anterior?: string | null }) {
  const plan = readPlan(savedPlan);

  const storedActivity = plan?.actividadAgente;
  const slotCount = Array.isArray(plan?.slots) ? plan.slots.length : 0;
  let actividad_agente: AgentActivity | undefined;
  if (storedActivity && activities.has(storedActivity.codigo) && typeof storedActivity.detalle === 'string') {
    actividad_agente = { codigo: storedActivity.codigo, detalle: storedActivity.detalle };
  } else if (decision === 'AGENDA' && slotCount > 0) {
    actividad_agente = describeAgendaActivity(slotCount);
  } else if (decision === 'CONFIRMAR' && plan?.confirmationLink === true) {
    actividad_agente = { codigo: 'CAP-05', detalle: 'Verificó la propuesta para compartir la prerreserva.' };
  }

  let accion_chatbot: string | undefined;
  if (decision === 'REVISION_PROPUESTA' || decision === 'REVISION_APLICADA') accion_chatbot = 'El paciente confirmó la propuesta revisada';
  else if (needsAdvisor) accion_chatbot = 'Derivó la conversación al asesor';
  else if (decision === 'MENU') accion_chatbot = 'Orientó al paciente';
  else if (decision === 'FUERA_DE_TEMA') accion_chatbot = 'Orientó al paciente sobre los temas que atiende';
  else if (decision === 'CATALOGO') accion_chatbot = 'Consultó el catálogo de atención';
  else if (decision === 'PRERRESERVA_SIN_ENLACE') accion_chatbot = 'Explicó cómo continuar con la prerreserva';
  else if (decision === 'RECHAZO') accion_chatbot = 'Registró la respuesta del paciente';
  else if (decision === 'VIGENCIA') accion_chatbot = 'Informó la vigencia de la propuesta';
  else if (decision === 'SEGUIMIENTO_CONTACTO') accion_chatbot = 'Coordinó el próximo contacto';
  else if (decision === 'SEGUIMIENTO_ENVIADO') accion_chatbot = 'Envió un seguimiento programado';
  else if (decision === 'AGENDA') accion_chatbot = slotCount ? 'Compartió alternativas de horario' : 'Continuó la consulta de horario';
  else if (decision === 'CONTRAOFERTA') {
    accion_chatbot = plan?.accionComercial === 'MEJORA_PROMOCION'
      ? 'Ofreció una mejora comercial' : 'Compartió otra propuesta vigente';
  } else if (decision === 'PRECIO') accion_chatbot = 'Informó la tarifa y las condiciones vigentes';
  else if (decision === 'DETALLES') accion_chatbot = 'Compartió los detalles de la propuesta';
  else if (decision === 'CONFIRMAR') accion_chatbot = 'Compartió la prerreserva';
  else if (decision === 'ACLARAR' || decision === 'ACLARAR_OFERTA') accion_chatbot = 'Pidió una aclaración';

  const horario = decision === 'ASESOR' && needsAdvisor
    ? isSlot(plan?.selectedSlot) ? plan.selectedSlot : recoverSelectedSlot(offer?.texto ?? '', offer?.plan_agenda_anterior)
    : undefined;
  const confirmedOffer = decision === 'CONFIRMAR' || (decision === 'ASESOR' && plan?.confirmedOffer === true) ||
    (decision === 'CONTRAOFERTA' && (plan?.confirmedOffer === true ||
      (storedActivity?.codigo === 'CAP-02' && offer?.texto?.startsWith('📅 Esta es la propuesta vigente para el horario que elegiste.'))));
  const isRevision = decision === 'REVISION_PROPUESTA' || decision === 'REVISION_APLICADA';
  const actualizacion = offer?.id_opcion && offer.id_propuesta && (horario || confirmedOffer || isRevision)
    ? { id_opcion: offer.id_opcion, id_propuesta: offer.id_propuesta, huella: offer.huella ?? undefined, horario,
      aplicar_revision: isRevision || undefined, aplicada: decision === 'REVISION_APLICADA' || undefined }
    : undefined;
  return { accion_chatbot, actividad_agente, actualizacion };
}
