import { prisma } from '../db';
import type { Prisma } from '@prisma/client';
import { leadScheduleConstraints } from './leadGemini';
import { agendaConstraints, asksForAnotherProfessional, formatLeadAgenda, hasScheduleConflict, readAgendaPreference, searchLeadAgenda, type AgendaDimension } from './leadChatbotSchedule';
import { findLeadNegotiationSlots, type LeadNegotiationSlot } from './leadNegotiationSlots';
import { checkTransferOffer, loadTransferOffer, TransferError, transferIsolation } from './leadPayerTransfer';
import { normalizeChatbotText, type LeadChatbotAnalysis, type LeadOfferFollowUp } from './leadChatbotGroq';
import { type WhatsAppOffer } from './leadWhatsAppInbox';
import { describeAgendaActivity, describeSelectedWhatsAppSlot, type AgentActivity } from './leadNegotiationTrace';

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
  agendaExpansion?: AgendaDimension;
  agendaRetry?: boolean;
  agendaClarification?: boolean;
  selectedSlot?: LeadNegotiationSlot;
  confirmedOffer?: boolean;
  review?: boolean;
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

async function checkWhatsAppPromotion(tx: Prisma.TransactionClient, offer: TransferOffer) {
  const proposal = offer.proposal;
  if (proposal.id_promocion_lead && !await tx.promocionesLead.findFirst({
    where: { id_promocion: proposal.id_promocion_lead, activo: true,
      OR: [{ id_servicio: null }, { id_servicio: proposal.id_servicio }] },
  })) {
    throw new TransferError('La promoción ya no está activa.', 409, 'VIGENCIA_VENCIDA');
  }
}

function describeOffer(offer: TransferOffer) {
  const { request, proposal, slot } = offer;
  const date = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'UTC' });
  const expiry = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Lima' });
  return [
    `🦷 *Tratamiento:* ${request.Servicio?.nombre}`,
    `💰 *Tarifa:* S/ ${proposal.precio_cotizado.toFixed(2)}`,
    `📍 *Sede:* ${slot.Sede.nombre}`,
    `👤 *Especialista:* ${slot.Profesional.nombres} ${slot.Profesional.apellidos}`,
    `📅 *Horario:* ${date.format(slot.fecha)}, ${slot.hora_inicio.toISOString().slice(11, 16)}–${slot.hora_fin.toISOString().slice(11, 16)} (Lima)`,
    `⏳ *Vigencia:* ${expiry.format(proposal.fecha_vigencia_hasta_utc_lead!)} (Lima)`,
    ...(proposal.promocion_aplicada ? [`🎁 *Promoción registrada:* ${proposal.promocion_aplicada}`] : []),
  ].join('\n');
}

async function eligibleRegisteredOffer(reference: WhatsAppOffer, filter: {
  lowerThan?: number; slotId?: number;
  matches?: (tx: Prisma.TransactionClient, candidate: TransferOffer) => Promise<boolean>;
}) {
  return prisma.$transaction(async tx => {
    const options = await tx.opciones.findMany({
      where: {
        id_solicitud: reference.requestId, archivada_lead_en: null, id_opcion: { not: reference.optionId },
        ...(filter.lowerThan !== undefined ? { precio_ofrecido: { lt: filter.lowerThan } } : {}),
        ...(filter.slotId !== undefined ? { id_disponibilidad: filter.slotId } : {}),
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
  const [sites, professionals, baseOption] = await Promise.all([
    prisma.sedes.findMany({ where: { activo: true }, select: { id_sede: true, nombre: true } }),
    prisma.profesionales.findMany({ where: { activo: true }, select: { id_profesional: true, nombres: true, apellidos: true } }),
    prisma.opciones.findFirst({
      where: { id_opcion: reference.optionId, id_solicitud: reference.requestId },
      select: { id_disponibilidad: true, Disponibilidad: { select: { id_sede: true, id_profesional: true, hora_inicio: true } } },
    }),
  ]);
  const original = baseOption?.Disponibilidad;
  const originalHour = original?.hora_inicio.getUTCHours();
  const originalShift = originalHour === undefined ? undefined :
    originalHour < 13 ? 'mañana' : originalHour < 18 ? 'tarde' : 'noche';
  const constraints = agendaConstraints(patientMessages, originalShift);
  const siteCatalog = sites.map(s => ({ id: s.id_sede, name: s.nombre }));
  const site = readAgendaPreference(patientMessages, siteCatalog, 'sede', original?.id_sede, analysis.sede, agendaReferences);
  const professional = readAgendaPreference(patientMessages, professionals.map(p => ({
    id: p.id_profesional, name: p.nombres + ' ' + p.apellidos,
    aliases: [p.nombres, p.nombres.split(' ')[0], p.apellidos],
  })), 'especialista', original?.id_profesional, analysis.profesional, agendaReferences);
  return { site, professional, constraints, siteCatalog, baseOption };
}

export async function scheduleReply(
  reference: WhatsAppOffer, analysis: LeadChatbotAnalysis, patientMessages: string[], permission?: AgendaDimension,
  agendaReferences: (LeadNegotiationSlot[] | undefined)[] = [],
): Promise<ChatbotReply> {
  const { site, professional, constraints, siteCatalog, baseOption } =
    await readWhatsAppAgenda(reference, analysis, patientMessages, agendaReferences);
  if (constraints.needsTimeClarification) return {
    decision: 'AGENDA', offer: reference, agendaClarification: true,
    text: 'Para revisar la fecha o la hora exacta que indicaste, puedo derivarte a un asesor. Si ahora te sirve cualquier horario, dímelo y puedo buscar por día de la semana o turno.',
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
  }, query => findLeadNegotiationSlots(prisma, reference.requestId, { intencion: 'HORARIO' }, {
    siteId: query.siteId, professionalId: query.professionalId, constraints: query.constraints,
    excludedSites: query.excludedSiteId ? [...site.excluded, query.excludedSiteId] : site.excluded,
    excludedProfessionals: query.excludedProfessionalId ? [...professional.excluded, query.excludedProfessionalId] : professional.excluded,
    excludedSlotId: baseOption?.id_disponibilidad, limit: 5,
  }));
  if (!('recommendation' in result) || !result.recommendation) return {
    decision: 'AGENDA', offer: reference, agendaPermission: result.permission, agendaClarification: true,
    actividadAgente: describeAgendaActivity(0), text: result.notice,
  };
  const formatted = formatLeadAgenda(result.slots, result.recommendation, result.notice);
  return {
    decision: 'AGENDA', offer: reference, agendaExpansion: permission,
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
    text: 'Encontré esta propuesta vigente para el mismo tratamiento.\n\n' + describeOffer(candidate) +
      '\n\nSi te interesa, responde a este mensaje.',
  };
  return {
    decision: 'ASESOR', offer, review: true,
    text: 'No encontré una propuesta vigente que respete tus preferencias. 👤 Un asesor revisará contigo las condiciones disponibles.',
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
    decision: 'ASESOR', offer, review: true,
    text: 'Las condiciones de esa oferta necesitan revisión. Un asesor podrá confirmarte una propuesta vigente.',
  };
}

export async function prepareChatbotReply(input: {
  offer: WhatsAppOffer;
  analysis: LeadChatbotAnalysis;
  patientMessages: string[];
  menuWasShown: boolean;
  selectedSlot?: LeadNegotiationSlot;
  publicReservation: boolean;
  agendaExpansion?: AgendaDimension;
  retryAgenda?: boolean;
  agendaReferences?: (LeadNegotiationSlot[] | undefined)[];
  checkNewOffer?: boolean;
}): Promise<ChatbotReply> {
  const { offer, analysis } = input;
  if (input.checkNewOffer) return lookForNewOffer(offer, analysis, input.patientMessages, input.agendaReferences ?? []);
  if (input.selectedSlot) {
    if (!await recheckWhatsAppSlots(offer, [input.selectedSlot])) {
      const refreshed = await scheduleReply(offer, analysis, input.patientMessages, input.agendaExpansion, input.agendaReferences);
      return { ...refreshed, text: 'El horario que elegiste ya no está disponible. Volví a consultar la agenda.\n\n' + refreshed.text };
    }
    const candidate = await eligibleRegisteredOffer(offer, { slotId: input.selectedSlot.id_disponibilidad });
    if (candidate) return {
      decision: 'CONTRAOFERTA', offer: offerReference(candidate), verifyOffer: true, confirmedOffer: true,
      actividadAgente: { codigo: 'CAP-02', detalle: 'Encontró y verificó una propuesta vigente para el horario elegido.' },
      text: '📅 Esta es la propuesta vigente para el horario que elegiste.\n\n' + describeOffer(candidate),
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
  if (!agenda && (analysis.intent === 'ASESOR' || analysis.intent === 'RECHAZO' || analysis.intent === 'SEGUIMIENTO')) {
    const text = {
      ASESOR: '👤 Dejaré tu mensaje al asesor para que continúe contigo por este chat.',
      RECHAZO: 'Gracias por avisarnos. Dejaré registrada tu respuesta para el asesor.',
      SEGUIMIENTO: 'Dejaré tu solicitud al asesor para que coordine contigo cuándo retomar la conversación.',
    };
    return { decision: analysis.intent, offer, review: true, text: text[analysis.intent] };
  }
  if (agenda) {
    if (!input.agendaExpansion && !analysis.dia && !analysis.turno && !analysis.sede && !analysis.profesional &&
        /^(?:[1-4][.)]?|otro horario|cambiar horario|horarios)$/i.test(input.patientMessages.at(-1)?.trim() ?? '')) {
      return { decision: 'AGENDA', offer, agendaClarification: true, text: '📅 ¿Qué día, turno o sede te acomodaría mejor?' };
    }
    return scheduleReply(offer, analysis, input.patientMessages, input.agendaExpansion, input.agendaReferences);
  }
  if (analysis.intent === 'MENU') {
    const opening = analysis.tono === 'agradecimiento' ? '¡Con gusto!' : analysis.tono === 'saludo' ? '¡Hola! 👋' : 'Claro, puedo ayudarte.';
    return {
      decision: 'MENU', offer,
      text: input.menuWasShown
        ? `${opening} ¿Qué te gustaría revisar de la propuesta?`
        : `${opening} ¿Qué necesitas sobre tu propuesta?\n\n${menu}`,
    };
  }
  if (analysis.intent === 'ACLARAR') {
    return { decision: 'ACLARAR', offer, text: '¿Qué te gustaría revisar de la propuesta: el precio, el horario o la sede?' };
  }

  let verified: TransferOffer;
  try {
    verified = await verifiedWhatsAppOffer(offer);
  } catch (error) {
    if (!(error instanceof TransferError)) throw error;
    return replyForUnavailableOffer(offer, error);
  }
  if (analysis.intent === 'VIGENCIA') return {
    decision: 'VIGENCIA', offer, verifyOffer: true, offerFollowUp: 'prerreserva',
    text: 'Sí, tu propuesta sigue vigente y el horario todavía está disponible. ¿Quieres continuar con la prerreserva?',
  };
  if (analysis.intent === 'PRECIO') {
    const price = `💰 *Tarifa vigente:* S/ ${verified.proposal.precio_cotizado.toFixed(2)}.`;
    if (!analysis.buscaMenorPrecio) {
      const promotion = verified.proposal.promocion_aplicada;
      return {
        decision: 'PRECIO', offer, verifyOffer: true,
        text: price + (promotion ? `\n🎁 *Promoción registrada:* ${promotion}.` : '') +
          '\n\nSi quieres revisar otra condición de la oferta, cuéntame.',
      };
    }
    const candidate = await eligibleRegisteredOffer(offer, { lowerThan: Number(verified.proposal.precio_cotizado) });
    if (candidate) return {
      decision: 'CONTRAOFERTA', offer: offerReference(candidate), verifyOffer: true,
      accionComercial: 'MEJORA_PROMOCION',
      text: '💰 Encontré otra propuesta vigente para tu tratamiento.\n\n' + describeOffer(candidate) +
        '\n\nSi te interesa esta opción, responde a este mensaje.',
    };
    return {
      decision: 'PRECIO', offer, review: true, verifyOffer: true,
      text: price + ' Un asesor revisará si hay otras condiciones disponibles para tu caso.',
    };
  }
  if (analysis.intent === 'CONFIRMAR') {
    return input.publicReservation ? {
      decision: 'CONFIRMAR', offer, verifyOffer: true, confirmationLink: true,
      text: 'Para continuar, revisa la propuesta y confirma tu autorización de reserva en el enlace.',
    } : {
      decision: 'ASESOR', offer, review: true, confirmedOffer: true,
      text: 'Gracias por confirmar tu interés. Un asesor verificará contigo la propuesta y la autorización para reservar.',
    };
  }
  return {
    decision: 'DETALLES', offer, verifyOffer: true,
    text: '📝 Estos son los datos registrados de tu oferta.\n\n' + describeOffer(verified) +
      (verified.request.Servicio?.descripcion ? `\n\n*Sobre el tratamiento:* ${verified.request.Servicio.descripcion}` : '') +
      '\n\nSi quieres revisar otro horario o tienes una duda, cuéntame.',
  };
}
