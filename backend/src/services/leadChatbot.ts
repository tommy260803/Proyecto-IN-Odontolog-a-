import { prisma } from '../db';
import { checkWhatsAppPromotion, prepareChatbotReply, recheckWhatsAppSlots, replyForUnavailableOffer, verifiedWhatsAppOffer, type ChatbotReply } from './leadChatbotAgent';
import { acceptsOfferFollowUp, asksAboutOfferValidity, explicitWhatsAppOptOut, interpretLeadWhatsApp, normalizeChatbotText, type LeadChatbotAnalysis, type LeadContactInterpretation } from './leadChatbotGroq';
import { acceptsAgendaAdvisor, acceptsAgendaChange, agendaOptionNumber, asksForAgenda, choosesAgendaSite, continuesAgendaSearch, declinesAgendaOffer, hasScheduleConflict } from './leadChatbotSchedule';
import { loadTransferOffer, storePreReservationAccess, TransferError, transferIsolation, checkTransferOffer, transferLock } from './leadPayerTransfer';
import {
  assertWhatsAppContactAllowed, chatbotSchemaInstalled, chatbotWebhookSecret, chatHistoryForOffer, claimWhatsAppMessage,
  findWhatsAppOffers, finishWhatsAppMessage, isWhatsAppWithAdvisor, latestWhatsAppOutbound, lockWhatsAppControl,
  readWhatsAppControl, recordWhatsAppInbound, retryWhatsAppMessage, saveWhatsAppPlan, wasWhatsAppMenuShown,
  whatsAppControlTransaction, type WhatsAppJob, type WhatsAppOffer,
} from './leadWhatsAppInbox';
import { leadWhatsAppSettings, proposalWhatsAppToken, sendLeadWhatsApp, whatsAppChatId } from './leadWhatsApp';
import { publishWhatsAppAlertChange } from './leadWhatsAppAlertEvents';
import { hasScheduledPatientFollowUp, scheduleRequestedWhatsAppFollowUp } from './leadWhatsAppAutomaticFollowUp';
import { acknowledgesFollowUp, asksAboutWhatsAppFollowUp, asksToResumeWhatsApp, explicitlyContinuesReservation, followUpFailureMessage, isBusyForWhatsApp, isFollowUpDateOrTurnReply, limaDay, parseFollowUpPreference, resolveFollowUpPreference } from './leadWhatsAppFollowUpWindow';
import { formatAppointmentTime } from '../utils/appointmentTime';

type Settings = ReturnType<typeof leadWhatsAppSettings>;

async function isEligibleChat(job: WhatsAppJob, offer: WhatsAppOffer) {
  const row = await prisma.solicitudes.findFirst({
    where: { id_solicitud: offer.requestId, id_persona: offer.personId, archivada_lead_en: null,
      estado: { in: ['Abierta', 'En negociación'] },
      Persona: { autoriza_contacto: true, Etapa: { nombre: 'LEAD' } } },
    select: { resultado_comercial_lead: true, Persona: { select: { numero: true } } },
  });
  if (!row || row.resultado_comercial_lead === 'CERRADA_SIN_ACUERDO') return false;
  try {
    return whatsAppChatId(row.Persona.numero) === job.chat;
  } catch (error) {
    if (!(error instanceof TransferError)) throw error;
    return false;
  }
}

function redactForGroq(text: string) {
  return text.slice(0, 1200)
    .replace(/https?:\/\/\S+/gi, '[enlace]')
    .replace(/\b[^\s@]+@[^\s@]+\.[^\s@]+/g, '[correo]')
    .replace(/\b\d{7,}\b/g, '[número]');
}

function isClinicalWhatsAppText(text: string) {
  return /\b(?:dolor|sangrado|inflamacion|hinchazon|medicacion|medicamento|diagnostico|embarazo|alergia)\b/.test(normalizeChatbotText(text));
}

// Confirma el día de contacto y respeta el turno o la hora que el paciente indique.
function contactFollowUpReply(job: WhatsAppJob, offer: WhatsAppOffer, previous?: ChatbotReply, interpreted?: LeadContactInterpretation | null): ChatbotReply {
  const followUpPreference = resolveFollowUpPreference(job.text, job.receivedAt, previous?.followUpPreference, interpreted);
  const { date, turn, time, clarifyTime } = followUpPreference;
  const tomorrow = limaDay(new Date(job.receivedAt.getTime() + 24 * 3600_000));
  const day = !date ? '' : date === tomorrow ? 'mañana' : date === limaDay(job.receivedAt) ? 'hoy' :
    `el ${new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }).format(new Date(`${date}T12:00:00-05:00`))}`;
  const when = time ? `${day} a las ${formatAppointmentTime(time)} (hora de Lima)` : turn ? `${day} por la ${turn}` : day;
  const greeting = followUpPreference.wasBusy ? '🙏 Disculpa la interrupción.' : '🙏 Disculpa la molestia.';
  const text = date && clarifyTime ? `${greeting} ¿A qué hora te viene bien ${day}? Si prefieres, puedo escribirte durante el día.`
    : date ? `${greeting} Te escribiremos por WhatsApp ${when}.`
    : `${greeting} ¿Qué día te viene bien que te escribamos por WhatsApp?`;
  return { decision: 'SEGUIMIENTO_CONTACTO', offer, text, followUpPreference };
}

function contactStatusReply(offer: WhatsAppOffer, previous: ChatbotReply | undefined, scheduled: boolean): ChatbotReply {
  const preference = previous?.followUpPreference;
  const dateLabel = preference?.date && new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' })
    .format(new Date(`${preference.date}T12:00:00-05:00`));
  const time = preference?.time ? ` a las ${formatAppointmentTime(preference.time)} (hora de Lima)`
    : preference?.turn ? ` por la ${preference.turn}` : '';
  const when = dateLabel ? ` el ${dateLabel}${time}` : '';
  const text = scheduled ? `📅 El contacto por WhatsApp está programado${when}. Te escribiremos en el momento acordado.`
    : preference?.date || previous?.followUpFailure ? followUpFailureMessage(previous?.followUpFailure)
    : '🙏 Disculpa. Falta confirmar el día para programar el contacto por WhatsApp. Puedes decirme, por ejemplo, «dentro de tres días». El turno es opcional.';
  return { decision: 'ESTADO_SEGUIMIENTO', offer, text, followUpPreference: preference,
    followUpFailure: previous?.followUpFailure };
}

// Coordina la atención del mensaje vinculando la oferta, el historial, el control humano y la interpretación de IA.
async function prepareReply(job: WhatsAppJob, settings: Settings): Promise<ChatbotReply | undefined> {
  const control = await readWhatsAppControl(prisma, job);
  if (control?.decision === 'CONTROL_ASESOR') {
    const [offer] = await findWhatsAppOffers(prisma, { ...job, quotedId: null }, true, control.requestId);
    if (offer && await isEligibleChat(job, offer)) await recordWhatsAppInbound(job, offer);
    await finishWhatsAppMessage(job, explicitWhatsAppOptOut(job.text) ? 'BAJA' : 'CON_ASESOR');
    return;
  }
  const affirmative = /^(?:si(?:[ ,]+(?:claro|por favor|busca|revisa|quiero|adelante))?|dale|de acuerdo|adelante|esta bien)[.!\s]*$/i
    .test(normalizeChatbotText(job.text));
  let contextJob = job;
  if (!job.quotedId) {
    const recent = await latestWhatsAppOutbound(job);
    if (recent?.plan) {
      const plan = JSON.parse(recent.plan) as ChatbotReply;
      if (plan.offer) contextJob = { ...job, quotedId: recent.externalId };
    }
  }
  let offers = await findWhatsAppOffers(prisma, contextJob, asksAboutOfferValidity(job.text));
  if (!contextJob.quotedId && !offers.length) offers = await findWhatsAppOffers(prisma, contextJob, true);
  if (explicitWhatsAppOptOut(job.text)) {
    const [linked] = offers;
    if (offers.length === 1 && await isEligibleChat(job, linked)) await recordWhatsAppInbound(job, linked);
    await finishWhatsAppMessage(job, 'BAJA');
    return;
  }

  const [offer] = offers;
  if (!offer) {
    // A quote may target an untracked message; ask only if there is a current, verified chat context.
    const candidates = contextJob.quotedId ? await findWhatsAppOffers(prisma, { ...job, quotedId: null }) : [];
    if (!candidates[0] || !await isEligibleChat(job, candidates[0])) {
      await finishWhatsAppMessage(job, 'SIN_OFERTA');
      return;
    }
    return {
      decision: 'ACLARAR_OFERTA', offer: candidates.length === 1 ? candidates[0] : undefined,
      text: '¿Puedes responder citando la propuesta de NexoSalud que quieres revisar? Así podremos ubicarla.',
    };
  }
  if (!await isEligibleChat(job, offer)) {
    await finishWhatsAppMessage(job, 'SIN_OFERTA');
    return;
  }
  if (offers.length > 1) return {
    decision: 'ACLARAR_OFERTA',
    text: 'Hay más de una propuesta en este chat. Responde citando la que quieres revisar para poder ayudarte.',
  };

  await recordWhatsAppInbound(job, offer);
  if (await isWhatsAppWithAdvisor(job, offer)) {
    await finishWhatsAppMessage(job, 'CON_ASESOR');
    return;
  }
  const history = await chatHistoryForOffer(contextJob, offer);
  const latestBot = history.find(message => message.type === 'BOT' &&
    (!contextJob.quotedId || message.externalId === contextJob.quotedId));
  const previous = latestBot?.plan ? JSON.parse(latestBot.plan) as ChatbotReply : undefined;
  const contactDeferred = await hasScheduledPatientFollowUp(job, offer.requestId);
  const previousContact = previous?.followUpPreference;
  const contactConfirmed = previousContact?.date && !previousContact.clarifyTime &&
    latestBot?.decision !== 'SEGUIMIENTO_PENDIENTE' && !previous?.followUpFailure &&
    /(?:^De acuerdo, te escribiremos|Te escribiremos por WhatsApp)/.test(latestBot?.text ?? '');
  const resumeRequested = asksToResumeWhatsApp(job.text);
  const directFollowUpAnswer = isFollowUpDateOrTurnReply(job.text);
  const contactReply = previousContact && (resumeRequested || directFollowUpAnswer)
    ? parseFollowUpPreference(job.text, job.receivedAt, previousContact) : undefined;
  if (((contactDeferred || contactConfirmed) && acknowledgesFollowUp(job.text)) ||
      (contactConfirmed && contactReply?.date && contactReply.date === previousContact.date && contactReply.turn === previousContact.turn &&
        contactReply.time === previousContact.time && !contactReply.clarifyTime &&
        (previousContact.wasBusy || !isBusyForWhatsApp(job.text)))) {
    await finishWhatsAppMessage(job, 'SEGUIMIENTO_ACUSE');
    return;
  }
  const explicitMenu = /^menu[.!\s]*$/.test(normalizeChatbotText(job.text));
  const explicitReservation = !contactDeferred || explicitlyContinuesReservation(job.text);
  const menuWasShown = !explicitMenu && await wasWhatsAppMenuShown(job, offer);
  const number = previous?.slots?.length ? agendaOptionNumber(job.text) : undefined;
  const selectedSlot = number === undefined ? undefined : previous?.slots?.[number - 1];
  const pendingOfferAction = previous?.offerFollowUp;
  const offerFollowUp = pendingOfferAction && acceptsOfferFollowUp(job.text, pendingOfferAction) ? pendingOfferAction : undefined;
  const retryAgenda = Boolean(affirmative && previous?.agendaRetry);
  const pickedAgendaSite = Boolean(previous?.agendaClarification && choosesAgendaSite(job.text, previous.agendaSites));
  const agendaExpansion = selectedSlot || retryAgenda ? previous?.agendaExpansion :
    !pickedAgendaSite && previous?.agendaPermission && acceptsAgendaChange(job.text, previous.agendaPermission) ? previous.agendaPermission : undefined;
  const declinesChange = Boolean(previous?.agendaPermission && declinesAgendaOffer(job.text));
  const agendaDeclined = declinesChange && previous?.agendaPermission
    ? [...new Set([...(previous.agendaDeclined ?? []), previous.agendaPermission])] : previous?.agendaDeclined;
  const agendaContinuation = Boolean((previous?.agendaClarification || previous?.slots?.length) && continuesAgendaSearch(job.text));
  const requestsAgenda = asksForAgenda(job.text);

  if (isClinicalWhatsAppText(job.text)) {
    return { decision: 'ASESOR', offer, review: true,
      text: '👤 Un asesor continuará contigo para orientar tu consulta con el equipo de la clínica.' };
  }
  const changesAppointment = /\b(?:citas?|reservas?|prerreserva|asistir|ir a|cambiar el horario|especialistas?|sedes?)\b/.test(normalizeChatbotText(job.text));
  const followUpContext = contactDeferred ? 'PROGRAMADO' : previousContact ?
    latestBot?.decision === 'SEGUIMIENTO_PENDIENTE' || previous?.followUpFailure ? 'PENDIENTE' : 'POR_PRECISAR' : undefined;
  const asksContactStatus = Boolean(followUpContext && asksAboutWhatsAppFollowUp(job.text) && !changesAppointment &&
    !/\b(?:precio|descuento|promocion|tarifa|oferta)\b/.test(normalizeChatbotText(job.text)));
  if (asksContactStatus) return contactStatusReply(offer, previous, contactDeferred);
  const pendingFollowUp = previousContact && (!contactConfirmed || previousContact.clarifyTime);
  const followUpAnswer = contactReply ?? ((pendingFollowUp || resumeRequested) && parseFollowUpPreference(job.text, job.receivedAt));
  if (!changesAppointment && followUpAnswer &&
      (followUpAnswer.date || followUpAnswer.turn || followUpAnswer.time || followUpAnswer.clarifyTime) &&
      (directFollowUpAnswer || resumeRequested)) {
    return contactFollowUpReply(job, offer, previous);
  }
  if (number !== undefined && previous?.slots?.length && !selectedSlot) {
    return { ...previous, offer, text: 'Puedes elegir un número del 1 al ' + previous.slots.length + ' de la lista que te compartí.' };
  }
  if (previous?.agendaAdvisorOffer && acceptsAgendaAdvisor(job.text)) {
    return { decision: 'ASESOR', offer, review: true,
      text: '👤 Le avisaré a un asesor para que revise contigo la disponibilidad y continúe por este chat.' };
  }
  if (previous?.agendaAdvisorOffer && declinesAgendaOffer(job.text)) {
    return { decision: 'AGENDA', offer,
      text: 'De acuerdo. Si cambia tu disponibilidad o quieres que vuelva a revisar, puedes escribirme por aquí.' };
  }
  if (previous?.discountAdvisorOffer && acceptsAgendaAdvisor(job.text)) {
    return { decision: 'ASESOR', offer, review: true,
      text: '👤 Le avisaré a un asesor para que revise si hay otra condición disponible. Continuará contigo por este chat.' };
  }
  if (previous?.discountAdvisorOffer && declinesAgendaOffer(job.text)) {
    return { decision: 'PRECIO', offer, offerFollowUp: 'prerreserva',
      text: 'De acuerdo. Puedes continuar con tu propuesta vigente. ¿Quieres hacer la prerreserva?' };
  }

  if (pendingFollowUp && !changesAppointment && /\bno (?:puedo|me sirve|me conviene)\b/.test(normalizeChatbotText(job.text))) {
    return contactFollowUpReply(job, offer, previous);
  }

  const blank = { dia: '', turno: '', sede: '', profesional: '', tono: 'neutro', buscaMenorPrecio: false, seguimiento: null };
  const analysis: LeadChatbotAnalysis = explicitMenu
    ? { intent: 'MENU' as const, ...blank }
    : offerFollowUp === 'prerreserva' && explicitReservation
    ? { intent: 'CONFIRMAR' as const, ...blank }
    : offerFollowUp === 'nueva_oferta'
    ? { intent: 'VIGENCIA' as const, ...blank }
    : (affirmative && offerFollowUp === 'horario') || retryAgenda || (agendaExpansion && !selectedSlot) || declinesChange || pickedAgendaSite
    ? { intent: 'AGENDA' as const, ...blank }
    : selectedSlot
    ? { intent: 'CONFIRMAR' as const, ...blank }
    : await interpretLeadWhatsApp(redactForGroq(job.text), history.slice(0, 8).reverse().map(message => ({
      speaker: message.type === 'BOT' ? 'asistente' : 'paciente',
      text: isClinicalWhatsAppText(message.text) ? '[consulta derivada al asesor]' : redactForGroq(message.text),
    })), { menuWasShown: menuWasShown && !contactDeferred, hasSuggestedSlots: Boolean(previous?.slots?.length), contactDeferred, followUpContext }).catch(error => {
      if (resumeRequested && !changesAppointment) return { intent: 'SEGUIMIENTO' as const, ...blank };
      if ((!hasScheduleConflict(job.text) && !agendaContinuation && !requestsAgenda) ||
          /\b(?:asesor|no me interesa|no quiero continuar)\b/.test(normalizeChatbotText(job.text))) throw error;
      return { intent: 'AGENDA' as const, ...blank };
    });
  const optionChange = asksForAgenda(job.text) || hasScheduleConflict(job.text);
  if (!selectedSlot && analysis.intent === 'CONFIRMAR' && optionChange) analysis.intent = 'AGENDA';
  if (analysis.intent === 'BAJA') {
    await finishWhatsAppMessage(job, 'BAJA');
    return;
  }
  if (analysis.intent === 'ESTADO_SEGUIMIENTO') return contactStatusReply(offer, previous, contactDeferred);
  if (contactDeferred && !selectedSlot && !explicitMenu) {
    if (analysis.intent === 'CONFIRMAR' && !explicitReservation) analysis.intent = 'ACLARAR';
    if (['MENU', 'ACLARAR'].includes(analysis.intent) && !analysis.temas?.length &&
        !resumeRequested && !requestsAgenda && !agendaContinuation) {
      await finishWhatsAppMessage(job, 'SEGUIMIENTO_ACUSE');
      return;
    }
  }
  if (analysis.intent === 'SEGUIMIENTO' || (resumeRequested && !changesAppointment && !['ASESOR', 'RECHAZO', 'FUERA_DE_TEMA', 'CONFIRMAR'].includes(analysis.intent))) {
    return contactFollowUpReply(job, offer, previous, analysis.seguimiento);
  }
  if (analysis.intent === 'ASESOR' && agendaContinuation && !/\b(?:asesor|persona|humano|recepcion|alguien|no me ayudas|no me sirvio)\b/.test(normalizeChatbotText(job.text))) {
    analysis.intent = 'AGENDA';
  }
  if (analysis.intent === 'CONFIRMAR' && !selectedSlot && previous?.slots?.length) {
    return { ...previous, offer, text: '¿Cuál de los horarios que te compartí quieres prerreservar? Indícame el número de la opción.' };
  }
  const patientMessages: string[] = [];
  const agendaReferences: (ChatbotReply['slots'])[] = [];
  let lastOffered: ChatbotReply['slots'];
  for (const message of [...history].sort((a, b) => a.messageId < b.messageId ? -1 : a.messageId > b.messageId ? 1 : 0)) {
    if (message.type === 'ENTRADA' && !['FUERA_DE_TEMA', 'SEGUIMIENTO_CONTACTO', 'SEGUIMIENTO_ACUSE', 'ESTADO_SEGUIMIENTO',
      'SEGUIMIENTO_PENDIENTE', 'CATALOGO'].includes(message.decision ?? '')) {
      patientMessages.push(message.text);
      agendaReferences.push(lastOffered);
    } else if (message.plan) {
      const plan = JSON.parse(message.plan) as ChatbotReply;
      if (plan.slots?.length) lastOffered = plan.slots;
    }
  }
  patientMessages.push(job.text);
  agendaReferences.push(previous?.slots?.length ? previous.slots : lastOffered);
  const continueAgenda = !explicitMenu && ['MENU', 'ACLARAR', 'CATALOGO'].includes(analysis.intent) &&
    (requestsAgenda || agendaContinuation || (previous?.agendaClarification &&
      !analysis.temas?.length && (affirmative || Boolean(analysis.dia || analysis.turno || analysis.sede || analysis.profesional))));
  if (continueAgenda && previous && affirmative && !agendaExpansion) {
    return { ...previous, offer, text: '¿Qué día, turno, sede o especialista prefieres que revise?' };
  }
  const revisionOrigin = previous?.revisionOrigin ?? history
    .filter(message => message.type === 'BOT' && message.plan)
    .map(message => JSON.parse(message.plan!) as ChatbotReply)
    .find(plan => plan.offer?.fingerprint === offer.fingerprint && plan.revisionOrigin)?.revisionOrigin;
  const reply = await prepareChatbotReply({
    offer, analysis: continueAgenda ? { ...analysis, intent: 'AGENDA' } : analysis,
    menuWasShown, selectedSlot, agendaExpansion, retryAgenda, agendaReferences,
    pendingAgenda: { sites: previous?.agendaSites, declined: agendaDeclined },
    checkNewOffer: offerFollowUp === 'nueva_oferta' && ['VIGENCIA', 'PRECIO', 'DETALLES'].includes(analysis.intent),
    publicReservation: Boolean(settings.publicUrl && !settings.localReservation),
    patientMessages, job, revisionOrigin,
  });
  return revisionOrigin && !reply.revisionOrigin && reply.offer?.fingerprint === offer.fingerprint
    ? { ...reply, revisionOrigin } : reply;
}

async function confirmLink(settings: Settings, job: WhatsAppJob, reference: WhatsAppOffer) {
  if (!settings.publicUrl || settings.localReservation) throw new Error('La prerreserva requiere su URL pública.');
  const token = proposalWhatsAppToken(settings, reference.fingerprint, job.chat);
  await prisma.$transaction(async tx => {
    const offer = await loadTransferOffer(tx, reference.personId, reference.requestId, reference.optionId);
    if (offer.huella !== reference.fingerprint || offer.proposal.id_propuesta !== reference.proposalId) {
      throw new TransferError('La oferta cambió.', 409);
    }
    await checkWhatsAppPromotion(tx, offer);
    await checkTransferOffer(tx, offer);
    await storePreReservationAccess(tx, offer, null, token);
  }, transferIsolation);
  const link = new URL(`/pre-reserva/${reference.personId}`, settings.publicUrl);
  link.hash = 'token=' + token;
  return link.href;
}

// Verifica nuevamente las condiciones antes de enviar la respuesta y registra el resultado en SQL Server.
async function processWhatsAppMessage(job: WhatsAppJob, settings: Settings) {
  if (!explicitWhatsAppOptOut(job.text)) {
    try {
      await assertWhatsAppContactAllowed(prisma, job);
    } catch (error) {
      if (!(error instanceof TransferError)) throw error;
      await finishWhatsAppMessage(job, 'SUSPENDIDO');
      return;
    }
  }

  let reply = job.plan ? JSON.parse(job.plan) as ChatbotReply : await prepareReply(job, settings);
  if (!reply) return;
  if (reply.offer && !await isEligibleChat(job, reply.offer)) {
    await finishWhatsAppMessage(job, 'SIN_OFERTA');
    return;
  }
  if (reply.verifyOffer && reply.offer) {
    try {
      await verifiedWhatsAppOffer(reply.offer);
    } catch (error) {
      if (!(error instanceof TransferError) || job.plan) throw error;
      reply = replyForUnavailableOffer(reply.offer, error);
    }
  }
  if (reply.slots?.length && reply.offer && !await recheckWhatsAppSlots(reply.offer, reply.slots)) {
    if (job.plan) {
      // A previous attempt may have reached OpenWA with this idempotency key.
      await finishWhatsAppMessage(job, 'AGENDA_CAMBIO', undefined, true);
      return;
    }
    reply = {
      decision: 'AGENDA', offer: reply.offer, agendaRetry: true, agendaExpansion: reply.agendaExpansion,
      agendaSites: reply.agendaSites, agendaDeclined: reply.agendaDeclined,
      text: 'La agenda acaba de cambiar y alguno de los horarios ya no está disponible. ¿Quieres que vuelva a buscar con tus preferencias?',
    };
  }
  let link: string | undefined;
  if (reply.confirmationLink && reply.offer) {
    try {
      link = await confirmLink(settings, job, reply.offer);
    } catch (error) {
      if (!(error instanceof TransferError) || job.plan) throw error;
      reply = replyForUnavailableOffer(reply.offer, error);
    }
  }
  if (!job.plan) await saveWhatsAppPlan(job, reply, reply.decision);
  try {
    await assertWhatsAppContactAllowed(prisma, job);
  } catch (error) {
    if (!(error instanceof TransferError)) throw error;
    await finishWhatsAppMessage(job, 'SUSPENDIDO');
    return;
  }
  const text = link ? `${reply.text}\n\n🔗 *Confirma tu prerreserva aquí:*\n${link}` : reply.text;
  const outbound = reply;
  const reviewCommitted = await prisma.$transaction(async tx => {
    // El bloqueo por chat coordina los envíos del bot con la toma de control del asesor.
    await lockWhatsAppControl(tx, job);
    const control = await readWhatsAppControl(tx, job);
    if (control?.decision === 'CONTROL_ASESOR' || (control && job.id < control.id)) {
      await finishWhatsAppMessage(job, 'CON_ASESOR', undefined, false, tx);
      return;
    }
    try {
      await assertWhatsAppContactAllowed(tx, job);
    } catch (error) {
      if (!(error instanceof TransferError)) throw error;
      await finishWhatsAppMessage(job, 'SUSPENDIDO', undefined, false, tx);
      return;
    }
    const preference = outbound.followUpPreference;
    let replyText = text;
    let decision = outbound.decision;
    if (decision === 'REVISION_PROPUESTA' && outbound.offer && outbound.revisionOrigin) {
      await transferLock(tx);
      const revision = await loadTransferOffer(tx, outbound.offer.personId, outbound.offer.requestId, outbound.offer.optionId);
      if (revision.huella !== outbound.offer.fingerprint) throw new TransferError('La propuesta revisada cambió.');
      await checkTransferOffer(tx, revision);
      const origin = outbound.revisionOrigin;
      const replaced = await loadTransferOffer(tx, origin.personId, origin.requestId, origin.optionId);
      if (replaced.huella !== origin.fingerprint || replaced.option.archivada_lead_en) {
        throw new TransferError('La propuesta inicial cambió antes de confirmar los cambios.');
      }
      await tx.$executeRaw`UPDATE dbo.AccesosPreReservaLead SET vence_utc=SYSUTCDATETIME()
        WHERE id_solicitud=${origin.requestId} AND id_opcion=${origin.optionId}
          AND vence_utc>SYSUTCDATETIME()`;
    }
    if (decision === 'SEGUIMIENTO_CONTACTO' && outbound.offer && preference?.date && !preference.clarifyTime) {
      const scheduled = await scheduleRequestedWhatsAppFollowUp(tx, job, outbound.offer, preference);
      if (scheduled !== 'PROGRAMADO') {
        replyText = followUpFailureMessage(scheduled);
        decision = 'SEGUIMIENTO_PENDIENTE';
        await saveWhatsAppPlan(job, { ...outbound, text: replyText, decision, followUpFailure: scheduled }, decision, tx);
      }
    }
    const sent = await sendLeadWhatsApp(settings, `lead-chatbot:${job.sessionId}:${job.externalId}`, job.chat, replyText);
    return finishWhatsAppMessage(job, decision, {
      text: preference ? replyText : outbound.text, externalId: sent.messageId, offer: outbound.offer, review: outbound.review,
    }, outbound.review, tx);
  }, whatsAppControlTransaction);
  if (reviewCommitted) publishWhatsAppAlertChange(job.sessionId);
}

let running = false;
let warnedSchema = false;
// Toma un mensaje pendiente de la cola y controla los reintentos si su procesamiento falla.
export async function processNextLeadWhatsApp() {
  if (running || !chatbotWebhookSecret() || !process.env.GROQ_LEAD_CHATBOT_API_KEY?.trim()) return;
  running = true;
  try {
    const settings = leadWhatsAppSettings();
    if (!await chatbotSchemaInstalled(prisma)) {
      if (!warnedSchema) console.warn('[Chatbot LEAD] Falta el incremento 12_CHATBOT_WHATSAPP_LEAD.sql.');
      warnedSchema = true;
      return;
    }
    const job = await claimWhatsAppMessage(settings.sessionId);
    if (!job) return;
    try {
      await processWhatsAppMessage(job, settings);
    } catch (error) {
      const reason = error instanceof Error
        ? /^Groq LEAD /.test(error.message) ? error.message : error.name : 'Error';
      console.warn(`[Chatbot LEAD] No se completó el trabajo ${job.id}, intento ${job.attempts}.`, reason);
      await retryWhatsAppMessage(job);
    }
  } catch {
    console.warn('[Chatbot LEAD] No se pudo consultar la cola de WhatsApp.');
  } finally {
    running = false;
  }
}

export function startLeadWhatsAppChatbot() {
  if (!chatbotWebhookSecret() || !process.env.GROQ_LEAD_CHATBOT_API_KEY?.trim()) return;
  setInterval(() => void processNextLeadWhatsApp(), 2000).unref();
}
