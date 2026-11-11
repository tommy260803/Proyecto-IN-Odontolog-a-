import type { PrismaClient } from '@prisma/client';

type Connection = Pick<PrismaClient, '$queryRaw'>;

interface LeadDecision {
  id_solicitud: number;
  prioridad: number | null;
  motivo: string;
  siguiente_accion: string;
}

/** Consume one accredited entry. The SQL procedure commits the decision and job together. */
export async function processLeadEntry(db: Connection, requestId: number | null = null) {
  const [job] = await db.$queryRaw<{ id_solicitud: number; token: string }[]>`
    EXEC dbo.usp_TomarTrabajoAgenteLead @id_solicitud = ${requestId}
  `;
  if (!job) return { status: 'idle' as const };

  // If execution stops before commit, the claim expires and another worker can recover it.
  const [decision] = await db.$queryRaw<LeadDecision[] | number>`
    EXEC dbo.usp_PriorizarTrabajoAgenteLead @id_solicitud = ${job.id_solicitud}, @token = ${job.token}
  `.then(rows => Array.isArray(rows) ? rows : []);
  if (!decision) return { status: 'claim_expired' as const };
  return { status: 'processed' as const, decision };
}
