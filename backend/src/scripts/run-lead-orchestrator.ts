import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import { processLeadEntry } from '../services/leadOrchestrator';

async function main() {
  dotenv.config();
  const url = process.env.LEAD_AGENT_SQLSERVER_URL;
  if (!url) throw new Error('Configure LEAD_AGENT_SQLSERVER_URL para el ejecutor de QA.');
  const db = new PrismaClient({ datasourceUrl: url });
  try {
    const [target] = await db.$queryRaw<{ db: string }[]>`SELECT DB_NAME() AS db`;
    if (target?.db !== 'NexoSalud_LeadPruebas') throw new Error('El ejecutor solo opera en NexoSalud_LeadPruebas.');
    console.log(await processLeadEntry(db));
  } finally {
    await db.$disconnect();
  }
}

main().catch(() => {
  console.error('Falló el ejecutor LEAD. Verifique la conexión y la migración de QA.');
  process.exitCode = 1;
});
