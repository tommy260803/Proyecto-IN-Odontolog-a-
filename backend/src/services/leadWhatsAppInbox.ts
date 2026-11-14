import { createHash, randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Request } from 'express';
import { prisma } from '../db';
import { TransferError, transferIsolation } from './leadPayerTransfer';
import { whatsAppChatId, type leadWhatsAppSettings } from './leadWhatsApp';
import { publishWhatsAppAlertChange } from './leadWhatsAppAlertEvents';
import { leadOperationalPriority } from './leadOperationalPriority';

type Db = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
export type WhatsAppScope = { sessionId: string; chat: string };
export type WhatsAppControlOwner = { key: string; name: string };

export function whatsAppControlOwnerKey(req: Request, staffId: number | null) {
  if (staffId !== null) return 'staff:' + staffId;
  const token = req.get('X-Lead-Operator');
  return token && /^[a-f0-9-]{36}$/i.test(token) ? 'local:' + createHash('sha256').update(token).digest('hex') : null;
}
export type WhatsAppOffer = { personId: number; requestId: number; proposalId: number; optionId: number; fingerprint: string };
export type WhatsAppJob = {
  id: bigint; sessionId: string; chat: string; externalId: string; quotedId: string | null;
  text: string; receivedAt: Date; claimedAt: Date; attempts: number;
  interactionId: number | null; plan: string | null;
};

export function chatbotWebhookSecret() {
  return process.env.OPENWA_LEAD_WEBHOOK_SECRET?.trim() ?? '';
}

export async function chatbotSchemaInstalled(db: Db) {
  const [row] = await db.$queryRaw<{ present: number }[]>`
    SELECT CASE WHEN OBJECT_ID('dbo.MensajesWhatsAppLead','U') IS NULL THEN 0 ELSE 1 END AS present
  `;
  return row?.present === 1;
}

export async function resolveWhatsAppContact(settings: ReturnType<typeof leadWhatsAppSettings>, jid: string) {
  if (/^[1-9]\d{7,14}@(c\.us|s\.whatsapp\.net)$/.test(jid)) return jid.split('@')[0] + '@c.us';
  if (!/^\d{1,24}@lid$/.test(jid)) return null;
  const response = await fetch(
    `${settings.base}/api/sessions/${encodeURIComponent(settings.sessionId)}/contacts/${encodeURIComponent(jid)}/phone`, {
      headers: { 'X-API-Key': settings.apiKey },
      redirect: 'error',
      signal: AbortSignal.timeout(3000),
    },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('No se pudo resolver la identidad de WhatsApp.');
  const result = await response.json();
  const phone = typeof result.phone === 'string' ? result.phone.replace(/^\+/, '').replace(/@c\.us$/, '') : '';
  return /^[1-9]\d{7,14}$/.test(phone) ? phone + '@c.us' : null;
}

export async function recordWhatsAppOffer(db: Db, scope: WhatsAppScope, offer: WhatsAppOffer, externalId: string, plan?: object) {
  // Store references only. The outbound proposal can contain a private reservation link.
  await db.$executeRaw`
    INSERT dbo.MensajesWhatsAppLead
      (id_sesion, id_externo, chat, tipo, estado, id_persona, id_solicitud, id_propuesta, id_opcion, huella, plan_respuesta)
    SELECT ${scope.sessionId}, ${externalId}, ${scope.chat}, 'OFERTA', 'FINALIZADO',
      ${offer.personId}, ${offer.requestId}, ${offer.proposalId}, ${offer.optionId}, ${offer.fingerprint}, ${plan ? JSON.stringify(plan) : null}
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.MensajesWhatsAppLead WITH (UPDLOCK,HOLDLOCK)
      WHERE id_sesion=${scope.sessionId} AND id_externo=${externalId} AND tipo='OFERTA'
    )
  `;
}

export async function assertWhatsAppContactAllowed(db: Db, scope: WhatsAppScope) {
  const [row] = await db.$queryRaw<{ blocked: number }[]>`
    SELECT TOP (1) 1 AS blocked FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat} AND decision='BAJA'
  `;
  if (row) throw new TransferError('El cliente pidió dejar de recibir mensajes por WhatsApp.', 403);
}

// Guarda la entrada de WhatsApp una sola vez para procesarla aunque el conector repita el aviso.
export async function enqueueWhatsAppMessage(
  scope: WhatsAppScope,
  message: { id: string; quotedId: string | null; text: string; optOut: boolean },
) {
  const inserted = await prisma.$executeRaw`
    INSERT dbo.MensajesWhatsAppLead (id_sesion,id_externo,chat,id_citado,tipo,estado,texto,decision)
    SELECT ${scope.sessionId},${message.id},${scope.chat},${message.quotedId},'ENTRADA','PENDIENTE',
      ${message.text},${message.optOut ? 'BAJA' : null}
    WHERE EXISTS (
      SELECT 1 FROM dbo.MensajesWhatsAppLead
      WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat} AND tipo='OFERTA'
    ) AND NOT EXISTS (
      SELECT 1 FROM dbo.MensajesWhatsAppLead WITH (UPDLOCK,HOLDLOCK)
      WHERE id_sesion=${scope.sessionId} AND id_externo=${message.id} AND tipo='ENTRADA'
    )
  `;
  if (inserted && message.optOut) publishWhatsAppAlertChange(scope.sessionId);
}

export async function claimWhatsAppMessage(sessionId: string) {
  const [job] = await prisma.$queryRaw<WhatsAppJob[]>`
    ;WITH next_message AS (
      SELECT TOP (1) m.* FROM dbo.MensajesWhatsAppLead m WITH (UPDLOCK,ROWLOCK)
      WHERE m.id_sesion=${sessionId} AND m.tipo='ENTRADA'
        AND ((m.estado='PENDIENTE' AND m.disponible_utc<=SYSUTCDATETIME()) OR
          (m.estado='PROCESANDO' AND m.toma_utc<DATEADD(minute,-2,SYSUTCDATETIME())))
        AND NOT EXISTS (
          SELECT 1 FROM dbo.MensajesWhatsAppLead earlier
          WHERE earlier.id_sesion=m.id_sesion AND earlier.chat=m.chat AND earlier.tipo='ENTRADA'
            AND earlier.id_mensaje<m.id_mensaje AND earlier.estado IN ('PENDIENTE','PROCESANDO')
        )
      ORDER BY m.id_mensaje
    )
    UPDATE next_message SET estado='PROCESANDO', toma_utc=SYSUTCDATETIME(), intentos=intentos+1
    OUTPUT inserted.id_mensaje AS id, inserted.id_sesion AS sessionId, inserted.chat,
      inserted.id_externo AS externalId, inserted.id_citado AS quotedId, inserted.texto AS text,
      inserted.fecha_utc AS receivedAt, inserted.toma_utc AS claimedAt, inserted.intentos AS attempts,
      inserted.id_interaccion AS interactionId, inserted.plan_respuesta AS [plan];
  `;
  return job;
}

export async function findWhatsAppOffers(db: Db, job: WhatsAppJob, includeExpired = false, requestId?: number) {
  // An exact quote can point to an expired offer. The agent then explains or finds a replacement.
  // Without a quote, use only current offers and ask if several remain possible.
  return db.$queryRaw<WhatsAppOffer[]>`
    SELECT TOP (2) m.id_persona AS personId, m.id_solicitud AS requestId, m.id_propuesta AS proposalId,
      m.id_opcion AS optionId, m.huella AS fingerprint
    FROM dbo.MensajesWhatsAppLead m
    JOIN dbo.Solicitudes s ON s.id_solicitud=m.id_solicitud AND s.id_persona=m.id_persona
    JOIN dbo.Personas p ON p.id_persona=s.id_persona
    JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
    JOIN dbo.Opciones o ON o.id_opcion=m.id_opcion AND o.id_solicitud=s.id_solicitud
    JOIN dbo.PropuestasEconomicasLead q ON q.id_propuesta=m.id_propuesta AND q.id_solicitud=s.id_solicitud
    WHERE m.id_sesion=${job.sessionId} AND m.chat=${job.chat} AND m.estado='FINALIZADO'
      AND m.tipo IN ('OFERTA','BOT') AND m.fecha_utc<=${job.receivedAt}
      AND p.autoriza_contacto=1 AND e.nombre='LEAD' AND s.archivada_lead_en IS NULL
      AND s.estado IN ('Abierta',N'En negociación')
      AND COALESCE(s.resultado_comercial_lead,'')<>'CERRADA_SIN_ACUERDO'
      ${requestId === undefined ? Prisma.empty : Prisma.sql`AND m.id_solicitud=${requestId}`}
      ${job.quotedId ? Prisma.sql`AND m.id_externo=${job.quotedId}` : Prisma.sql`
        AND (m.tipo='OFERTA' OR m.decision='CONTRAOFERTA')
        ${includeExpired ? Prisma.empty : Prisma.sql`
          AND o.archivada_lead_en IS NULL AND COALESCE(o.estado_respuesta,'')<>'Rechazada'
          AND q.estado<>'Rechazada' AND q.fecha_vigencia_hasta_utc_lead>SYSUTCDATETIME()
          AND NOT EXISTS (SELECT 1 FROM dbo.PropuestasEconomicasLead v
          WHERE COALESCE(v.id_propuesta_raiz,v.id_propuesta)=COALESCE(q.id_propuesta_raiz,q.id_propuesta)
            AND v.numero_version>q.numero_version)`}`}
    GROUP BY m.id_persona,m.id_solicitud,m.id_propuesta,m.id_opcion,m.huella
    ORDER BY MAX(m.id_mensaje) DESC;
  `;
}

export async function latestWhatsAppOutbound(job: WhatsAppJob) {
  const [message] = await prisma.$queryRaw<{ externalId: string; plan: string | null }[]>`
    SELECT TOP (1) m.id_externo AS externalId, m.plan_respuesta AS [plan]
    FROM dbo.MensajesWhatsAppLead m
    WHERE m.id_sesion=${job.sessionId} AND m.chat=${job.chat} AND (m.tipo='OFERTA' OR (m.tipo='BOT' AND m.texto IS NOT NULL))
      AND m.estado='FINALIZADO' AND m.fecha_utc<=${job.receivedAt}
      AND NOT (m.tipo='BOT' AND m.decision='MENSAJE_ASESOR' AND EXISTS (
        SELECT 1 FROM dbo.MensajesWhatsAppLead o WHERE o.id_sesion=m.id_sesion AND o.id_externo=m.id_externo
          AND o.tipo='OFERTA' AND o.plan_respuesta IS NOT NULL
      ))
    ORDER BY m.id_mensaje DESC
  `;
  return message;
}

export async function whatsappChannelId(db: Pick<Prisma.TransactionClient, 'canales'>) {
  const channel = await db.canales.findFirst({ where: { nombre: 'WhatsApp', activo: true }, select: { id_canal: true } });
  if (!channel) throw new Error('No existe un canal WhatsApp activo.');
  return channel.id_canal;
}

export async function chatHistoryForOffer(job: WhatsAppJob, offer: WhatsAppOffer) {
  return prisma.$queryRaw<{ messageId: bigint; type: 'ENTRADA' | 'BOT'; text: string; externalId: string; plan: string | null; decision: string | null }[]>`
    SELECT TOP (30) id_mensaje AS messageId,tipo AS type,texto AS text,id_externo AS externalId,plan_respuesta AS [plan],decision
    FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${job.sessionId} AND chat=${job.chat} AND id_solicitud=${offer.requestId}
      AND (tipo='BOT' OR (tipo='ENTRADA' AND id_mensaje<${job.id}))
      AND texto IS NOT NULL AND estado IN ('FINALIZADO','REVISION')
      AND id_mensaje>COALESCE((SELECT MAX(o.id_mensaje) FROM dbo.MensajesWhatsAppLead o
        WHERE o.id_sesion=${job.sessionId} AND o.chat=${job.chat} AND o.id_solicitud=${offer.requestId}
          AND o.tipo='OFERTA' AND o.fecha_utc<=${job.receivedAt}
          AND JSON_VALUE(CASE WHEN ISJSON(o.plan_respuesta)=1 THEN o.plan_respuesta END,'$.revisionInteractionId') IS NOT NULL),0)
    ORDER BY ${job.quotedId ? Prisma.sql`CASE WHEN tipo='BOT' AND id_externo=${job.quotedId} THEN 0 ELSE 1 END,` : Prisma.empty}
      id_mensaje DESC;
  `;
}

export async function wasWhatsAppMenuShown(job: WhatsAppJob, offer: WhatsAppOffer) {
  const [row] = await prisma.$queryRaw<{ shown: number }[]>`
    SELECT TOP (1) 1 AS shown FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${job.sessionId} AND chat=${job.chat} AND id_solicitud=${offer.requestId}
      AND tipo='BOT' AND decision='MENU'
  `;
  return Boolean(row);
}

export async function readWhatsAppControl(db: Db, scope: WhatsAppScope) {
  const [control] = await db.$queryRaw<{
    id: bigint; requestId: number; decision: 'CONTROL_ASESOR' | 'CONTROL_BOT'; ownerKey: string | null; ownerName: string | null;
  }[]>`
    SELECT TOP (1) m.id_mensaje AS id,m.id_solicitud AS requestId,
      CASE WHEN m.decision='CONTROL_ASESOR' AND
        (s.archivada_lead_en IS NOT NULL OR s.estado NOT IN ('Abierta',N'En negociación')
          OR COALESCE(s.resultado_comercial_lead,'') IN ('ACEPTADA','CERRADA_SIN_ACUERDO') OR e.nombre<>'LEAD')
        THEN 'CONTROL_BOT' ELSE m.decision END AS decision,
      JSON_VALUE(CASE WHEN ISJSON(m.plan_respuesta)=1 THEN m.plan_respuesta END,'$.key') AS ownerKey,
      JSON_VALUE(CASE WHEN ISJSON(m.plan_respuesta)=1 THEN m.plan_respuesta END,'$.name') AS ownerName
    FROM dbo.MensajesWhatsAppLead m
    JOIN dbo.Solicitudes s ON s.id_solicitud=m.id_solicitud
    JOIN dbo.Personas p ON p.id_persona=s.id_persona
    JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
    WHERE m.id_sesion=${scope.sessionId} AND m.chat=${scope.chat}
      AND m.tipo='BOT' AND m.decision IN ('CONTROL_ASESOR','CONTROL_BOT')
    ORDER BY m.id_mensaje DESC
  `;
  return control;
}

export async function latestWhatsAppOfferForRequest(db: Db, scope: WhatsAppScope, requestId: number) {
  const [offer] = await db.$queryRaw<WhatsAppOffer[]>`
    SELECT TOP (1) id_persona AS personId,id_solicitud AS requestId,id_propuesta AS proposalId,
      id_opcion AS optionId,huella AS fingerprint
    FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat} AND id_solicitud=${requestId}
      AND tipo='OFERTA' AND estado='FINALIZADO'
      AND id_persona IS NOT NULL AND id_propuesta IS NOT NULL AND id_opcion IS NOT NULL AND huella IS NOT NULL
    ORDER BY id_mensaje DESC
  `;
  return offer;
}

export async function lockWhatsAppControl(tx: Prisma.TransactionClient, scope: WhatsAppScope) {
  const key = 'LEAD:WhatsApp:' + createHash('sha256').update(JSON.stringify([scope.sessionId, scope.chat])).digest('hex');
  const [lock] = await tx.$queryRaw<{ code: number }[]>`
    DECLARE @code int;
    EXEC @code=sys.sp_getapplock @Resource=${key},@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=25000;
    SELECT @code AS code;
  `;
  if (!lock || lock.code < 0) throw new TransferError('Hay un envío o cambio de control en curso. Intenta nuevamente.');
}

export function assertWhatsAppControlOwner(control: Awaited<ReturnType<typeof readWhatsAppControl>>, requestId: number, ownerKey: string | null) {
  if (control?.decision !== 'CONTROL_ASESOR') return;
  if (control.requestId !== requestId) throw new TransferError('Este chat ya está bajo control de otra oportunidad.');
  if (control.ownerKey && control.ownerKey !== ownerKey) {
    throw new TransferError('Esta conversación ya está siendo atendida por ' + (control.ownerName || 'otro asesor') + '.');
  }
}

export const whatsAppControlTransaction = { maxWait: 5000, timeout: 50000 } as const;

export async function recordWhatsAppControl(tx: Db, scope: WhatsAppScope, offer: WhatsAppOffer, owner: WhatsAppControlOwner | null) {
  await tx.$executeRaw`
    INSERT dbo.MensajesWhatsAppLead
      (id_sesion,id_externo,chat,tipo,estado,id_persona,id_solicitud,id_propuesta,id_opcion,huella,decision,plan_respuesta)
    VALUES (${scope.sessionId},${'control:' + randomUUID()},${scope.chat},'BOT','FINALIZADO',
      ${offer.personId},${offer.requestId},${offer.proposalId},${offer.optionId},${offer.fingerprint},
      ${owner ? 'CONTROL_ASESOR' : 'CONTROL_BOT'},${owner ? JSON.stringify(owner) : null})
  `;
}

export async function recordWhatsAppAdvisorMessage(
  tx: Prisma.TransactionClient, scope: WhatsAppScope, offer: WhatsAppOffer, actorId: number | null,
  externalId: string, text: string,
) {
  const [previous] = await tx.$queryRaw<{ requestId: number; interactionId: number }[]>`
    SELECT id_solicitud AS requestId,id_interaccion AS interactionId FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${scope.sessionId} AND id_externo=${externalId} AND tipo='BOT' AND decision='MENSAJE_ASESOR'
  `;
  if (previous) {
    if (previous.requestId !== offer.requestId) throw new TransferError('El envío ya pertenece a otra oportunidad.');
    return previous.interactionId;
  }
  const interaction = await tx.interacciones.create({ data: {
    id_persona: offer.personId, id_solicitud: offer.requestId, id_usuario: actorId,
    id_canal: await whatsappChannelId(tx), tipo: 'Respuesta del asesor', resultado: 'WhatsApp',
    mensaje: text, fecha_hora: new Date(),
  } });
  await tx.$executeRaw`
    INSERT dbo.MensajesWhatsAppLead
      (id_sesion,id_externo,chat,tipo,estado,id_persona,id_solicitud,id_propuesta,id_opcion,huella,id_interaccion,texto,decision)
    VALUES (${scope.sessionId},${externalId},${scope.chat},'BOT','FINALIZADO',${offer.personId},
      ${offer.requestId},${offer.proposalId},${offer.optionId},${offer.fingerprint},
      ${interaction.id_interaccion},${text},'MENSAJE_ASESOR')
  `;
  return interaction.id_interaccion;
}

export async function hasWhatsAppReview(db: Db, scope: WhatsAppScope, requestId: number, before?: bigint) {
  const [row] = await db.$queryRaw<{ paused: number }[]>`
    SELECT TOP (1) 1 AS paused FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat} AND id_solicitud=${requestId}
      AND tipo='ENTRADA' AND estado='REVISION'
      ${before === undefined ? Prisma.empty : Prisma.sql`AND id_mensaje<${before}`}
      AND id_mensaje>COALESCE((
        SELECT MAX(id_mensaje) FROM dbo.MensajesWhatsAppLead
        WHERE id_sesion=${scope.sessionId} AND chat=${scope.chat} AND id_solicitud=${requestId}
          AND (tipo='OFERTA' OR (tipo='BOT' AND decision='CONTROL_BOT'))
      ),0)
  `;
  return Boolean(row);
}

export async function listWhatsAppReviews(db: Db, sessionId: string, advisorId: number | null) {
  const rows = await db.$queryRaw<{
    id: string; requestId: number; personId: number; chat: string; phone: string | null; receivedAt: Date;
    followUp: Date | null; firstResponse: Date | null;
  }[]>`
    WITH Pending AS (
      SELECT r.id_mensaje, r.id_solicitud, p.id_persona, r.chat, p.numero, r.fecha_utc,
        s.fecha_proximo_seguimiento, s.fecha_primera_respuesta,
        ROW_NUMBER() OVER (PARTITION BY r.id_solicitud, r.chat ORDER BY r.id_mensaje DESC) AS position
      FROM dbo.MensajesWhatsAppLead r
      JOIN dbo.Solicitudes s ON s.id_solicitud=r.id_solicitud
      JOIN dbo.Personas p ON p.id_persona=s.id_persona
      JOIN dbo.Etapas e ON e.id_etapa=p.id_etapa_actual
      OUTER APPLY (
        SELECT TOP (1) c.decision, c.id_solicitud
        FROM dbo.MensajesWhatsAppLead c
        WHERE c.id_sesion=r.id_sesion AND c.chat=r.chat
          AND c.tipo='BOT' AND c.decision IN ('CONTROL_ASESOR','CONTROL_BOT')
        ORDER BY c.id_mensaje DESC
      ) control
      WHERE r.id_sesion=${sessionId} AND r.tipo='ENTRADA' AND r.estado='REVISION'
        AND p.autoriza_contacto=1 AND e.nombre='LEAD' AND s.archivada_lead_en IS NULL
        AND s.estado IN ('Abierta',N'En negociación')
        AND COALESCE(s.resultado_comercial_lead,'') NOT IN ('ACEPTADA','CERRADA_SIN_ACUERDO')
        ${advisorId === null ? Prisma.empty : Prisma.sql`AND s.id_negociador=${advisorId}`}
        AND EXISTS (
          SELECT 1 FROM dbo.MensajesWhatsAppLead o
          WHERE o.id_sesion=r.id_sesion AND o.chat=r.chat AND o.id_solicitud=r.id_solicitud
            AND o.tipo='OFERTA' AND o.estado='FINALIZADO' AND o.id_mensaje<r.id_mensaje
        )
        AND NOT EXISTS (
          SELECT 1 FROM dbo.MensajesWhatsAppLead m
          WHERE m.id_sesion=r.id_sesion AND m.chat=r.chat AND (
            m.decision='BAJA' OR (m.id_solicitud=r.id_solicitud AND m.id_mensaje>r.id_mensaje
              AND (m.tipo='OFERTA' OR (m.tipo='BOT' AND m.decision IN ('CONTROL_ASESOR','CONTROL_BOT'))))
          )
        )
        AND NOT EXISTS (
          SELECT 1 FROM dbo.Solicitudes owned
          JOIN dbo.Personas owner ON owner.id_persona=owned.id_persona
          JOIN dbo.Etapas stage ON stage.id_etapa=owner.id_etapa_actual
          WHERE control.decision='CONTROL_ASESOR' AND owned.id_solicitud=control.id_solicitud
            AND owned.archivada_lead_en IS NULL AND owned.estado IN ('Abierta',N'En negociación')
            AND COALESCE(owned.resultado_comercial_lead,'') NOT IN ('ACEPTADA','CERRADA_SIN_ACUERDO')
            AND stage.nombre='LEAD'
        )
    )
    SELECT CONVERT(varchar(20), id_mensaje) AS id, id_solicitud AS requestId, id_persona AS personId,
      chat, numero AS phone, fecha_utc AS receivedAt, fecha_proximo_seguimiento AS followUp,
      fecha_primera_respuesta AS firstResponse
    FROM Pending WHERE position=1 ORDER BY id_mensaje DESC
  `;
  const now = new Date();
  return rows.flatMap(({ phone, chat, followUp, firstResponse, ...alert }) => {
    try {
      return whatsAppChatId(phone) === chat
        ? [{ ...alert, prioridad: leadOperationalPriority({ active: true, followUp, firstResponse }, now) }] : [];
    } catch (error) {
      if (!(error instanceof TransferError)) throw error;
      return [];
    }
  }).sort((a, b) => a.prioridad.orden - b.prioridad.orden);
}

export async function isWhatsAppWithAdvisor(job: WhatsAppJob, offer: WhatsAppOffer) {
  const control = await readWhatsAppControl(prisma, job);
  return control?.decision === 'CONTROL_ASESOR' || Boolean(control && job.id < control.id) ||
    await hasWhatsAppReview(prisma, job, offer.requestId, job.id);
}

// Relaciona el mensaje recibido con la persona, solicitud, propuesta y alternativa que se están negociando.
export async function recordWhatsAppInbound(job: WhatsAppJob, offer: WhatsAppOffer) {
  if (job.interactionId) return;
  await prisma.$transaction(async tx => {
    const channel = await whatsappChannelId(tx);
    const entry = await tx.interacciones.create({ data: {
      id_persona: offer.personId, id_solicitud: offer.requestId, id_canal: channel,
      tipo: 'Respuesta del paciente', resultado: 'WhatsApp', mensaje: job.text, fecha_hora: job.receivedAt,
    } });
    const changed = await tx.$executeRaw`
      UPDATE dbo.MensajesWhatsAppLead SET id_interaccion=${entry.id_interaccion}, id_persona=${offer.personId},
        id_solicitud=${offer.requestId},id_propuesta=${offer.proposalId},id_opcion=${offer.optionId},huella=${offer.fingerprint}
      WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO' AND id_interaccion IS NULL
    `;
    if (changed !== 1) throw new Error('La toma del mensaje ya no está vigente.');
  }, transferIsolation);
}

export async function saveWhatsAppPlan(job: WhatsAppJob, plan: object, decision: string, db: Db = prisma) {
  const changed = await db.$executeRaw`
    UPDATE dbo.MensajesWhatsAppLead SET plan_respuesta=${JSON.stringify(plan)}, decision=${decision}
    WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
  `;
  if (changed !== 1) throw new Error('La toma del mensaje ya no está vigente.');
}

// Registra el resultado del bot y su respuesta; una derivación queda pendiente de revisión por el asesor.
export async function finishWhatsAppMessage(
  job: WhatsAppJob, decision: string,
  outbound?: { text: string; externalId: string; offer?: WhatsAppOffer; review?: boolean },
  review = false,
  transaction?: Prisma.TransactionClient,
) {
  const finish = async (tx: Prisma.TransactionClient) => {
    const changed = await tx.$executeRaw`
      UPDATE dbo.MensajesWhatsAppLead
      SET estado=${review ? 'REVISION' : 'FINALIZADO'}, decision=${decision}
      WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
    `;
    if (changed !== 1 || !outbound) return changed === 1 && review;
    const offer = outbound.offer;
    const interaction = offer && await tx.interacciones.create({ data: {
      id_persona: offer.personId, id_solicitud: offer.requestId, id_canal: await whatsappChannelId(tx),
      tipo: 'Respuesta del chatbot', mensaje: outbound.text,
      resultado: outbound.review ? 'Requiere asesor' : 'WhatsApp',
    } });
    await tx.$executeRaw`
      INSERT dbo.MensajesWhatsAppLead (id_sesion,id_externo,chat,tipo,estado,texto,decision,plan_respuesta,
        id_persona,id_solicitud,id_propuesta,id_opcion,huella,id_interaccion)
      SELECT ${job.sessionId},${outbound.externalId},${job.chat},'BOT','FINALIZADO',${outbound.text},${decision},plan_respuesta,
        ${offer?.personId ?? null},${offer?.requestId ?? null},${offer?.proposalId ?? null},${offer?.optionId ?? null},
        ${offer?.fingerprint ?? null},${interaction ? interaction.id_interaccion : null}
      FROM dbo.MensajesWhatsAppLead WHERE id_mensaje=${job.id}
    `;
    return review;
  };
  if (transaction) return finish(transaction);
  const reviewCommitted = await prisma.$transaction(finish, transferIsolation);
  if (reviewCommitted) publishWhatsAppAlertChange(job.sessionId);
  return reviewCommitted;
}

export async function retryWhatsAppMessage(job: WhatsAppJob) {
  if (job.attempts >= 3) {
    const reviewCommitted = await prisma.$transaction(async tx => {
      const [row] = await tx.$queryRaw<{ interactionId: number | null }[]>`
        UPDATE dbo.MensajesWhatsAppLead SET estado='REVISION',decision='FALLO'
        OUTPUT inserted.id_interaccion AS interactionId
        WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
      `;
      if (row?.interactionId) await tx.interacciones.update({
        where: { id_interaccion: row.interactionId }, data: { resultado: 'WhatsApp · requiere asesor' },
      });
      return Boolean(row);
    }, transferIsolation);
    if (reviewCommitted) publishWhatsAppAlertChange(job.sessionId);
    return;
  }
  await prisma.$executeRaw`
    UPDATE dbo.MensajesWhatsAppLead
    SET estado='PENDIENTE', disponible_utc=DATEADD(second,15*intentos,SYSUTCDATETIME())
    WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
  `;
}
