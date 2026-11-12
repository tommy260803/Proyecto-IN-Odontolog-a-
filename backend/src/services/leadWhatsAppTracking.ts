import { Prisma } from '@prisma/client';

type Database = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;
export type WhatsAppTracking = {
  id: string;
  id_interaccion: number | null;
  tipo: 'OFERTA' | 'BOT';
  id_propuesta: number;
  enviada_utc: Date;
  entrega_detectada_utc: Date | null;
  lectura_detectada_utc: Date | null;
  primera_respuesta_utc: Date | null;
  contacto_permitido: boolean;
};

export async function whatsappTrackingInstalled(db: Database) {
  const [schema] = await db.$queryRaw<{ installed: number }[]>`
    SELECT CASE WHEN OBJECT_ID('dbo.ConfirmacionesWhatsAppLead','U') IS NOT NULL THEN 1 ELSE 0 END AS installed
  `;
  return schema?.installed === 1;
}

export async function recordWhatsAppReceipt(db: Database, sessionId: string, messageId: string, status: 'delivered' | 'read') {
  await db.$executeRaw`
    DECLARE @now DATETIME2(3)=SYSUTCDATETIME();
    MERGE dbo.ConfirmacionesWhatsAppLead WITH (HOLDLOCK) AS target
    USING (SELECT ${sessionId} AS id_sesion, ${messageId} AS id_externo,
      CASE WHEN ${status}='delivered' THEN @now END AS entrega,
      CASE WHEN ${status}='read' THEN @now END AS lectura) AS source
    ON target.id_sesion=source.id_sesion AND target.id_externo=source.id_externo
    WHEN MATCHED THEN UPDATE SET
      entrega_detectada_utc=COALESCE(target.entrega_detectada_utc,source.entrega),
      lectura_detectada_utc=COALESCE(target.lectura_detectada_utc,source.lectura)
    WHEN NOT MATCHED THEN INSERT (id_sesion,id_externo,entrega_detectada_utc,lectura_detectada_utc)
      VALUES (source.id_sesion,source.id_externo,source.entrega,source.lectura);
  `;
}

export async function readWhatsAppTracking(db: Database, requestId: number, interactionIds?: number[]) {
  if (!await whatsappTrackingInstalled(db)) return [];
  const sessionId = process.env.OPENWA_SESSION_ID?.trim();
  if (!sessionId) return [];
  // A quoted reply belongs to its exact message. An unquoted reply already linked
  // by the bot belongs to the most recent send of that same proposal and option.
  return db.$queryRaw<WhatsAppTracking[]>`
    SELECT TOP (${interactionIds ? 22 : 1}) CONVERT(varchar(20),m.id_mensaje) AS id,
      m.id_interaccion,m.tipo,m.id_propuesta,m.fecha_utc AS enviada_utc,
      ack.entrega_detectada_utc,ack.lectura_detectada_utc,response.fecha_utc AS primera_respuesta_utc,
      CAST(CASE WHEN p.autoriza_contacto=1 AND NOT EXISTS (
        SELECT 1 FROM dbo.MensajesWhatsAppLead stop WHERE stop.id_sesion=m.id_sesion AND stop.chat=m.chat AND stop.decision='BAJA'
      ) THEN 1 ELSE 0 END AS bit) AS contacto_permitido
    FROM dbo.MensajesWhatsAppLead m
    JOIN dbo.Personas p ON p.id_persona=m.id_persona
    LEFT JOIN dbo.ConfirmacionesWhatsAppLead ack ON ack.id_sesion=m.id_sesion AND ack.id_externo=m.id_externo
    OUTER APPLY (
      SELECT TOP (1) e.fecha_utc FROM dbo.MensajesWhatsAppLead e
      WHERE e.id_sesion=m.id_sesion AND e.chat=m.chat AND e.tipo='ENTRADA'
        AND e.id_solicitud=m.id_solicitud AND e.id_mensaje>m.id_mensaje
        AND (e.id_citado=m.id_externo OR (e.id_citado IS NULL AND e.id_propuesta=m.id_propuesta AND e.id_opcion=m.id_opcion
          AND NOT EXISTS (
            SELECT 1 FROM dbo.MensajesWhatsAppLead newer
            WHERE newer.id_sesion=m.id_sesion AND newer.chat=m.chat AND newer.id_solicitud=m.id_solicitud
              AND newer.id_propuesta=m.id_propuesta AND newer.id_opcion=m.id_opcion
              AND newer.id_mensaje>m.id_mensaje AND newer.id_mensaje<e.id_mensaje
              AND (newer.tipo='OFERTA' OR (newer.tipo='BOT' AND newer.decision='CONTRAOFERTA'))
          )))
      ORDER BY e.fecha_utc,e.id_mensaje
    ) response
    WHERE m.id_sesion=${sessionId} AND m.id_solicitud=${requestId} AND m.id_propuesta IS NOT NULL
      AND (m.tipo='OFERTA' OR (m.tipo='BOT' AND m.decision='CONTRAOFERTA'))
      ${interactionIds ? Prisma.sql`AND (m.id_mensaje=(SELECT MAX(original.id_mensaje)
        FROM dbo.MensajesWhatsAppLead original WHERE original.id_sesion=m.id_sesion AND original.id_solicitud=m.id_solicitud AND original.tipo='OFERTA')
        ${interactionIds.length ? Prisma.sql`OR m.id_interaccion IN (${Prisma.join(interactionIds)})` : Prisma.empty})` : Prisma.empty}
    ORDER BY m.id_mensaje DESC
  `;
}

export function whatsappFollowUpSuggestion(tracking: WhatsAppTracking | undefined, now = new Date()) {
  if (!tracking?.contacto_permitido || tracking.primera_respuesta_utc) return null;
  const read = tracking.lectura_detectada_utc;
  const evidence = read ?? tracking.entrega_detectada_utc;
  if (!evidence) return null;
  const hours = read ? 24 : 48;
  const target = Math.max(evidence.getTime() + hours * 3600000, now.getTime() + 5 * 60000);
  return {
    fecha_lima: new Date(target - 5 * 3600000).toISOString().slice(0, 16),
    motivo: read ? 'Retomar por WhatsApp la propuesta leída sin respuesta.' : 'Consultar por WhatsApp si pudo revisar la propuesta entregada.',
  };
}
