import { Prisma } from '@prisma/client';
import type { leadScheduleConstraints } from './leadGemini';

export type LeadNegotiationSlot = {
  id_disponibilidad: number;
  id_sede: number;
  id_profesional: number;
  fecha: string;
  inicio: string;
  fin: string;
  sede: string;
  profesional: string;
};

export async function findLeadNegotiationSlots(
  db: Pick<Prisma.TransactionClient, '$queryRaw'>,
  requestId: number,
  analysis: { intencion: string; dia?: string; turno?: string; turnos_excluidos?: string[] },
  context: {
    constraints: ReturnType<typeof leadScheduleConstraints>;
    excludedSites: number[];
    excludedProfessionals: number[];
    siteId?: number;
    professionalId?: number;
    slotIds?: number[];
    excludedSlotId?: number;
    limit?: 3 | 5;
  },
) {
  if (!['HORARIO', 'SEDE'].includes(analysis.intencion) || context.constraints.needsTimeClarification) return [];
  const days = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
  const modelDay = analysis.dia ? days.indexOf(analysis.dia) : -1;
  const allowedDays = days.map((_, index) => index).filter(day =>
    !context.constraints.excludedDays.includes(day) &&
    (context.constraints.preferredDays.length ? context.constraints.preferredDays.includes(day) :
      modelDay < 0 || context.constraints.excludedDays.includes(modelDay) || day === modelDay));
  const excluded = [...context.constraints.excludedShifts, ...(analysis.turnos_excluidos ?? [])];
  const allowed = ['mañana', 'tarde', 'noche'].filter(shift =>
    !excluded.includes(shift) && (context.constraints.preferredShifts.length
      ? context.constraints.preferredShifts.includes(shift)
      : !analysis.turno || excluded.includes(analysis.turno) || analysis.turno === shift));
  return db.$queryRaw<LeadNegotiationSlot[]>`
    SELECT TOP (${context.limit ?? 3}) d.id_disponibilidad,d.id_sede,d.id_profesional,
      CONVERT(varchar(10),d.fecha,23) AS fecha,
      CONVERT(varchar(5),d.hora_inicio,108) AS inicio,
      CONVERT(varchar(5),d.hora_fin,108) AS fin,
      s.nombre AS sede,CONCAT(p.nombres,' ',p.apellidos) AS profesional
    FROM dbo.Disponibilidad d
    JOIN dbo.Sedes s ON s.id_sede=d.id_sede AND s.activo=1
    JOIN dbo.Profesionales p ON p.id_profesional=d.id_profesional AND p.activo=1
    JOIN dbo.ProfesionalServicio ps ON ps.id_profesional=p.id_profesional
    JOIN dbo.Solicitudes sol ON sol.id_solicitud=${requestId} AND sol.id_servicio=ps.id_servicio
    JOIN dbo.Servicios sv ON sv.id_servicio=ps.id_servicio AND sv.activo=1
    WHERE d.estado='Disponible' AND d.hora_fin>d.hora_inicio
      ${context.excludedSites.length ? Prisma.sql`AND d.id_sede NOT IN (${Prisma.join(context.excludedSites)})` : Prisma.empty}
      ${context.excludedProfessionals.length ? Prisma.sql`AND d.id_profesional NOT IN (${Prisma.join(context.excludedProfessionals)})` : Prisma.empty}
      ${context.siteId ? Prisma.sql`AND d.id_sede=${context.siteId}` : Prisma.empty}
      ${context.professionalId ? Prisma.sql`AND d.id_profesional=${context.professionalId}` : Prisma.empty}
      ${context.slotIds?.length ? Prisma.sql`AND d.id_disponibilidad IN (${Prisma.join(context.slotIds)})` : Prisma.empty}
      ${context.excludedSlotId ? Prisma.sql`AND d.id_disponibilidad<>${context.excludedSlotId}` : Prisma.empty}
      AND (d.fecha>CONVERT(date,DATEADD(hour,-5,SYSUTCDATETIME()))
        OR (d.fecha=CONVERT(date,DATEADD(hour,-5,SYSUTCDATETIME()))
          AND d.hora_inicio>CONVERT(time,DATEADD(hour,-5,SYSUTCDATETIME()))))
      ${allowedDays.length ? Prisma.sql`AND DATEDIFF(day,CONVERT(date,'19000101'),d.fecha)%7 IN (${Prisma.join(allowedDays)})` : Prisma.sql`AND 1=0`}
      AND ((${allowed.includes('mañana') ? 1 : 0}=1 AND d.hora_inicio>='08:00' AND d.hora_inicio<'13:00')
        OR (${allowed.includes('tarde') ? 1 : 0}=1 AND d.hora_inicio>='13:00' AND d.hora_inicio<'18:00')
        OR (${allowed.includes('noche') ? 1 : 0}=1 AND d.hora_inicio>='18:00' AND d.hora_inicio<'20:00'))
      ${allowed.includes('tarde') ? Prisma.empty : Prisma.sql`AND (d.hora_fin<='13:00' OR d.hora_inicio>='18:00')`}
      ${allowed.includes('noche') ? Prisma.empty : Prisma.sql`AND d.hora_fin<='18:00'`}
      AND NOT EXISTS (
        SELECT 1 FROM dbo.Opciones o JOIN dbo.Reservas r ON r.id_opcion=o.id_opcion
        JOIN dbo.Disponibilidad ocupada ON ocupada.id_disponibilidad=o.id_disponibilidad
        WHERE ocupada.id_profesional=d.id_profesional AND ocupada.fecha=d.fecha
          AND ocupada.hora_inicio<d.hora_fin AND ocupada.hora_fin>d.hora_inicio
          AND r.estado NOT IN ('Cancelada','Vencida')
      )
    ORDER BY d.fecha,d.hora_inicio,d.id_disponibilidad
  `;
}
