import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import type { Prisma } from '@prisma/client';
import { prisma } from '../db';

const ttl = 30 * 60_000;
const sessions = new Map<string, { id: number; expires: number; credential: string }>();
const attempts = new Map<string, { count: number; until: number }>();
const options = { N: 32768, r: 8, p: 3, maxmem: 48 * 1024 * 1024 };
const credentialFormat = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{64})$/;
const eligibleRoles = new Set(['Administrador', 'Negociador']);
let inProgress = 0;

const digest = (value: string) => createHash('sha256').update(value).digest('hex');
function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 32, options, (error, key) => error ? reject(error) : resolve(key));
  });
}

export async function hashLeadStaffPassword(password: string) {
  if (password.length < 12 || Buffer.byteLength(password) > 256) {
    throw new Error('La contraseña debe tener al menos 12 caracteres y como máximo 256 bytes.');
  }
  const salt = randomBytes(16);
  return `scrypt-v1$${salt.toString('hex')}$${(await derive(password, salt)).toString('hex')}`;
}

const staffFields = {
  id_usuario: true, nombres: true, apellidos: true, activo: true, password_hash: true,
  Rol: { select: { nombre: true } },
} as const;

function publicIdentity(user: { id_usuario: number; nombres: string; apellidos: string; Rol: { nombre: string } }) {
  return { id_usuario: user.id_usuario, nombres: user.nombres, apellidos: user.apellidos, rol: user.Rol.nombre };
}

export type LeadStaffIdentity = ReturnType<typeof publicIdentity>;

export type LeadStaffAuthMode = 'disabled' | 'qa' | 'enabled';

export function leadStaffAuthMode(): LeadStaffAuthMode {
  if (process.env.LEAD_STAFF_AUTH_QA === 'true') return 'qa';
  if (process.env.LEAD_STAFF_AUTH_ENABLED === 'true') return 'enabled';
  return 'disabled';
}

export function leadStaffAuthEnabled() {
  return leadStaffAuthMode() !== 'disabled';
}

async function isQaDatabase(db: Prisma.TransactionClient = prisma) {
  const [target] = await db.$queryRaw<{ db: string }[]>`SELECT DB_NAME() AS db`;
  return target?.db === 'NexoSalud_LeadPruebas';
}

export async function loginLeadStaff(req: Request, res: Response) {
  const mode = leadStaffAuthMode();
  if (mode === 'disabled') return res.sendStatus(404);
  res.set('Cache-Control', 'no-store');
  const email = typeof req.body?.email === 'string' ? req.body.email.trim().toLowerCase() : '';
  const password = req.body?.password;
  if (!email || email.length > 100 || typeof password !== 'string' || !password || Buffer.byteLength(password) > 256) {
    return res.status(400).json({ error: 'Ingresa correo y contraseña válidos.' });
  }

  const now = Date.now();
  for (const [key, value] of attempts) if (value.until <= now) attempts.delete(key);
  const ip = req.ip ?? req.socket.remoteAddress ?? 'local';
  const attempt = attempts.get(ip) ?? { count: 0, until: now + 5 * 60_000 };
  if (attempt.count >= 8 || attempts.size >= 512 || inProgress >= 2) {
    return res.status(429).json({ error: 'Demasiados intentos. Intenta más tarde.' });
  }
  attempts.set(ip, { ...attempt, count: attempt.count + 1 });
  inProgress++;
  try {
    if (mode === 'qa' && !await isQaDatabase()) return res.sendStatus(404);
    const user = await prisma.usuarios.findUnique({ where: { email }, select: staffFields });
    const match = user?.password_hash.match(credentialFormat);
    const key = await derive(password, match ? Buffer.from(match[1], 'hex') : Buffer.alloc(16));
    const valid = timingSafeEqual(key, match ? Buffer.from(match[2], 'hex') : Buffer.alloc(32));
    if (!valid || !match || !user?.activo || !eligibleRoles.has(user.Rol.nombre)) {
      return res.status(401).json({ error: 'Credenciales de personal no válidas para LEAD.' });
    }
    for (const [token, session] of sessions) if (session.expires <= now) sessions.delete(token);
    if (sessions.size >= 256) return res.status(503).json({ error: 'Capacidad de sesiones de QA alcanzada.' });
    const token = randomBytes(32).toString('base64url');
    const expires = Date.now() + ttl;
    sessions.set(digest(token), { id: user.id_usuario, expires, credential: digest(user.password_hash) });
    return res.json({ token, expira_en: new Date(expires).toISOString(), usuario: publicIdentity(user) });
  } finally {
    inProgress--;
  }
}

function sessionKey(req: Request) {
  const token = req.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/i)?.[1];
  return token ? digest(token) : null;
}

export function logoutLeadStaff(req: Request, res: Response) {
  if (!leadStaffAuthEnabled()) return res.sendStatus(404);
  const key = sessionKey(req);
  if (key) sessions.delete(key);
  return res.sendStatus(204);
}

export async function getLeadStaffIdentity(req: Request, tx: Prisma.TransactionClient) {
  const mode = leadStaffAuthMode();
  if (mode === 'disabled') return null;
  const key = sessionKey(req);
  const session = key ? sessions.get(key) : undefined;
  if (key && session && session.expires > Date.now() && (mode !== 'qa' || await isQaDatabase(tx))) {
    const user = await tx.usuarios.findUnique({ where: { id_usuario: session.id }, select: staffFields });
    if (user?.activo && eligibleRoles.has(user.Rol.nombre) && digest(user.password_hash) === session.credential) {
      return publicIdentity(user);
    }
  }
  if (key) sessions.delete(key);
  return null;
}
