import { prisma as defaultPrisma } from '../db';
import type { PrismaClient } from '@prisma/client';

export interface LeadIntake {
  id_solicitud: number;
  id_evento_etapa: number;
  id_captacion: number;
  id_persona: number;
}

export class LeadIntakeUnavailableError extends Error {
  constructor() {
    super('La entrega al agente LEAD está pendiente: falta dbo.usp_RegistrarEntradaAgenteLead en la base de datos actual.');
    this.name = 'LeadIntakeUnavailableError';
  }
}

/** Internal BUYER handoff. Call after the conversion has committed. */
export async function registerLeadIntake(requestId: number, db?: PrismaClient): Promise<LeadIntake> {
  if (!Number.isInteger(requestId) || requestId < 1 || requestId > 2_147_483_647) {
    throw new RangeError('ID de solicitud inválido.');
  }

  const client = db || defaultPrisma;
  const [procedure] = await client.$queryRaw<{ existe: number }[]>`
    SELECT CASE
      WHEN OBJECT_ID(N'dbo.usp_RegistrarEntradaAgenteLead', N'P') IS NULL THEN 0
      ELSE 1
    END AS existe
  `;
  if (!procedure?.existe) {
    throw new LeadIntakeUnavailableError();
  }

  const [entry] = await client.$queryRaw<LeadIntake[]>`
    EXEC dbo.usp_RegistrarEntradaAgenteLead @id_solicitud = ${requestId}
  `;
  if (!entry) throw new Error('No se pudo recuperar la entrada LEAD.');
  return entry;
}
