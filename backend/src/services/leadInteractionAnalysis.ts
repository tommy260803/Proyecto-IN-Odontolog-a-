import { Prisma } from '@prisma/client';

type AnalysisDb = Pick<Prisma.TransactionClient, '$queryRaw' | '$executeRaw'>;

export async function hasLeadInteractionAnalysis(db: AnalysisDb) {
  const [row] = await db.$queryRaw<{ present: number }[]>`
    SELECT CASE WHEN OBJECT_ID('dbo.AnalisisInteraccionesLead','U') IS NULL THEN 0 ELSE 1 END AS present
  `;
  return row?.present === 1;
}

export async function saveLeadInteractionAnalysis(
  db: AnalysisDb, interactionId: number, contextHash: string, result: object,
) {
  if (!await hasLeadInteractionAnalysis(db)) throw new Error('Falta instalar 13_ANALISIS_INTERACCIONES_LEAD.sql.');
  await db.$executeRaw`
    INSERT dbo.AnalisisInteraccionesLead(id_interaccion,huella_contexto,analisis)
    SELECT ${interactionId},${contextHash},${JSON.stringify(result)}
    WHERE NOT EXISTS (
      SELECT 1 FROM dbo.AnalisisInteraccionesLead WITH (UPDLOCK,HOLDLOCK)
      WHERE id_interaccion=${interactionId} AND huella_contexto=${contextHash}
    )
  `;
}

export async function readLeadInteractionAnalyses(db: AnalysisDb, ids: number[]) {
  if (!ids.length || !await hasLeadInteractionAnalysis(db)) return new Map<number, unknown>();
  const rows = await db.$queryRaw<{ id_interaccion: number; analisis: string }[]>`
    SELECT id_interaccion,analisis FROM (
      SELECT id_interaccion,analisis,
        ROW_NUMBER() OVER (PARTITION BY id_interaccion ORDER BY id_analisis DESC) AS position
      FROM dbo.AnalisisInteraccionesLead WHERE id_interaccion IN (${Prisma.join(ids)})
    ) AS latest WHERE position=1
  `;
  return new Map(rows.map(row => [row.id_interaccion, JSON.parse(row.analisis) as unknown]));
}
