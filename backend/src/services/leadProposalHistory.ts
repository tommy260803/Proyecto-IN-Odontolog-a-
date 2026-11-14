import { Prisma } from '@prisma/client';
import { prisma } from '../db';
import { chatbotSchemaInstalled } from './leadWhatsAppInbox';

type InitialProposal = {
  id_opcion: number;
  precio: string;
  promocion: string | null;
  vigencia: Date | null;
  sede: string | null;
  especialista: string | null;
  fecha: string;
  inicio: string;
  fin: string;
  servicio: string | null;
};

export async function readLeadProposalHistory(optionIds: number[], requestIds: number[]) {
  const initial = new Map<number, InitialProposal>();
  const drafts = new Set<number>();
  if (!optionIds.length) return { initial, drafts };
  const [schema] = await prisma.$queryRaw<{ available: number }[]>`
    SELECT CASE WHEN OBJECT_ID(N'dbo.HistorialOpcionesLead', N'U') IS NOT NULL
      AND OBJECT_ID(N'dbo.HistorialVigenciaPropuestasLead', N'U') IS NOT NULL THEN 1 ELSE 0 END AS available`;
  if (!schema?.available) return { initial, drafts };

  const origins = new Map<number, number>();
  if (await chatbotSchemaInstalled(prisma)) {
    const rows = await prisma.$queryRaw<{ optionId: number; originId: number; applied: boolean }[]>`
      SELECT m.id_opcion AS optionId, TRY_CONVERT(int,JSON_VALUE(j.plan_json,'$.revisionOrigin.optionId')) AS originId,
        CAST(CASE WHEN m.tipo='OFERTA' THEN 1 ELSE 0 END AS bit) AS applied
      FROM dbo.MensajesWhatsAppLead m
      CROSS APPLY (SELECT CASE WHEN ISJSON(m.plan_respuesta)=1 THEN m.plan_respuesta END AS plan_json) j
      WHERE m.id_solicitud IN (${Prisma.join(requestIds)}) AND m.id_opcion IS NOT NULL AND m.estado='FINALIZADO'
        AND ((m.tipo='BOT' AND m.decision IN ('CONTRAOFERTA','REVISION_PROPUESTA'))
          OR (m.tipo='OFERTA' AND JSON_VALUE(j.plan_json,'$.revisionInteractionId') IS NOT NULL))
        AND JSON_VALUE(j.plan_json,'$.revisionOrigin.optionId') IS NOT NULL
      ORDER BY m.id_mensaje`;
    for (const row of rows) {
      if (row.applied) {
        origins.set(row.optionId, row.originId);
        drafts.delete(row.optionId);
      } else if (!origins.has(row.optionId)) drafts.add(row.optionId);
    }
    const processing = await prisma.$queryRaw<{ id_opcion: number }[]>`
      SELECT id_opcion FROM dbo.MensajesWhatsAppLead WHERE id_solicitud IN (${Prisma.join(requestIds)})
        AND tipo='ENTRADA' AND decision='BORRADOR_PROPUESTA' AND id_opcion IS NOT NULL`;
    for (const row of processing) if (!origins.has(row.id_opcion)) drafts.add(row.id_opcion);
  }

  const rows = await prisma.$queryRaw<InitialProposal[]>`
    SELECT h.id_opcion,CONVERT(varchar(32),h.precio_ofrecido) AS precio,p.promocion_aplicada AS promocion,
      v.fecha_vigencia_hasta_utc_lead AS vigencia,s.nombre AS sede,
      CONCAT_WS(' ',pr.nombres,pr.apellidos) AS especialista,CONVERT(varchar(10),h.fecha_disponibilidad,23) AS fecha,
      CONVERT(varchar(5),h.hora_inicio,108) AS inicio,CONVERT(varchar(5),h.hora_fin,108) AS fin,sv.nombre AS servicio
    FROM (SELECT *,ROW_NUMBER() OVER (PARTITION BY id_opcion ORDER BY id_historial) AS position
      FROM dbo.HistorialOpcionesLead WHERE id_opcion IN (${Prisma.join([...new Set([...optionIds, ...origins.values()])])})
        AND accion IN ('INSERT','BASELINE')) h
    LEFT JOIN dbo.PropuestasEconomicasLead p ON p.id_propuesta=h.id_propuesta_lead
    LEFT JOIN dbo.Solicitudes sol ON sol.id_solicitud=h.id_solicitud
    LEFT JOIN dbo.Servicios sv ON sv.id_servicio=COALESCE(p.id_servicio,sol.id_servicio)
    LEFT JOIN dbo.Sedes s ON s.id_sede=h.id_sede
    LEFT JOIN dbo.Profesionales pr ON pr.id_profesional=h.id_profesional
    OUTER APPLY (SELECT TOP (1) fecha_vigencia_hasta_utc_lead FROM dbo.HistorialVigenciaPropuestasLead
      WHERE id_propuesta=h.id_propuesta_lead AND accion IN ('INSERT','BASELINE') ORDER BY id_historial) v
    WHERE h.position=1`;
  const byId = new Map(rows.map(row => [row.id_opcion, row]));
  for (const id of optionIds) {
    let source = id;
    const visited = new Set<number>();
    while (origins.has(source) && !visited.has(source)) {
      visited.add(source);
      source = origins.get(source)!;
    }
    const snapshot = byId.get(source);
    if (snapshot) initial.set(id, snapshot);
  }
  return { initial, drafts };
}
