import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { TransferError, transferIsolation } from './leadPayerTransfer';
import type { leadWhatsAppSettings } from './leadWhatsApp';

type Db = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
export type WhatsAppScope = { sessionId: string; chat: string };
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

export async function recordWhatsAppOffer(db: Db, scope: WhatsAppScope, offer: WhatsAppOffer, externalId: string) {
  // Store references only. The outbound proposal can contain a private reservation link.
  await db.$executeRaw`
    INSERT dbo.MensajesWhatsAppLead
      (id_sesion, id_externo, chat, tipo, estado, id_persona, id_solicitud, id_propuesta, id_opcion, huella)
    SELECT ${scope.sessionId}, ${externalId}, ${scope.chat}, 'OFERTA', 'FINALIZADO',
      ${offer.personId}, ${offer.requestId}, ${offer.proposalId}, ${offer.optionId}, ${offer.fingerprint}
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

export async function enqueueWhatsAppMessage(
  scope: WhatsAppScope,
  message: { id: string; quotedId: string | null; text: string; optOut: boolean },
) {
  await prisma.$executeRaw`
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

export async function findWhatsAppOffers(db: Db, job: WhatsAppJob, includeExpired = false) {
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
    SELECT TOP (1) id_externo AS externalId, plan_respuesta AS [plan]
    FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${job.sessionId} AND chat=${job.chat} AND tipo IN ('OFERTA','BOT')
      AND estado='FINALIZADO' AND fecha_utc<=${job.receivedAt}
    ORDER BY id_mensaje DESC
  `;
  return message;
}

export async function whatsappChannelId(db: Pick<Prisma.TransactionClient, 'canales'>) {
  const channel = await db.canales.findFirst({ where: { nombre: 'WhatsApp', activo: true }, select: { id_canal: true } });
  if (!channel) throw new Error('No existe un canal WhatsApp activo.');
  return channel.id_canal;
}

export async function chatHistoryForOffer(job: WhatsAppJob, offer: WhatsAppOffer) {
  return prisma.$queryRaw<{ messageId: bigint; type: 'ENTRADA' | 'BOT'; text: string; externalId: string; plan: string | null }[]>`
    SELECT TOP (30) id_mensaje AS messageId,tipo AS type,texto AS text,id_externo AS externalId,plan_respuesta AS [plan]
    FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${job.sessionId} AND chat=${job.chat} AND id_solicitud=${offer.requestId}
      AND (tipo='BOT' OR (tipo='ENTRADA' AND id_mensaje<${job.id}))
      AND texto IS NOT NULL AND estado IN ('FINALIZADO','REVISION')
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

export async function isWhatsAppWithAdvisor(job: WhatsAppJob, offer: WhatsAppOffer) {
  const [row] = await prisma.$queryRaw<{ paused: number }[]>`
    SELECT TOP (1) 1 AS paused FROM dbo.MensajesWhatsAppLead
    WHERE id_sesion=${job.sessionId} AND chat=${job.chat} AND id_solicitud=${offer.requestId}
      AND tipo='ENTRADA' AND estado='REVISION' AND id_mensaje<${job.id}
      AND id_mensaje>COALESCE((
        SELECT MAX(id_mensaje) FROM dbo.MensajesWhatsAppLead
        WHERE id_sesion=${job.sessionId} AND chat=${job.chat} AND id_solicitud=${offer.requestId} AND tipo='OFERTA'
      ),0)
  `;
  return Boolean(row);
}

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

export async function saveWhatsAppPlan(job: WhatsAppJob, plan: object, decision: string) {
  const changed = await prisma.$executeRaw`
    UPDATE dbo.MensajesWhatsAppLead SET plan_respuesta=${JSON.stringify(plan)}, decision=${decision}
    WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
  `;
  if (changed !== 1) throw new Error('La toma del mensaje ya no está vigente.');
}

export async function finishWhatsAppMessage(
  job: WhatsAppJob, decision: string,
  outbound?: { text: string; externalId: string; offer?: WhatsAppOffer; review?: boolean },
  review = false,
) {
  await prisma.$transaction(async tx => {
    const changed = await tx.$executeRaw`
      UPDATE dbo.MensajesWhatsAppLead
      SET estado=${review ? 'REVISION' : 'FINALIZADO'}, decision=${decision}
      WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
    `;
    if (changed !== 1 || !outbound) return;
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
  }, transferIsolation);
}

export async function retryWhatsAppMessage(job: WhatsAppJob) {
  if (job.attempts >= 3) {
    await prisma.$transaction(async tx => {
      const [row] = await tx.$queryRaw<{ interactionId: number | null }[]>`
        UPDATE dbo.MensajesWhatsAppLead SET estado='REVISION',decision='FALLO'
        OUTPUT inserted.id_interaccion AS interactionId
        WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
      `;
      if (row?.interactionId) await tx.interacciones.update({
        where: { id_interaccion: row.interactionId }, data: { resultado: 'WhatsApp · requiere asesor' },
      });
    }, transferIsolation);
    return;
  }
  await prisma.$executeRaw`
    UPDATE dbo.MensajesWhatsAppLead
    SET estado='PENDIENTE', disponible_utc=DATEADD(second,15*intentos,SYSUTCDATETIME())
    WHERE id_mensaje=${job.id} AND toma_utc=${job.claimedAt} AND estado='PROCESANDO'
  `;
}
