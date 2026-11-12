import { prisma } from '../db';
import { prepareChatbotReply, recheckWhatsAppSlots, replyForUnavailableOffer, verifiedWhatsAppOffer, type ChatbotReply } from './leadChatbotAgent';
import { acceptsOfferFollowUp, asksAboutOfferValidity, explicitWhatsAppOptOut, interpretLeadWhatsApp, normalizeChatbotText } from './leadChatbotGroq';
import { acceptsAgendaChange, agendaOptionNumber, hasScheduleConflict } from './leadChatbotSchedule';
import { loadTransferOffer, storePreReservationAccess, TransferError, transferIsolation, checkTransferOffer } from './leadPayerTransfer';
import {
  assertWhatsAppContactAllowed, chatbotSchemaInstalled, chatbotWebhookSecret, chatHistoryForOffer, claimWhatsAppMessage,
  findWhatsAppOffers, finishWhatsAppMessage, isWhatsAppWithAdvisor, latestWhatsAppOutbound, recordWhatsAppInbound, retryWhatsAppMessage,
  saveWhatsAppPlan, wasWhatsAppMenuShown, type WhatsAppJob, type WhatsAppOffer,
} from './leadWhatsAppInbox';
import { leadWhatsAppSettings, proposalWhatsAppToken, sendLeadWhatsApp, whatsAppChatId } from './leadWhatsApp';

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

async function prepareReply(job: WhatsAppJob, settings: Settings): Promise<ChatbotReply | undefined> {
  const affirmative = /^(?:si(?:[ ,]+(?:claro|por favor|busca|revisa|quiero|adelante))?|dale|de acuerdo|adelante|esta bien)[.!\s]*$/i
    .test(normalizeChatbotText(job.text));
  let contextJob = job;
  const couldFollowOffer = (['nueva_oferta', 'horario', 'prerreserva'] as const).some(action => acceptsOfferFollowUp(job.text, action));
  if (couldFollowOffer && !job.quotedId) {
    const recent = await latestWhatsAppOutbound(job);
    const action = recent?.plan ? (JSON.parse(recent.plan) as ChatbotReply).offerFollowUp : undefined;
    if (recent && action && acceptsOfferFollowUp(job.text, action)) {
      contextJob = { ...job, quotedId: recent.externalId };
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
  const explicitMenu = /^menu[.!\s]*$/.test(normalizeChatbotText(job.text));
  const menuWasShown = !explicitMenu && await wasWhatsAppMenuShown(job, offer);
  const number = agendaOptionNumber(job.text);
  const selectedSlot = number ? previous?.slots?.[number - 1] : undefined;
  const pendingOfferAction = previous?.offerFollowUp;
  const offerFollowUp = pendingOfferAction && acceptsOfferFollowUp(job.text, pendingOfferAction) ? pendingOfferAction : undefined;
  const retryAgenda = Boolean(affirmative && previous?.agendaRetry);
  const agendaExpansion = selectedSlot || retryAgenda ? previous?.agendaExpansion :
    previous?.agendaPermission && acceptsAgendaChange(job.text, previous.agendaPermission) ? previous.agendaPermission : undefined;

  if (isClinicalWhatsAppText(job.text)) {
    return { decision: 'ASESOR', offer, review: true,
      text: '👤 Un asesor continuará contigo para orientar tu consulta con el equipo de la clínica.' };
  }
  if (number && previous?.slots?.length && !selectedSlot) {
    return { ...previous, offer, text: 'Puedes elegir un número del 1 al ' + previous.slots.length + ' de la lista que te compartí.' };
  }
  if (previous?.agendaPermission && /^(?:no|no gracias|prefiero que no)[.!\s]*$/i.test(normalizeChatbotText(job.text))) {
    return { decision: 'AGENDA', offer, agendaClarification: true,
      text: 'Entendido. ¿Qué otra condición te resultaría flexible para buscar un horario?' };
  }

  const blank = { dia: '', turno: '', sede: '', profesional: '', tono: 'neutro', buscaMenorPrecio: false };
  const analysis = explicitMenu
    ? { intent: 'MENU' as const, ...blank }
    : offerFollowUp === 'prerreserva'
    ? { intent: 'CONFIRMAR' as const, ...blank }
    : offerFollowUp === 'nueva_oferta'
    ? { intent: 'VIGENCIA' as const, ...blank }
    : offerFollowUp === 'horario' || retryAgenda || (agendaExpansion && !selectedSlot)
    ? { intent: 'AGENDA' as const, ...blank }
    : selectedSlot
    ? { intent: 'CONFIRMAR' as const, ...blank }
    : await interpretLeadWhatsApp(redactForGroq(job.text), history.slice(0, 8).reverse().map(message => ({
      speaker: message.type === 'BOT' ? 'asistente' : 'paciente',
      text: isClinicalWhatsAppText(message.text) ? '[consulta derivada al asesor]' : redactForGroq(message.text),
    })), { menuWasShown, hasSuggestedSlots: Boolean(previous?.slots?.length) }).catch(error => {
      if (!hasScheduleConflict(job.text) ||
          /\b(?:asesor|no me interesa|no quiero continuar)\b/.test(normalizeChatbotText(job.text))) throw error;
      return { intent: 'AGENDA' as const, ...blank };
    });
  if (analysis.intent === 'BAJA') {
    await finishWhatsAppMessage(job, 'BAJA');
    return;
  }
  const patientMessages: string[] = [];
  const agendaReferences: (ChatbotReply['slots'])[] = [];
  let lastOffered: ChatbotReply['slots'];
  for (const message of [...history].sort((a, b) => a.messageId < b.messageId ? -1 : a.messageId > b.messageId ? 1 : 0)) {
    if (message.type === 'ENTRADA') {
      patientMessages.push(message.text);
      agendaReferences.push(lastOffered);
    } else if (message.plan) {
      const plan = JSON.parse(message.plan) as ChatbotReply;
      if (plan.slots?.length) lastOffered = plan.slots;
    }
  }
  patientMessages.push(job.text);
  agendaReferences.push(previous?.slots?.length ? previous.slots : lastOffered);
  const continueAgenda = previous?.agendaClarification && ['MENU', 'ACLARAR', 'CONFIRMAR'].includes(analysis.intent);
  if (continueAgenda && affirmative && !agendaExpansion) {
    return { ...previous, offer, text: '¿Qué día, turno, sede o especialista prefieres que revise?' };
  }
  return prepareChatbotReply({
    offer, analysis: continueAgenda ? { ...analysis, intent: 'AGENDA' } : analysis,
    menuWasShown, selectedSlot, agendaExpansion, retryAgenda, agendaReferences,
    checkNewOffer: offerFollowUp === 'nueva_oferta',
    publicReservation: Boolean(settings.publicUrl && !settings.localReservation),
    patientMessages,
  });
}

async function confirmLink(settings: Settings, job: WhatsAppJob, reference: WhatsAppOffer) {
  if (!settings.publicUrl || settings.localReservation) throw new Error('La prerreserva requiere su URL pública.');
  const token = proposalWhatsAppToken(settings, reference.fingerprint, job.chat);
  await prisma.$transaction(async tx => {
    const offer = await loadTransferOffer(tx, reference.personId, reference.requestId, reference.optionId);
    if (offer.huella !== reference.fingerprint) throw new TransferError('La oferta cambió.', 409);
    await checkTransferOffer(tx, offer);
    await storePreReservationAccess(tx, offer, null, token);
  }, transferIsolation);
  const link = new URL(`/pre-reserva/${reference.personId}`, settings.publicUrl);
  link.hash = 'token=' + token;
  return link.href;
}

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
      if (!(error instanceof TransferError) || job.plan || reply.decision !== 'VIGENCIA') throw error;
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
      text: 'La agenda acaba de cambiar y alguno de los horarios ya no está disponible. ¿Quieres que vuelva a buscar con tus preferencias?',
    };
  }
  if (!job.plan) await saveWhatsAppPlan(job, reply, reply.decision);

  const link = reply.confirmationLink && reply.offer ? await confirmLink(settings, job, reply.offer) : undefined;
  try {
    await assertWhatsAppContactAllowed(prisma, job);
  } catch (error) {
    if (!(error instanceof TransferError)) throw error;
    await finishWhatsAppMessage(job, 'SUSPENDIDO');
    return;
  }
  const text = link ? `${reply.text}\n\n🔗 *Prerreserva:*\n${link}` : reply.text;
  const sent = await sendLeadWhatsApp(settings, `lead-chatbot:${job.sessionId}:${job.externalId}`, job.chat, text);
  await finishWhatsAppMessage(job, reply.decision, {
    text: reply.text, externalId: sent.messageId, offer: reply.offer, review: reply.review,
  }, reply.review);
}

let running = false;
let warnedSchema = false;
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
    } catch {
      console.warn(`[Chatbot LEAD] No se completó el trabajo ${job.id}, intento ${job.attempts}.`);
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
