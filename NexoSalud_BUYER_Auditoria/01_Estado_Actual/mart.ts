import sqlDefault, { ConnectionPool } from 'mssql';
import dotenv from 'dotenv';
import { prisma } from '../db';

dotenv.config();

const sql = sqlDefault;

export async function queryMart<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  let sqlStatement = queryText;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const valStr = typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
      sqlStatement = sqlStatement.replace(new RegExp(`@${key}\\b`, 'g'), valStr);
    }
  }
  const martDb = process.env.MART_DATABASE || 'NexoSalud_Mart';
  const oltpDb = process.env.OLTP_DATABASE || 'NexoSaludDB';
  try {
    const fullSql = `USE [${martDb}]; ${sqlStatement}`;
    const result = await prisma.$queryRawUnsafe(fullSql);
    return result as T[];
  } finally {
    await prisma.$queryRawUnsafe(`USE [${oltpDb}];`).catch(() => {});
  }
}

export async function queryOltp<T = any>(queryText: string, params?: Record<string, any>): Promise<T[]> {
  let sqlStatement = queryText;
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      const valStr = typeof value === 'number' ? String(value) : `'${String(value).replace(/'/g, "''")}'`;
      sqlStatement = sqlStatement.replace(new RegExp(`@${key}\\b`, 'g'), valStr);
    }
  }
  const oltpDb = process.env.OLTP_DATABASE || 'NexoSaludDB';
  const fullSql = `USE [${oltpDb}]; ${sqlStatement}`;
  const result = await prisma.$queryRawUnsafe(fullSql);
  return result as T[];
}

export async function getMartPool(): Promise<ConnectionPool> {
  throw new Error('getMartPool() is deprecated. Use queryMart() directly.');
}

export async function getOltpPool(): Promise<ConnectionPool> {
  throw new Error('getOltpPool() is deprecated. Use queryOltp() directly.');
}

export { sql as martSql };
