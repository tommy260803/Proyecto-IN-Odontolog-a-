import { prisma } from '../db';

export interface LeadIntake {
  id_solicitud: number;
  id_evento_etapa: number;
  id_captacion: number;
  id_persona: number;
}

/** Internal BUYER handoff. Call after the conversion has committed. */
export async function registerLeadIntake(requestId: number): Promise<LeadIntake> {
  if (!Number.isInteger(requestId) || requestId < 1 || requestId > 2_147_483_647) {
    throw new RangeError('ID de solicitud inválido.');
  }

  const [entry] = await prisma.$queryRaw<LeadIntake[]>`
    EXEC dbo.usp_RegistrarEntradaAgenteLead @id_solicitud = ${requestId}
  `;
  if (!entry) throw new Error('No se pudo recuperar la entrada LEAD.');
  return entry;
}
