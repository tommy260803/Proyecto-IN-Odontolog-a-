import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { checkLeadProposalTerms, loadTransferOffer, TransferError } from './leadPayerTransfer';
import { leadWhatsAppSettings, sendLeadWhatsApp, whatsAppChatId } from './leadWhatsApp';
import {
  assertWhatsAppContactAllowed, hasWhatsAppReview, lockWhatsAppControl, readWhatsAppControl,
  whatsappChannelId, whatsAppControlTransaction, type WhatsAppJob, type WhatsAppOffer,
} from './leadWhatsAppInbox';
import { automaticFollowUpPlan, followUpWindow, limaDay, requestedFollowUpDate, withinFollowUpHours, type FollowUpPreference, type FollowUpTurn } from './leadWhatsAppFollowUpWindow';

type Tx = Prisma.TransactionClient;
type Origin = 'PACIENTE' | 'ASESOR' | 'LEIDO' | 'ENTREGADO' | 'VIGENCIA';
const explicitOrigin = (origin?: Origin | null) => origin === 'PACIENTE' || origin === 'ASESOR';
const subsequentActivity = 'Hubo actividad posterior en la conversación.';
type Source = WhatsAppOffer & { id: bigint; chat: string; externalId: string; sent: Date; delivered: Date | null; read: Date | null };
type FollowUp = {
  estado: string; motivo: string; revision: number; origen_whatsapp: Origin | null; id_mensaje_origen_whatsapp: bigint | null;
  turno_whatsapp: FollowUpTurn | null; clave: string | null; ultimo_envio_utc: Date | null;
};

export async function automaticFollowUpInstalled(db: Pick<Tx, '$queryRaw'>) {
  const [row] = await db.$queryRaw<{ ready: number }[]>`
    SELECT CASE WHEN COL_LENGTH('dbo.SeguimientoOperativoLead','origen_whatsapp') IS NOT NULL
      AND COL_LENGTH('dbo.MensajesWhatsAppLead','habilita_seguimiento_automatico') IS NOT NULL THEN 1 ELSE 0 END AS ready
  `;
  return row?.ready === 1;
}

export async function hasScheduledPatientFollowUp(job: WhatsAppJob, requestId: number) {
  if (!await automaticFollowUpInstalled(prisma)) return false;
  const [pending] = await prisma.$queryRaw<{ found: number }[]>`
    SELECT TOP (1) 1 AS found FROM dbo.SeguimientoOperativoLead f
    JOIN dbo.MensajesWhatsAppLead m ON m.id_mensaje=f.id_mensaje_origen_whatsapp
    WHERE f.id_solicitud=${requestId} AND f.estado='PROGRAMADO' AND f.origen_whatsapp='PACIENTE'
      AND m.id_solicitud=f.id_solicitud AND m.id_sesion=${job.sessionId} AND m.chat=${job.chat}
      AND m.tipo='ENTRADA' AND m.id_mensaje<${job.id}`;
  return Boolean(pending);
}

async function loadFollowUp(tx: Tx, requestId: number) {
  const [state] = await tx.$queryRaw<FollowUp[]>`
    SELECT estado,motivo,revision,origen_whatsapp,id_mensaje_origen_whatsapp,turno_whatsapp,ultimo_envio_utc,
      CONVERT(varchar(36),clave_envio) AS clave
    FROM dbo.SeguimientoOperativoLead WITH (UPDLOCK,HOLDLOCK) WHERE id_solicitud=${requestId}
  `;
  return state;
}

function activeOpportunity(row: Awaited<ReturnType<typeof loadOpportunity>>, chat: string) {
  if (!row || !row.Persona.autoriza_contacto || row.Persona.Etapa.nombre !== 'LEAD' || row.archivada_lead_en ||
      !['Abierta', 'En negociación'].includes(row.estado) || (row.resultado_comercial_lead ?? 'PENDIENTE') !== 'PENDIENTE') return false;
  try { return whatsAppChatId(row.Persona.numero) === chat; }
  catch (error) { if (!(error instanceof TransferError)) throw error; return false; }
}

function loadOpportunity(tx: Tx, id: number) {
  return tx.solicitudes.findUnique({ where: { id_solicitud: id }, include: { Persona: { include: { Etapa: true } }, Servicio: true } });
}

async function saveSchedule(tx: Tx, requestId: number, sourceId: bigint, origin: Origin, date: Date,
  previous?: FollowUp, turn?: FollowUpTurn, reason?: string) {
  const motive = reason ?? (origin === 'PACIENTE' ? 'El paciente solicitó retomar el contacto por WhatsApp.'
    : origin === 'VIGENCIA' ? 'Seguimiento por vencimiento de la promoción.'
    : origin === 'LEIDO' ? 'Propuesta leída sin respuesta. Recordatorio a partir de las 24 horas.'
      : 'Propuesta entregada sin lectura confirmada ni respuesta. Recordatorio a partir de las 48 horas.');
  const key = previous?.id_mensaje_origen_whatsapp === sourceId && previous.clave ? previous.clave : randomUUID();
  const revision = (previous?.revision ?? 0) + 1;
  await tx.$executeRaw`
    MERGE dbo.SeguimientoOperativoLead WITH (HOLDLOCK) AS target
    USING (SELECT ${requestId} AS id_solicitud) source ON source.id_solicitud=target.id_solicitud
    WHEN MATCHED THEN UPDATE SET estado='PROGRAMADO',motivo=${motive},borrador=NULL,id_externo=NULL,
      clave_envio=CONVERT(uniqueidentifier,${key}),origen_whatsapp=${origin},id_mensaje_origen_whatsapp=${sourceId},
      turno_whatsapp=${turn ?? null},revision=${revision},actualizado_utc=SYSUTCDATETIME()
    WHEN NOT MATCHED THEN INSERT (id_solicitud,estado,motivo,clave_envio,origen_whatsapp,id_mensaje_origen_whatsapp,turno_whatsapp,revision)
      VALUES (${requestId},'PROGRAMADO',${motive},CONVERT(uniqueidentifier,${key}),${origin},${sourceId},${turn ?? null},${revision});
    UPDATE dbo.Solicitudes SET fecha_proximo_seguimiento=${date} WHERE id_solicitud=${requestId};
    INSERT dbo.HistorialSeguimientoOperativoLead(id_solicitud,estado,motivo,revision)
    VALUES (${requestId},'PROGRAMADO',${motive},${revision});
  `;
}

// CAP-04 programa el día solicitado y conserva el turno solo si lo indicó el paciente.
export async function scheduleRequestedWhatsAppFollowUp(tx: Tx, job: WhatsAppJob, offer: WhatsAppOffer, preference: FollowUpPreference) {
  const { date, turn, time, wasBusy } = preference;
  if (!date || preference.clarifyTime) return 'FECHA' as const;
  if (!await automaticFollowUpInstalled(tx)) return 'CONFIGURACION' as const;
  const row = await loadOpportunity(tx, offer.requestId);
  if (!row || !activeOpportunity(row, job.chat)) return 'OPORTUNIDAD' as const;
  const state = await loadFollowUp(tx, offer.requestId);
  if (state?.id_mensaje_origen_whatsapp === job.id && state.origen_whatsapp === 'PACIENTE') {
    return state.estado === 'PROGRAMADO' ? 'PROGRAMADO' as const : 'SUSPENDIDO' as const;
  }
  if (state?.estado === 'PAUSADO' ||
      (state?.estado === 'CANCELADO' && !state.origen_whatsapp && state.motivo !== subsequentActivity) ||
      (row.fecha_proximo_seguimiento && !state?.origen_whatsapp)) return 'SUSPENDIDO' as const;
  const due = requestedFollowUpDate(date, turn, time, new Date(), job.receivedAt);
  if (!due) return 'FECHA' as const;
  const dateLabel = new Intl.DateTimeFormat('es-PE', { dateStyle: 'long', timeZone: 'America/Lima' }).format(due);
  const reason = wasBusy ? 'El paciente estaba ocupado y pidió que le escribamos' : 'El paciente pidió que le escribamos';
  await saveSchedule(tx, offer.requestId, job.id, 'PACIENTE', due, state, turn, `${reason} el ${dateLabel}.`);
  return 'PROGRAMADO' as const;
}

export async function scheduleAdvisorWhatsAppFollowUp(tx: Tx, requestId: number, revision: number,
  date: string, turn: FollowUpTurn | undefined, reason: string, time?: string) {
  if (!await automaticFollowUpInstalled(tx)) throw new TransferError('Instala el seguimiento automático de WhatsApp.', 409);
  const settings = leadWhatsAppSettings();
  const row = await loadOpportunity(tx, requestId);
  if (!row?.Persona.autoriza_contacto) throw new TransferError('Falta autorización para contactar al paciente por WhatsApp.');
  const scope = { sessionId: settings.sessionId, chat: whatsAppChatId(row.Persona.numero) };
  await lockWhatsAppControl(tx, scope);
  await assertWhatsAppContactAllowed(tx, scope);
  if ((await readWhatsAppControl(tx, scope))?.decision === 'CONTROL_ASESOR' || await hasWhatsAppReview(tx, scope, requestId)) {
    throw new TransferError('Devuelve el control al ChatBot antes de programar un envío automático.');
  }
  const offer = await latestOffer(tx, scope.sessionId, requestId);
  if (!activeOpportunity(row, scope.chat) || offer?.chat !== scope.chat) {
    throw new TransferError('Envía primero una propuesta de esta oportunidad por WhatsApp.');
  }
  const [activity] = await tx.$queryRaw<{ id: bigint }[]>`
    SELECT MAX(id_mensaje) AS id FROM dbo.MensajesWhatsAppLead WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat}`;
  const current = await loadFollowUp(tx, requestId);
  if ((current?.revision ?? 0) !== revision) throw new TransferError('El seguimiento cambió. Actualiza antes de guardar.');
  const due = requestedFollowUpDate(date, turn, time);
  if (!due) throw new TransferError('Elige una fecha y un turno vigentes. La hora, si la indicas, debe estar dentro del turno.');
  await saveSchedule(tx, requestId, activity?.id ?? offer.id, 'ASESOR', due, current, turn, reason);
}

async function latestOffer(tx: Tx, sessionId: string, requestId: number) {
  const [row] = await tx.$queryRaw<Source[]>`
    SELECT TOP (1) m.id_mensaje AS id,m.chat,m.id_externo AS externalId,m.id_solicitud AS requestId,m.id_persona AS personId,
      m.id_propuesta AS proposalId,m.id_opcion AS optionId,m.huella AS fingerprint,m.fecha_utc AS sent,
      ack.entrega_detectada_utc AS delivered,ack.lectura_detectada_utc AS [read]
    FROM dbo.MensajesWhatsAppLead m
    LEFT JOIN dbo.ConfirmacionesWhatsAppLead ack ON ack.id_sesion=m.id_sesion AND ack.id_externo=m.id_externo
    WHERE m.id_sesion=${sessionId} AND m.id_solicitud=${requestId} AND m.estado='FINALIZADO'
      AND (m.tipo='OFERTA' OR (m.tipo='BOT' AND m.decision='CONTRAOFERTA'))
    ORDER BY m.id_mensaje DESC
  `;
  return row;
}

async function setOutcome(tx: Tx, requestId: number, state: 'CANCELADO' | 'ENVIADO' | 'FALLIDO', motive: string,
  text: string | null = null, externalId: string | null = null) {
  await tx.$executeRaw`
    UPDATE dbo.SeguimientoOperativoLead SET estado=${state},motivo=${motive},borrador=${text},id_externo=${externalId},
      ultimo_envio_utc=CASE WHEN ${state}='ENVIADO' THEN SYSUTCDATETIME() ELSE ultimo_envio_utc END,
      revision=revision+1,actualizado_utc=SYSUTCDATETIME()
    WHERE id_solicitud=${requestId};
    UPDATE dbo.Solicitudes SET fecha_proximo_seguimiento=NULL WHERE id_solicitud=${requestId};
    INSERT dbo.HistorialSeguimientoOperativoLead(id_solicitud,estado,motivo,borrador,revision)
    SELECT id_solicitud,estado,motivo,borrador,revision FROM dbo.SeguimientoOperativoLead WHERE id_solicitud=${requestId};
  `;
}

// Revisa consentimiento, respuestas y control humano; al llegar la fecha, prepara y envía un único seguimiento.
export async function processWhatsAppFollowUp(settings: ReturnType<typeof leadWhatsAppSettings>, requestId: number) {
  await prisma.$transaction(async tx => {
    const initial = await latestOffer(tx, settings.sessionId, requestId);
    if (!initial) return;
    const scope = { sessionId: settings.sessionId, chat: initial.chat };
    await lockWhatsAppControl(tx, scope);
    const offer = await latestOffer(tx, settings.sessionId, requestId);
    if (!offer || offer.chat !== scope.chat) return;
    const row = await loadOpportunity(tx, requestId);
    const current = await loadFollowUp(tx, requestId);
    if (current?.estado === 'PAUSADO' || (current?.estado === 'CANCELADO' && !current.origen_whatsapp) ||
        current?.estado === 'FALLIDO') return;
    let automatic = current?.estado === 'PROGRAMADO' && current.origen_whatsapp ? current : undefined;
    const requested = explicitOrigin(automatic?.origen_whatsapp);
    const sourceId = requested ? automatic!.id_mensaje_origen_whatsapp! : offer.id;
    const blocked = async (reason: string) => {
      if (automatic) await setOutcome(tx, requestId, 'CANCELADO', reason);
    };
    if (!row || !activeOpportunity(row, scope.chat)) return blocked('La oportunidad dejó de admitir contacto por WhatsApp.');
    try { await assertWhatsAppContactAllowed(tx, scope); }
    catch (error) {
      if (!(error instanceof TransferError)) throw error;
      return blocked('El paciente retiró su autorización de contacto por WhatsApp.');
    }
    const control = await readWhatsAppControl(tx, scope);
    if (control?.decision === 'CONTROL_ASESOR' || await hasWhatsAppReview(tx, scope, requestId)) {
      // Un contacto acordado conserva su fecha mientras el asesor atiende el chat.
      if (requested) return;
      return blocked('El chat requiere atención del asesor.');
    }
    if (requested && offer.id > sourceId) return blocked('Se envió una nueva propuesta después de programar el contacto.');
    if (automatic?.origen_whatsapp === 'PACIENTE') {
      const [original] = await tx.$queryRaw<{ active: number }[]>`
        SELECT 1 AS active FROM dbo.MensajesWhatsAppLead
        WHERE id_mensaje=${sourceId} AND id_sesion=${scope.sessionId} AND chat=${scope.chat}
          AND id_solicitud=${requestId} AND tipo='ENTRADA'
      `;
      if (!original) return blocked('Cambió el chat asociado al contacto solicitado.');
    }
    const [later] = await tx.$queryRaw<{ found: number }[]>`
      SELECT TOP (1) 1 AS found FROM dbo.MensajesWhatsAppLead
      WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat} AND id_mensaje>${sourceId}
        AND ((tipo='ENTRADA' AND estado IN ('FINALIZADO','REVISION'))
          ${requested ? Prisma.empty : Prisma.sql`OR decision IN ('MENSAJE_ASESOR','CONTROL_ASESOR')`})
        AND id_externo<>${offer.externalId}
        ${requested ? Prisma.sql`AND ISNULL(decision,'')<>'CON_ASESOR'` : Prisma.empty}
        ${automatic?.origen_whatsapp === 'PACIENTE' ? Prisma.sql`AND ISNULL(decision,'') NOT IN ('SEGUIMIENTO_ACUSE','ESTADO_SEGUIMIENTO')` : Prisma.empty}
    `;
    if (later) return blocked(subsequentActivity);
    const [pendingReply] = await tx.$queryRaw<{ found: number }[]>`
      SELECT TOP (1) 1 AS found FROM dbo.MensajesWhatsAppLead
      WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat} AND id_mensaje>${sourceId}
        AND tipo='ENTRADA' AND estado IN ('PENDIENTE','PROCESANDO')`;
    if (pendingReply) return;

    const now = new Date();
    const configuredHours = Number(process.env.LEAD_FOLLOWUP_MIN_HOURS);
    const minimumHours = Number.isFinite(configuredHours) && configuredHours > 0 ? configuredHours : 24;
    const earliest = current?.ultimo_envio_utc ? new Date(current.ultimo_envio_utc.getTime() + minimumHours * 3600_000) : undefined;
    let due = row.fecha_proximo_seguimiento;
    let expiry: Date | null = null;
    let validSource = false;
    let expired = false;
    let promotion = false;
    try {
      const verified = await loadTransferOffer(tx, offer.personId, requestId, offer.optionId);
      if (verified.huella === offer.fingerprint && !verified.option.archivada_lead_en && verified.option.estado_respuesta !== 'Rechazada') {
        const proposal = verified.proposal;
        promotion = Boolean(proposal.id_promocion_lead || proposal.promocion_aplicada?.trim());
        try {
          await checkLeadProposalTerms(tx, verified);
          expiry = proposal.fecha_vigencia_hasta_utc_lead;
          validSource = true;
        } catch (error) {
          if (!(error instanceof TransferError)) throw error;
          if (error.reason === 'VIGENCIA_VENCIDA') {
            expiry = proposal.fecha_vigencia_hasta_utc_lead;
            expired = true;
            validSource = true;
          }
        }
        if (!expired && proposal.id_promocion_lead && !await tx.promocionesLead.findFirst({
          where: { id_promocion: proposal.id_promocion_lead, activo: true,
            OR: [{ id_servicio: null }, { id_servicio: proposal.id_servicio }] },
          select: { id_promocion: true },
        })) expired = true;
      }
    } catch (error) { if (!(error instanceof TransferError)) throw error; }
    if (!requested && !validSource) return blocked('La propuesta enviada cambió o dejó de estar disponible.');
    // El turno acordado con el paciente tiene prioridad sobre los plazos calculados por entrega o lectura.
    if (!requested) {
      if (!automatic && (due || (current?.id_mensaje_origen_whatsapp ?? 0n) >= offer.id)) return;
      const calculated = automaticFollowUpPlan({ ...offer, promotionExpiry: promotion ? expiry : null, earliest });
      if (!calculated) return blocked('La propuesta aún no tiene confirmación de WhatsApp ni una promoción con vigencia registrada.');
      const plan = calculated.due <= now && now >= followUpWindow(limaDay(calculated.due), calculated.turn).end
        ? { ...calculated, ...withinFollowUpHours(now) } : calculated;
      if (!automatic || automatic.id_mensaje_origen_whatsapp !== offer.id || automatic.origen_whatsapp !== plan.origin ||
          due?.getTime() !== plan.due.getTime() || automatic.turno_whatsapp !== plan.turn) {
        await saveSchedule(tx, requestId, offer.id, plan.origin, plan.due, current, plan.turn);
        automatic = await loadFollowUp(tx, requestId);
      }
      due = plan.due;
    }
    if (!automatic?.clave || !due || due > now) return;
    if (requested && now >= followUpWindow(limaDay(due), automatic.turno_whatsapp ?? 'noche').end) {
      return blocked(automatic.turno_whatsapp ? 'El turno solicitado terminó antes de que se pudiera enviar el mensaje.'
        : 'Terminó el horario de atención del día solicitado.');
    }
    if (earliest && now < earliest) return blocked('Se alcanzó la frecuencia de contacto configurada.');
    const service = row.Servicio?.nombre ?? 'tu tratamiento';
    const greeting = `Hola, ${row.Persona.nombres.trim().split(/\s+/)[0]} 👋`;
    let text = `${greeting} Retomamos por WhatsApp la propuesta de ${service}. ¿Te gustaría revisar las condiciones actuales?`;
    if (expired || (expiry && expiry <= now)) {
      const label = promotion ? 'promoción' : 'propuesta';
      text = `${greeting} La ${label} que te compartimos para ${service} ya venció. ¿Te gustaría que revisemos las opciones vigentes?`;
    } else if (expiry && (automatic.origen_whatsapp === 'VIGENCIA' || automatic.origen_whatsapp === 'LEIDO')) {
      const expires = new Intl.DateTimeFormat('es-PE', { dateStyle: 'full', timeStyle: 'short', timeZone: 'America/Lima', hour12: true })
        .format(expiry);
      const label = promotion ? 'promoción' : 'propuesta';
      text = `${greeting} Tu ${label} para ${service} sigue vigente hasta el ${expires} (hora de Lima). ¿Te gustaría aprovecharla o revisar alguna condición?`;
    } else if (expiry && automatic.origen_whatsapp === 'ENTREGADO') {
      text = `${greeting} Te escribimos para retomar la propuesta de ${service} que te compartimos. ¿Te gustaría que te enviemos un resumen?`;
    } else if (automatic.origen_whatsapp === 'PACIENTE') {
      text = `${greeting} Te escribimos como nos pediste para retomar la propuesta de ${service}. ¿Qué te gustaría revisar?`;
    }

    let sent: Awaited<ReturnType<typeof sendLeadWhatsApp>>;
    try { sent = await sendLeadWhatsApp(settings, `lead-seguimiento:${automatic.clave}`, scope.chat, text, undefined, { stableKey: true }); }
    catch (error) {
      if (!(error instanceof TransferError)) throw error;
      await setOutcome(tx, requestId, 'FALLIDO', 'OpenWA no confirmó el seguimiento. Revisa el chat antes de reenviar.', text);
      return;
    }
    await setOutcome(tx, requestId, 'ENVIADO', 'Seguimiento automático enviado por WhatsApp.', text, sent.messageId);
    const interaction = await tx.interacciones.create({ data: {
      id_persona: offer.personId, id_solicitud: requestId, id_canal: await whatsappChannelId(tx),
      tipo: 'Respuesta del chatbot', resultado: 'WhatsApp', mensaje: text,
    } });
    await tx.$executeRaw`
      INSERT dbo.MensajesWhatsAppLead(id_sesion,id_externo,chat,tipo,estado,id_persona,id_solicitud,id_propuesta,id_opcion,huella,texto,decision,id_interaccion,plan_respuesta)
      SELECT ${scope.sessionId},${sent.messageId},${scope.chat},'BOT','FINALIZADO',${offer.personId},${requestId},
        ${offer.proposalId},${offer.optionId},${offer.fingerprint},${text},'SEGUIMIENTO_ENVIADO',${interaction.id_interaccion},
        ${JSON.stringify({ offer: { personId: offer.personId, requestId, proposalId: offer.proposalId,
          optionId: offer.optionId, fingerprint: offer.fingerprint }, ...(expired || (expiry && expiry <= now) ? { offerFollowUp: 'nueva_oferta' } : {}) })}
      WHERE NOT EXISTS (SELECT 1 FROM dbo.MensajesWhatsAppLead WHERE id_sesion=${scope.sessionId} AND id_externo=${sent.messageId} AND tipo='BOT');
    `;
  }, whatsAppControlTransaction);
}

let processing = false;
// Evalúa en segundo plano qué ofertas requieren programar, actualizar o ejecutar su seguimiento automático.
export async function processWhatsAppFollowUps() {
  if (processing) return;
  processing = true;
  try {
    if (!await automaticFollowUpInstalled(prisma)) return;
    const settings = leadWhatsAppSettings();
    const rows = await prisma.$queryRaw<{ id: number }[]>`
      SELECT TOP (30) s.id_solicitud AS id
      FROM dbo.Solicitudes s
      LEFT JOIN dbo.SeguimientoOperativoLead f ON f.id_solicitud=s.id_solicitud
      CROSS APPLY (SELECT TOP (1) m.id_mensaje,m.id_externo,m.habilita_seguimiento_automatico,m.chat,m.id_propuesta
        FROM dbo.MensajesWhatsAppLead m WHERE m.id_sesion=${settings.sessionId} AND m.id_solicitud=s.id_solicitud
          AND m.estado='FINALIZADO' AND (m.tipo='OFERTA' OR (m.tipo='BOT' AND m.decision='CONTRAOFERTA'))
        ORDER BY m.id_mensaje DESC) offer
      LEFT JOIN dbo.ConfirmacionesWhatsAppLead ack ON ack.id_sesion=${settings.sessionId} AND ack.id_externo=offer.id_externo
      LEFT JOIN dbo.PropuestasEconomicasLead proposal ON proposal.id_propuesta=offer.id_propuesta
      WHERE (f.origen_whatsapp IS NOT NULL AND f.estado='PROGRAMADO' AND
        (s.fecha_proximo_seguimiento<=SYSUTCDATETIME() OR EXISTS (SELECT 1 FROM dbo.MensajesWhatsAppLead activity
          WHERE activity.id_sesion=${settings.sessionId} AND activity.chat=offer.chat
            AND activity.id_mensaje>f.id_mensaje_origen_whatsapp AND activity.id_externo<>offer.id_externo
            AND ((activity.tipo='ENTRADA' AND activity.estado IN ('FINALIZADO','REVISION')
              AND (f.origen_whatsapp NOT IN ('PACIENTE','ASESOR') OR ISNULL(activity.decision,'')<>'CON_ASESOR')
              AND (f.origen_whatsapp<>'PACIENTE' OR ISNULL(activity.decision,'') NOT IN ('SEGUIMIENTO_ACUSE','ESTADO_SEGUIMIENTO')))
              OR activity.decision='BAJA'
              OR (f.origen_whatsapp NOT IN ('PACIENTE','ASESOR') AND activity.decision IN ('CONTROL_ASESOR','MENSAJE_ASESOR'))))
          OR (f.origen_whatsapp NOT IN ('PACIENTE','ASESOR') AND f.id_mensaje_origen_whatsapp<>offer.id_mensaje)
          OR (f.origen_whatsapp='ENTREGADO' AND ack.lectura_detectada_utc IS NOT NULL)))
        OR (offer.habilita_seguimiento_automatico=1
          AND s.fecha_proximo_seguimiento IS NULL AND ISNULL(f.estado,'') NOT IN ('PAUSADO','FALLIDO')
          AND s.archivada_lead_en IS NULL AND s.estado IN ('Abierta',N'En negociación')
          AND ISNULL(s.resultado_comercial_lead,'PENDIENTE')='PENDIENTE'
          AND EXISTS (SELECT 1 FROM dbo.Personas p JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
            WHERE p.id_persona=s.id_persona AND p.autoriza_contacto=1 AND e.nombre='LEAD')
          AND (ISNULL(f.estado,'')<>'CANCELADO' OR f.origen_whatsapp IS NOT NULL)
          AND (f.id_mensaje_origen_whatsapp IS NULL OR f.id_mensaje_origen_whatsapp<offer.id_mensaje)
          AND (COALESCE(ack.lectura_detectada_utc,ack.entrega_detectada_utc) IS NOT NULL
            OR ((proposal.id_promocion_lead IS NOT NULL OR NULLIF(LTRIM(RTRIM(proposal.promocion_aplicada)),'') IS NOT NULL)
              AND proposal.fecha_vigencia_hasta_utc_lead>=DATEADD(day,-1,SYSUTCDATETIME())))
          AND NOT EXISTS (SELECT 1 FROM dbo.MensajesWhatsAppLead stop
            WHERE stop.id_sesion=${settings.sessionId} AND stop.chat=offer.chat AND stop.decision='BAJA')
          AND NOT EXISTS (SELECT 1 FROM dbo.MensajesWhatsAppLead control WHERE control.id_mensaje=(
            SELECT MAX(c.id_mensaje) FROM dbo.MensajesWhatsAppLead c WHERE c.id_sesion=${settings.sessionId}
              AND c.chat=offer.chat AND c.tipo='BOT' AND c.decision IN ('CONTROL_ASESOR','CONTROL_BOT'))
            AND control.decision='CONTROL_ASESOR')
          AND NOT EXISTS (SELECT 1 FROM dbo.MensajesWhatsAppLead e WHERE e.id_sesion=${settings.sessionId}
            AND e.chat=offer.chat AND e.id_mensaje>offer.id_mensaje AND e.id_externo<>offer.id_externo
            AND (e.tipo='ENTRADA' OR e.decision='MENSAJE_ASESOR')))
      ORDER BY CASE WHEN s.fecha_proximo_seguimiento IS NOT NULL THEN 0 ELSE 1 END,s.fecha_proximo_seguimiento,offer.id_mensaje DESC
    `;
    for (const { id } of rows) {
      try { await processWhatsAppFollowUp(settings, id); }
      catch (error) { console.warn('[Seguimiento WhatsApp LEAD] No se pudo procesar la solicitud', id, error instanceof Error ? error.name : 'Error'); }
    }
  } catch (error) {
    console.warn('[Seguimiento WhatsApp LEAD] No se pudo consultar la cola.', error instanceof Error ? error.name : 'Error');
  } finally { processing = false; }
}

export function startWhatsAppFollowUps() {
  if (!process.env.OPENWA_SESSION_ID?.trim() || !process.env.OPENWA_LEAD_WEBHOOK_SECRET?.trim()) return;
  setInterval(() => void processWhatsAppFollowUps(), 30_000).unref();
}
