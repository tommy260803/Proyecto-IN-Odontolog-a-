import { prisma } from '../db';
import { formatAppointmentTime } from '../utils/appointmentTime';
import { Prisma } from '@prisma/client';
import { getStoredServiciosRules } from '../routes/config.routes';
import { leadScheduleConstraints } from './leadGemini';
import { agendaConstraints, asksForAnotherProfessional, formatLeadAgenda, hasScheduleConflict, readAgendaPreference, searchLeadAgenda, type AgendaDimension, type AgendaSite } from './leadChatbotSchedule';
import { findLeadNegotiationSlots, type LeadNegotiationSlot } from './leadNegotiationSlots';
import { checkLeadProposalTerms, checkTransferOffer, loadTransferOffer, TransferError, transferIsolation } from './leadPayerTransfer';
import { normalizeChatbotText, type LeadChatbotAnalysis, type LeadOfferFollowUp } from './leadChatbotGroq';
import { assertWhatsAppContactAllowed, hasWhatsAppReview, lockWhatsAppControl, readWhatsAppControl,
  whatsAppControlTransaction, type WhatsAppJob, type WhatsAppOffer } from './leadWhatsAppInbox';
import { whatsAppChatId } from './leadWhatsApp';
import { describeAgendaActivity, describeSelectedWhatsAppSlot, type AgentActivity } from './leadNegotiationTrace';
import type { FollowUpFailure, FollowUpPreference } from './leadWhatsAppFollowUpWindow';
import { currentLeadTariff, readLeadChatbotCatalog } from './leadChatbotCatalog';

const menu = [
  '1. 🦷 Ver detalles de mi oferta',
  '2. 📅 Buscar otro horario, sede o especialista',
  '3. 💰 Consultar precio y promociones',
  '4. 👤 Hablar con un asesor',
  'Puedes escribir el número o contarme qué necesitas.',
].join('\n');

type TransferOffer = Awaited<ReturnType<typeof loadTransferOffer>>;
export type ChatbotReply = {
  text: string;
  decision: string;
  offer?: WhatsAppOffer;
  verifyOffer?: boolean;
  confirmationLink?: boolean;
  offerFollowUp?: LeadOfferFollowUp;
  slots?: LeadNegotiationSlot[];
  agendaPermission?: AgendaDimension;
  agendaSites?: AgendaSite[];
  agendaDeclined?: AgendaDimension[];
  agendaAdvisorOffer?: boolean;
  discountAdvisorOffer?: boolean;
  agendaExpansion?: AgendaDimension;
  agendaRetry?: boolean;
  agendaClarification?: boolean;
  selectedSlot?: LeadNegotiationSlot;
  confirmedOffer?: boolean;
  revisionOrigin?: WhatsAppOffer;
  review?: boolean;
  followUpPreference?: FollowUpPreference;
  followUpFailure?: FollowUpFailure;
  actividadAgente?: AgentActivity;
  accionComercial?: 'MEJORA_PROMOCION';
};

function offerReference(offer: TransferOffer): WhatsAppOffer {
  return {
    personId: offer.request.id_persona, requestId: offer.request.id_solicitud,
    proposalId: offer.proposal.id_propuesta, optionId: offer.option.id_opcion, fingerprint: offer.huella,
  };
}

export async function verifiedWhatsAppOffer(reference: WhatsAppOffer) {
  return prisma.$transaction(async tx => {
    const offer = await loadTransferOffer(tx, reference.personId, reference.requestId, reference.optionId);
    if (offer.huella !== reference.fingerprint || offer.proposal.id_propuesta !== reference.proposalId) {
      throw new TransferError('La oferta cambió desde que se envió.', 409);
    }
    await checkWhatsAppPromotion(tx, offer);
    await checkTransferOffer(tx, offer);
    return offer;
  }, transferIsolation);
}

export async function checkWhatsAppPromotion(tx: Prisma.TransactionClient, offer: TransferOffer) {
  const proposal = offer.proposal;
  if (proposal.id_promocion_lead && !await tx.promocionesLead.findFirst({
    where: { id_promocion: proposal.id_promocion_lead, activo: true,
      OR: [{ id_servicio: null }, { id_servicio: proposal.id_servicio }] },
  })) {
    throw new TransferError('La promoción ya no está activa.', 409, 'VIGENCIA_VENCIDA');
  }
}

export function describeOffer(offer: TransferOffer) {
  const { request, proposal, slot } = offer;
  const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });
  const expiry = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima', hour12: true });
  const start = slot.hora_inicio.toISOString().slice(11, 16);
  const end = slot.hora_fin.toISOString().slice(11, 16);
  return [
    `🦷 *Tratamiento:* ${request.Servicio?.nombre}`,
    `💰 *Tarifa:* S/ ${proposal.precio_cotizado.toFixed(2)}`,
    `📍 *Sede:* ${slot.Sede.nombre}`,
    `👤 *Especialista:* ${slot.Profesional.nombres} ${slot.Profesional.apellidos}`,
    `📅 *Horario:* ${date.format(slot.fecha)}, ${formatAppointmentTime(`${start} - ${end}`)} (Lima)`,
    `⏳ *Vigencia:* ${expiry.format(proposal.fecha_vigencia_hasta_utc_lead!)} (Lima)`,
    ...(proposal.promocion_aplicada ? [`🎁 *Promoción registrada:* ${proposal.promocion_aplicada}`] : []),
  ].join('\n');
}

const whatsappPromotionPrefix = 'Promoción WhatsApp (-';
type SlotSnapshot = Pick<LeadNegotiationSlot, 'id_disponibilidad' | 'id_sede' | 'id_profesional' | 'fecha' | 'inicio' | 'fin'>;

async function quoteCatalogSlot(reference: WhatsAppOffer, selected: SlotSnapshot, job: WhatsAppJob, applyPromotion = false) {
  try {
    return await prisma.$transaction(async tx => {
      await lockWhatsAppControl(tx, job);
      const control = await readWhatsAppControl(tx, job);
      if (control?.decision === 'CONTROL_ASESOR' || (control && job.id < control.id) ||
          await hasWhatsAppReview(tx, job, reference.requestId, job.id)) return;
      await assertWhatsAppContactAllowed(tx, job);
      const request = await tx.solicitudes.findFirst({
        where: { id_solicitud: reference.requestId, id_persona: reference.personId, archivada_lead_en: null,
          estado: { in: ['Abierta', 'En negociación'] },
          OR: [{ resultado_comercial_lead: 'PENDIENTE' }, { resultado_comercial_lead: null }],
          Persona: { autoriza_contacto: true, Etapa: { nombre: 'LEAD' } },
          Servicio: { activo: true } },
        select: { id_servicio: true, Persona: { select: { numero: true } } },
      });
      if (!request?.id_servicio || whatsAppChatId(request.Persona.numero) !== job.chat) return;
      const now = new Date();
      const slot = await tx.disponibilidad.findUnique({ where: { id_disponibilidad: selected.id_disponibilidad } });
      if (!slot || slot.id_sede !== selected.id_sede || slot.id_profesional !== selected.id_profesional ||
          slot.fecha.toISOString().slice(0, 10) !== selected.fecha || slot.hora_inicio.toISOString().slice(11, 16) !== selected.inicio ||
          slot.hora_fin.toISOString().slice(11, 16) !== selected.fin) {
        throw new TransferError('El horario cambió.', 409, 'HORARIO_NO_DISPONIBLE');
      }
      const startsAt = new Date(`${selected.fecha}T${slot.hora_inicio.toISOString().slice(11, 19)}-05:00`);
      const original = await loadTransferOffer(tx, reference.personId, reference.requestId, reference.optionId);
      if (original.huella !== reference.fingerprint || original.proposal.id_propuesta !== reference.proposalId || original.option.archivada_lead_en) return;
      await checkLeadProposalTerms(tx, original);
      await checkWhatsAppPromotion(tx, original);
      const originalExpiry = original.proposal.fecha_vigencia_hasta_utc_lead!;
      let expiry = originalExpiry < startsAt ? originalExpiry : startsAt;
      let price = original.proposal.precio_cotizado;
      let promotion = original.proposal.promocion_aplicada;
      let promotionId = original.proposal.id_promocion_lead;
      if (applyPromotion) {
        if (original.slot.id_disponibilidad !== slot.id_disponibilidad ||
            original.proposal.promocion_aplicada?.startsWith(whatsappPromotionPrefix)) return;
        await checkTransferOffer(tx, original);
        const tariff = await currentLeadTariff(tx, request.id_servicio, now);
        if (!tariff || tariff.precio.lte(0)) return;
        const max = getStoredServiciosRules()[request.id_servicio]?.descuentoMaximo;
        if (typeof max !== 'number' || !Number.isFinite(max) || max <= 0 || max > 100) return;
        const percent = new Prisma.Decimal(max).div(2).ceil();
        if (percent.gt(max)) return;
        price = tariff.precio.mul(new Prisma.Decimal(100).minus(percent)).div(100)
          .toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
        if (price.lte(0) || !price.lt(tariff.precio) || !price.lt(original.proposal.precio_cotizado)) return;
        promotion = `${whatsappPromotionPrefix}${percent}%)`;
        promotionId = null;
        if (tariff.fecha_fin && tariff.fecha_fin < expiry) expiry = tariff.fecha_fin;
      }
      if (expiry <= now) return;
      if (!applyPromotion && slot.id_disponibilidad === original.slot.id_disponibilidad) {
        await checkTransferOffer(tx, original);
        return original;
      }
      const existing = await tx.opciones.findFirst({
        where: { id_solicitud: reference.requestId, id_disponibilidad: slot.id_disponibilidad, archivada_lead_en: null,
          estado_respuesta: 'Pendiente', precio_ofrecido: price,
          Propuesta: { estado: 'Pendiente', promocion_aplicada: promotion, id_promocion_lead: promotionId,
            fecha_vigencia_hasta_utc_lead: expiry },
          ...(applyPromotion ? {} : { id_opcion: { in: (await tx.$queryRaw<{ id: number }[]>`
            SELECT id_opcion AS id FROM dbo.MensajesWhatsAppLead
            WHERE id_mensaje=${job.id} AND id_solicitud=${reference.requestId} AND tipo='ENTRADA'
              AND id_opcion IS NOT NULL AND decision='BORRADOR_PROPUESTA'`).map(row => row.id) } }) },
        select: { id_opcion: true }, orderBy: { id_opcion: 'desc' },
      });
      let optionId = existing?.id_opcion;
      if (!optionId) {
        const proposal = await tx.propuestasEconomicasLead.create({ data: {
          id_solicitud: reference.requestId, id_servicio: request.id_servicio, id_sede_lead: slot.id_sede,
          precio_cotizado: price, promocion_aplicada: promotion, fecha_vigencia_hasta_utc_lead: expiry,
          id_promocion_lead: promotionId,
        } });
        const option = await tx.opciones.create({ data: {
          id_solicitud: reference.requestId, id_disponibilidad: slot.id_disponibilidad, id_propuesta_lead: proposal.id_propuesta,
          precio_ofrecido: price, estado_respuesta: 'Pendiente',
          ofr_turno_lead: selected.inicio < '13:00' ? 'mañana' : selected.inicio < '18:00' ? 'tarde' : 'noche',
          id_preferencia_lead: original.option.id_preferencia_lead,
          pref_fecha_lead: original.option.pref_fecha_lead,
          pref_dia_semana_lead: original.option.pref_dia_semana_lead,
          pref_turno_lead: original.option.pref_turno_lead,
          pref_hora_inicio_lead: original.option.pref_hora_inicio_lead,
          pref_hora_fin_lead: original.option.pref_hora_fin_lead,
        } });
        optionId = option.id_opcion;
        if (!applyPromotion) await tx.$executeRaw`UPDATE dbo.MensajesWhatsAppLead
          SET id_opcion=${optionId}, id_propuesta=${proposal.id_propuesta},decision='BORRADOR_PROPUESTA'
          WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND tipo='ENTRADA' AND estado='PROCESANDO'`;
      }
      const offer = await loadTransferOffer(tx, reference.personId, reference.requestId, optionId);
      await checkTransferOffer(tx, offer);
      return offer;
    }, { ...transferIsolation, ...whatsAppControlTransaction });
  } catch (error) {
    if (!(error instanceof TransferError)) throw error;
    if (error.reason === 'HORARIO_NO_DISPONIBLE') throw error;
    return undefined;
  }
}


async function eligibleRegisteredOffer(reference: WhatsAppOffer, filter: {
  matches?: (tx: Prisma.TransactionClient, candidate: TransferOffer) => Promise<boolean>;
}) {
  return prisma.$transaction(async tx => {
    const options = await tx.opciones.findMany({
      where: {
        id_solicitud: reference.requestId, archivada_lead_en: null, id_opcion: { not: reference.optionId },
        Propuesta: { fecha_vigencia_hasta_utc_lead: { gt: new Date() }, estado: 'Pendiente' },
      },
      orderBy: [{ precio_ofrecido: 'asc' }, { id_opcion: 'desc' }],
    });
    for (const option of options) {
      try {
        const candidate = await loadTransferOffer(tx, reference.personId, reference.requestId, option.id_opcion);
        await checkTransferOffer(tx, candidate);
        await checkWhatsAppPromotion(tx, candidate);
        if (filter.matches && !await filter.matches(tx, candidate)) continue;
        return candidate;
      } catch (error) {
        if (!(error instanceof TransferError)) throw error;
      }
    }
  }, transferIsolation);
}

export async function recheckWhatsAppSlots(offer: WhatsAppOffer, slots: LeadNegotiationSlot[]) {
  const current = await findLeadNegotiationSlots(prisma, offer.requestId, { intencion: 'HORARIO' }, {
    constraints: leadScheduleConstraints([]), excludedSites: [], excludedProfessionals: [],
    slotIds: slots.map(slot => slot.id_disponibilidad),
    limit: 5,
  });
  return slots.every(slot => current.some(row =>
    row.id_disponibilidad === slot.id_disponibilidad && row.fecha === slot.fecha && row.inicio === slot.inicio &&
    row.fin === slot.fin && row.id_sede === slot.id_sede && row.id_profesional === slot.id_profesional));
}

async function readWhatsAppAgenda(
  reference: WhatsAppOffer, analysis: LeadChatbotAnalysis, patientMessages: string[],
  agendaReferences: (LeadNegotiationSlot[] | undefined)[],
) {
  const [sites, professionals, baseOption, request] = await Promise.all([
    prisma.sedes.findMany({ where: { activo: true }, select: { id_sede: true, nombre: true, direccion: true }, orderBy: { id_sede: 'asc' } }),
    prisma.profesionales.findMany({ where: { activo: true }, select: { id_profesional: true, nombres: true, apellidos: true } }),
    prisma.opciones.findFirst({
      where: { id_opcion: reference.optionId, id_solicitud: reference.requestId },
      select: { id_disponibilidad: true, Disponibilidad: { select: { id_sede: true, id_profesional: true,
        fecha: true, hora_inicio: true, hora_fin: true } } },
    }),
    prisma.solicitudes.findUnique({ where: { id_solicitud: reference.requestId }, select: { id_servicio: true, id_sede_interes_lead: true } }),
  ]);
  const now = new Date();
  const preferences = await prisma.personaPreferencias.findMany({
    where: { id_persona: reference.personId, fecha_inicio: { lte: now }, AND: [
      { OR: [{ fecha_fin: null }, { fecha_fin: { gt: now } }] },
      { OR: [{ id_servicio_interes: null }, ...(request?.id_servicio ? [{ id_servicio_interes: request.id_servicio }] : [])] },
    ] },
    orderBy: [{ fecha_inicio: 'desc' }, { id_preferencia: 'desc' }], take: 20,
    select: { sede_preferida: true, profesional_preferido: true },
  });
  const original = baseOption?.Disponibilidad;
  const originalHour = original?.hora_inicio.getUTCHours();
  const originalShift = originalHour === undefined ? undefined :
    originalHour < 13 ? 'mañana' : originalHour < 18 ? 'tarde' : 'noche';
  const constraints = agendaConstraints(patientMessages, originalShift);
  const siteCatalog = sites.map(s => ({ id: s.id_sede, name: s.nombre, address: s.direccion ?? undefined }));
  const registeredSite = preferences.find(item => item.sede_preferida)?.sede_preferida;
  const preferredSite = registeredSite && readAgendaPreference([registeredSite], siteCatalog, 'sede').item;
  const baseSite = (preferredSite || siteCatalog.find(s => s.id === request?.id_sede_interes_lead))?.id ?? original?.id_sede;
  const site = readAgendaPreference(patientMessages, siteCatalog, 'sede', baseSite, analysis.sede, agendaReferences);
  const professionalCatalog = professionals.map(p => ({
    id: p.id_profesional, name: p.nombres + ' ' + p.apellidos,
    aliases: [p.nombres, p.nombres.split(' ')[0], p.apellidos],
  }));
  const registeredProfessional = preferences.find(item => item.profesional_preferido)?.profesional_preferido;
  const preferredProfessional = registeredProfessional &&
    readAgendaPreference([registeredProfessional], professionalCatalog, 'especialista').item;
  // The specialist on the original card is only a reference for “otro especialista”.
  const professional = readAgendaPreference(patientMessages, professionalCatalog,
    'especialista', (preferredProfessional || undefined)?.id, analysis.profesional, agendaReferences, original?.id_profesional);
  return { site, professional, constraints, siteCatalog, baseOption };
}

// CAP-02 busca alternativas compatibles con las preferencias del paciente y comprueba la disponibilidad.
export async function scheduleReply(
  reference: WhatsAppOffer, analysis: LeadChatbotAnalysis, patientMessages: string[], permission?: AgendaDimension,
  agendaReferences: (LeadNegotiationSlot[] | undefined)[] = [],
  pending?: { sites?: AgendaSite[]; declined?: AgendaDimension[] },
): Promise<ChatbotReply> {
  const { site, professional, constraints, siteCatalog, baseOption } =
    await readWhatsAppAgenda(reference, analysis, patientMessages, agendaReferences);
  if (constraints.needsTimeClarification) return {
    decision: 'AGENDA', offer: reference, agendaClarification: true,
    text: 'Puedo revisar opciones por día de la semana y turno. ¿Qué día y franja te sirven? Si necesitas una hora exacta, también puedes pedirme un asesor.',
  };
  if (site.ambiguous || professional.ambiguous) return {
    decision: 'AGENDA', offer: reference, agendaClarification: true,
    text: site.ambiguous ? '¿En qué sede prefieres que busque? Indícame el nombre de la sede.'
      : '¿Con qué especialista prefieres atenderte? Indícame su nombre y apellido.',
  };
  const latest = patientMessages.at(-1) ?? '';
  const shown = agendaReferences.at(-1) ?? [];
  if (shown.length && asksForAnotherProfessional(latest) && !readAgendaPreference([latest], siteCatalog, 'sede', undefined, analysis.sede).item &&
      (!site.item || !shown.every(slot => slot.id_sede === site.item?.id))) {
    return {
      decision: 'AGENDA', offer: reference, agendaClarification: true,
      text: 'Claro, puedo buscar otro especialista. ¿En qué sede prefieres que busque?',
    };
  }

  const result = await searchLeadAgenda({
    site, professional, constraints, day: analysis.dia, shift: analysis.turno, messages: patientMessages, permission,
    sites: siteCatalog, offeredSiteIds: pending?.sites?.map(s => s.id), declined: pending?.declined,
  }, query => findLeadNegotiationSlots(prisma, reference.requestId, { intencion: 'HORARIO' }, {
    siteId: query.siteId, professionalId: query.professionalId, constraints: query.constraints,
    excludedSites: query.excludedSiteId ? [...site.excluded, query.excludedSiteId] : site.excluded,
    excludedProfessionals: query.excludedProfessionalId ? [...professional.excluded, query.excludedProfessionalId] : professional.excluded,
    excludedSlotId: baseOption?.id_disponibilidad, limit: 5,
    preferredAppointment: baseOption?.Disponibilidad && {
      date: baseOption.Disponibilidad.fecha.toISOString().slice(0, 10),
      start: baseOption.Disponibilidad.hora_inicio.toISOString().slice(11, 16),
      end: baseOption.Disponibilidad.hora_fin.toISOString().slice(11, 16),
    },
  }));
  if (!result.recommendation) return {
    decision: 'AGENDA', offer: reference, agendaPermission: result.permission, agendaClarification: true,
    agendaSites: siteCatalog.filter(s => result.offeredSiteIds?.includes(s.id)),
    agendaAdvisorOffer: result.needsAdvisorOffer, agendaDeclined: pending?.declined,
    actividadAgente: describeAgendaActivity(0), text: result.notice,
  };
  const formatted = formatLeadAgenda(result.slots, result.recommendation, result.notice);
  return {
    decision: 'AGENDA', offer: reference, agendaExpansion: permission, agendaSites: pending?.sites,
    agendaDeclined: pending?.declined,
    actividadAgente: describeAgendaActivity(formatted.slots.length), ...formatted,
  };
}

async function lookForNewOffer(
  offer: WhatsAppOffer, analysis: LeadChatbotAnalysis, messages: string[],
  references: (LeadNegotiationSlot[] | undefined)[],
): Promise<ChatbotReply> {
  const { site, professional, constraints } = await readWhatsAppAgenda(offer, analysis, messages, references);
  const candidate = site.ambiguous || professional.ambiguous || constraints.needsTimeClarification ? undefined :
    await eligibleRegisteredOffer(offer, {
      matches: async (tx, registered) => (await findLeadNegotiationSlots(tx, offer.requestId, {
        intencion: 'HORARIO', dia: analysis.dia, turno: analysis.turno,
      }, {
        constraints, siteId: site.item?.id, professionalId: professional.item?.id,
        excludedSites: site.excluded, excludedProfessionals: professional.excluded,
        slotIds: [registered.slot.id_disponibilidad],
      })).length > 0,
    });
  if (candidate) return {
    decision: 'CONTRAOFERTA', offer: offerReference(candidate), verifyOffer: true,
    offerFollowUp: 'prerreserva',
    text: 'Encontré esta propuesta vigente para el mismo tratamiento.\n\n' + describeOffer(candidate) +
      '\n\n¿Quieres continuar con la prerreserva de esta propuesta?',
  };
  return {
    decision: 'AGENDA', offer, offerFollowUp: 'horario',
    text: 'No encontré una cotización vigente que coincida con tus preferencias. ¿Quieres que revise otros horarios para este tratamiento?',
  };
}

export function replyForUnavailableOffer(offer: WhatsAppOffer, error: TransferError): ChatbotReply {
  if (error.reason === 'VIGENCIA_VENCIDA') return {
    decision: 'VIGENCIA', offer, offerFollowUp: 'nueva_oferta',
    text: 'Hola 👋 El precio o la promoción de esa propuesta ya no está vigente. ¿Quieres que revise si tenemos una oferta vigente para el mismo tratamiento?',
  };
  if (error.reason === 'HORARIO_NO_DISPONIBLE') return {
    decision: 'VIGENCIA', offer, offerFollowUp: 'horario',
    text: 'La tarifa de esta propuesta sigue vigente, pero el horario que te ofrecimos ya no está disponible. ¿Quieres que busque otro horario en la misma sede?',
  };
  return {
    decision: 'VIGENCIA', offer, offerFollowUp: 'nueva_oferta',
    text: 'Las condiciones de la propuesta cambiaron. ¿Quieres que busque otra propuesta vigente para tu tratamiento?',
  };
}

// Selecciona la respuesta y la acción comercial según la intención interpretada y los datos comprobados del sistema.
type ReplyInput = {
  offer: WhatsAppOffer;
  analysis: LeadChatbotAnalysis;
  patientMessages: string[];
  menuWasShown: boolean;
  selectedSlot?: LeadNegotiationSlot;
  publicReservation: boolean;
  agendaExpansion?: AgendaDimension;
  retryAgenda?: boolean;
  agendaReferences?: (LeadNegotiationSlot[] | undefined)[];
  pendingAgenda?: { sites?: AgendaSite[]; declined?: AgendaDimension[] };
  checkNewOffer?: boolean;
  revisionOrigin?: WhatsAppOffer;
  job?: WhatsAppJob;
};

export async function prepareChatbotReply(input: ReplyInput): Promise<ChatbotReply> {
  const { analysis, offer } = input;
  if (['ASESOR', 'RECHAZO', 'FUERA_DE_TEMA'].includes(analysis.intent)) return prepareCommercialReply(input);
  const catalog = await readLeadChatbotCatalog(offer, analysis);
  const catalogActivity: AgentActivity | undefined = catalog.activity
    ? { codigo: 'CAP-02', detalle: 'Consultó las sedes y los especialistas registrados en el catálogo.' } : undefined;
  if (catalog.differentService || catalog.needsSite || (analysis.intent === 'CATALOGO' &&
      !analysis.temas?.some(topic => ['DETALLES', 'PRECIO', 'VIGENCIA'].includes(topic)))) {
    const asksToChange = catalog.differentService && ['CONFIRMAR', 'AGENDA'].includes(analysis.intent);
    return {
      decision: 'CATALOGO', offer, actividadAgente: catalogActivity,
      text: [catalog.text, asksToChange ? 'Tu propuesta actual corresponde a otro tratamiento. Si quieres abrir una solicitud para este servicio, puedes pedirme un asesor.' :
        'Si quieres, dime qué sede o especialista prefieres y puedo revisar horarios para el tratamiento de tu propuesta.'].filter(Boolean).join('\n\n'),
    };
  }
  const reply = await prepareCommercialReply(input);
  return catalog.text ? {
    ...reply, actividadAgente: reply.actividadAgente ?? catalogActivity,
    text: `${catalog.text}\n\n${reply.text}`,
  } : reply;
}

async function prepareCommercialReply(input: ReplyInput): Promise<ChatbotReply> {
  const { offer, analysis } = input;
  if (analysis.intent === 'FUERA_DE_TEMA') {
    return {
      decision: 'FUERA_DE_TEMA', offer,
      text: 'Soy el asistente virtual de NexoSalud Dental. Puedo ayudarte con tu propuesta, precios, horarios y prerreserva, o ponerte en contacto con un asesor de la clínica. Si quieres, escribe *menú* para ver las opciones.',
    };
  }
  if (input.checkNewOffer) return lookForNewOffer(offer, analysis, input.patientMessages, input.agendaReferences ?? []);
  if (input.selectedSlot) {
    if (!await recheckWhatsAppSlots(offer, [input.selectedSlot])) {
      const refreshed = await scheduleReply(offer, analysis, input.patientMessages, input.agendaExpansion, input.agendaReferences, input.pendingAgenda);
      return { ...refreshed, text: 'El horario que elegiste ya no está disponible. Volví a consultar la agenda.\n\n' + refreshed.text };
    }
    let candidate: TransferOffer | undefined;
    try {
      if (input.job) candidate = await quoteCatalogSlot(offer, input.selectedSlot, input.job);
    } catch (error) {
      if (!(error instanceof TransferError) || error.reason !== 'HORARIO_NO_DISPONIBLE') throw error;
      const refreshed = await scheduleReply(offer, analysis, input.patientMessages, input.agendaExpansion, input.agendaReferences, input.pendingAgenda);
      return { ...refreshed, text: 'Ese horario cambió mientras lo revisaba.\n\n' + refreshed.text };
    }
    if (candidate) return {
      decision: 'CONTRAOFERTA', offer: offerReference(candidate), verifyOffer: true, offerFollowUp: 'prerreserva',
      revisionOrigin: input.revisionOrigin ?? (candidate.huella !== offer.fingerprint ? offer : undefined),
      actividadAgente: { codigo: 'CAP-02', detalle: 'Encontró y verificó una propuesta vigente para el horario elegido.' },
      text: '📅 *Propuesta revisada*\n\n' + describeOffer(candidate) +
        '\n\n¿Confirmas esta propuesta para continuar con la prerreserva o quieres cambiar algo más?',
    };
    return {
      decision: 'ASESOR', offer, review: true, selectedSlot: input.selectedSlot,
      text: describeSelectedWhatsAppSlot(input.selectedSlot),
    };
  }
  const latest = input.patientMessages.at(-1) ?? '';
  const agenda = analysis.intent === 'AGENDA' || input.agendaExpansion || input.retryAgenda ||
    (['ACLARAR', 'CONFIRMAR', 'MENU', 'RECHAZO'].includes(analysis.intent) && hasScheduleConflict(latest) &&
      !/\b(?:no me interesa|no quiero continuar)\b/.test(normalizeChatbotText(latest)));
  const topics = new Set(analysis.temas);
  if (analysis.intent === 'ASESOR') return { decision: 'ASESOR', offer, review: true,
    text: '👤 Voy a dejar tu consulta a un asesor de NexoSalud. Por favor, espera un momento. Continuará contigo por este chat cuando esté disponible.' };
  if (analysis.intent === 'RECHAZO' && !agenda) return { decision: 'RECHAZO', offer,
    text: 'Gracias por avisarnos. Dejé registrada tu respuesta. Si más adelante quieres revisar otras opciones, puedes escribirme por aquí.' };
  if (analysis.intent === 'SEGUIMIENTO' && !agenda) return { decision: 'ACLARAR', offer,
    text: '¿Quieres buscar otro horario para tu cita o que te escribamos por WhatsApp en otro momento?' };
  if (agenda) {
    if (!input.agendaExpansion && !analysis.dia && !analysis.turno && !analysis.sede && !analysis.profesional &&
        /^(?:[1-4][.)]?|otro horario|cambiar horario|horarios)$/i.test(input.patientMessages.at(-1)?.trim() ?? '')) {
      return { decision: 'AGENDA', offer, agendaClarification: true, text: '📅 ¿Qué día, turno o sede te acomodaría mejor?' };
    }
    const schedule = await scheduleReply(offer, analysis, input.patientMessages, input.agendaExpansion, input.agendaReferences, input.pendingAgenda);
    if (!topics.has('PRECIO') && !topics.has('DETALLES') && !topics.has('VIGENCIA')) return schedule;
    try {
      const verified = await verifiedWhatsAppOffer(offer);
      return { ...schedule, text: `${offerInformation(verified, topics)}\n\n${schedule.text}` };
    } catch (error) {
      if (!(error instanceof TransferError)) throw error;
      return { ...schedule, text: 'Revisaré la tarifa y la vigencia para el horario que elijas.\n\n' + schedule.text };
    }
  }
  if (analysis.intent === 'MENU' && !topics.has('DETALLES') && !topics.has('PRECIO') && !topics.has('VIGENCIA')) {
    const opening = analysis.tono === 'agradecimiento' ? '¡Con gusto!' : analysis.tono === 'saludo' ? '¡Hola! 👋' : 'Claro, puedo ayudarte.';
    return {
      decision: 'MENU', offer,
      text: input.menuWasShown
        ? `${opening} ¿Qué te gustaría revisar de la propuesta?`
        : `${opening} ¿Qué necesitas sobre tu propuesta?\n\n${menu}`,
    };
  }
  if (analysis.intent === 'ACLARAR' && !topics.has('DETALLES') && !topics.has('PRECIO') && !topics.has('VIGENCIA')) {
    return { decision: 'ACLARAR', offer, text: '¿Qué te gustaría revisar de la propuesta: el precio, el horario o la sede?' };
  }

  let verified: TransferOffer;
  try {
    verified = await verifiedWhatsAppOffer(offer);
  } catch (error) {
    if (!(error instanceof TransferError)) throw error;
    if (analysis.intent === 'CONFIRMAR' && error.reason === 'HORARIO_NO_DISPONIBLE') {
      const alternatives = await scheduleReply(offer, analysis, input.patientMessages, undefined, input.agendaReferences);
      return { ...alternatives, text: 'El horario de esa propuesta ya no está disponible.\n\n' + alternatives.text };
    }
    return replyForUnavailableOffer(offer, error);
  }
  if (analysis.intent === 'DETALLES' || analysis.intent === 'PRECIO' || analysis.intent === 'VIGENCIA') topics.add(analysis.intent);
  // CAP-03 cotiza una mejora autorizada sobre la tarifa vigente del catálogo.
  if (topics.has('PRECIO') && analysis.buscaMenorPrecio) {
    const alreadyDiscounted = verified.proposal.promocion_aplicada?.startsWith(whatsappPromotionPrefix);
    const slot = verified.slot;
    let candidate: TransferOffer | undefined;
    if (!alreadyDiscounted && input.job) {
      try {
        candidate = await quoteCatalogSlot(offer, {
          id_disponibilidad: slot.id_disponibilidad, id_sede: slot.id_sede, id_profesional: slot.id_profesional,
          fecha: slot.fecha.toISOString().slice(0, 10), inicio: slot.hora_inicio.toISOString().slice(11, 16),
          fin: slot.hora_fin.toISOString().slice(11, 16),
        }, input.job, true);
      } catch (error) {
        if (!(error instanceof TransferError)) throw error;
        return replyForUnavailableOffer(offer, error);
      }
    }
    if (candidate) return {
      decision: 'CONTRAOFERTA', offer: offerReference(candidate), verifyOffer: true,
      accionComercial: 'MEJORA_PROMOCION', offerFollowUp: 'prerreserva',
      revisionOrigin: input.revisionOrigin ?? offer,
      actividadAgente: { codigo: 'CAP-03', detalle: 'Registró una cotización con la mitad del descuento máximo del tratamiento, redondeada al entero superior.' },
      text: '🎁 *Propuesta revisada con descuento*\n\n' + describeOffer(candidate) +
        (topics.has('DETALLES') && candidate.request.Servicio?.descripcion ? `\n\n${candidate.request.Servicio.descripcion}` : '') +
        '\n\n¿Confirmas esta propuesta para continuar con la prerreserva o quieres cambiar algo más?',
    };
    return {
      decision: 'PRECIO', offer, verifyOffer: true, discountAdvisorOffer: true,
      actividadAgente: { codigo: 'CAP-03', detalle: 'La mejora adicional de tarifa requiere revisión del asesor.' },
      text: offerInformation(verified, topics) + '\n\n¿Quieres que un asesor revise si es posible darte un descuento adicional?',
    };
  }
  if (analysis.intent === 'CONFIRMAR') {
    const origin = input.revisionOrigin;
    if (origin && origin.fingerprint !== offer.fingerprint) return {
      decision: 'REVISION_PROPUESTA', offer, revisionOrigin: origin, verifyOffer: true, review: true,
      actividadAgente: { codigo: 'CAP-05', detalle: 'Registró la conformidad del paciente con la propuesta revisada.' },
      text: 'Ya registré tu confirmación de la propuesta revisada. Estamos preparando tu nuevo enlace de prerreserva.',
    };
    const details = topics.has('DETALLES') && verified.request.Servicio?.descripcion
      ? `\n\n${verified.request.Servicio.descripcion}` : '';
    const summary = '¡Perfecto! 😊 Estas son las condiciones de tu propuesta.\n\n' + describeOffer(verified) + details;
    return input.publicReservation ? {
      decision: 'CONFIRMAR', offer, verifyOffer: true, confirmationLink: true,
      text: summary + '\n\nAbre el formulario para revisar tus datos y autorizar la reserva. Tu reserva se registra al confirmar el formulario.',
    } : {
      decision: 'PRERRESERVA_SIN_ENLACE', offer, verifyOffer: true,
      text: summary + '\n\nEl formulario de prerreserva todavía no está disponible para abrirlo desde tu celular. Si quieres que te ayuden a continuar por aquí, escribe *asesor*.',
    };
  }
  if (!topics.size) topics.add('DETALLES');
  return {
    decision: topics.has('VIGENCIA') ? 'VIGENCIA' : topics.has('DETALLES') ? 'DETALLES' : 'PRECIO',
    offer, verifyOffer: true, offerFollowUp: 'prerreserva',
    text: offerInformation(verified, topics) + '\n\n¿Quieres continuar con la prerreserva? También puedes preguntarme por cualquier otra condición de la propuesta.',
  };
}

function offerInformation(offer: TransferOffer, topics: ReadonlySet<string>) {
  if (topics.has('DETALLES')) return describeOffer(offer) +
    (offer.request.Servicio?.descripcion ? `\n\n*Sobre el tratamiento:* ${offer.request.Servicio.descripcion}` : '');
  const sections = [];
  if (topics.has('VIGENCIA')) sections.push('Tu propuesta sigue vigente y el horario ofrecido está disponible.');
  if (topics.has('PRECIO')) {
    sections.push(`💰 *Tarifa de tu propuesta:* S/ ${offer.proposal.precio_cotizado.toFixed(2)}.`);
    if (offer.proposal.promocion_aplicada) sections.push(`🎁 *Promoción registrada:* ${offer.proposal.promocion_aplicada}`);
  }
  return sections.join('\n');
}
