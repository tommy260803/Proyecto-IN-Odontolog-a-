import { prisma } from '../db';
import { hashLeadStaffPassword } from '../services/leadStaffAuth';

const targetMode = process.argv[2];

function readLine(prompt: string): Promise<string> {
  return new Promise(resolve => {
    process.stdout.write(prompt);
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', value => resolve(String(value).replace(/[\r\n]+$/, '')));
  });
}

function readSecret(prompt: string): Promise<string> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error('Ejecuta este comando desde una terminal interactiva; la contraseña no se lee desde pipes.');
  }
  return new Promise((resolve, reject) => {
    const input = process.stdin;
    const wasRaw = input.isRaw;
    let value = '';
    process.stdout.write(prompt);
    input.setRawMode(true);
    input.resume();
    const cleanup = () => {
      input.off('data', onData);
      input.setRawMode(Boolean(wasRaw));
      process.stdout.write('\n');
    };
    const onData = (buffer: Buffer) => {
      for (const character of buffer.toString('utf8')) {
        if (character === '\u0003') {
          cleanup();
          reject(new Error('Operación cancelada.'));
          return;
        }
        if (character === '\r' || character === '\n') {
          cleanup();
          resolve(value);
          return;
        }
        if (character === '\u007f' || character === '\b') value = value.slice(0, -1);
        else if (character >= ' ') value += character;
      }
    };
    input.on('data', onData);
  });
}

async function main() {
  if (!['--qa', '--production'].includes(targetMode)) {
    throw new Error('Uso: npm run lead:staff:provision -- --qa | --production');
  }
  const [target] = await prisma.$queryRaw<{ db: string }[]>`SELECT DB_NAME() AS db`;
  const expectedDatabase = targetMode === '--qa' ? 'NexoSalud_LeadPruebas' : 'NexoSaludDB';
  if (target?.db !== expectedDatabase) {
    throw new Error(`La conexión apunta a ${target?.db ?? 'una base desconocida'}; se esperaba ${expectedDatabase}.`);
  }

  if (targetMode === '--production') {
    const confirmation = await readLine('Escribe CONFIGURAR ACCESO LEAD EN NexoSaludDB para continuar: ');
    if (confirmation !== 'CONFIGURAR ACCESO LEAD EN NexoSaludDB') throw new Error('Confirmación no válida; no se cambió ninguna cuenta.');
  }

  const email = (await readLine('Correo exacto del usuario activo: ')).trim().toLowerCase();
  const user = await prisma.usuarios.findUnique({
    where: { email }, select: { id_usuario: true, email: true, activo: true, Rol: { select: { nombre: true } } },
  });
  if (!user?.activo || !['Administrador', 'Negociador'].includes(user.Rol.nombre)) {
    throw new Error('La cuenta debe existir, estar activa y tener rol Administrador o Negociador.');
  }

  const password = await readSecret('Nueva contraseña (12 caracteres mínimo): ');
  const confirmation = await readSecret('Repite la contraseña: ');
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden; no se cambió ninguna cuenta.');
  const password_hash = await hashLeadStaffPassword(password);
  await prisma.usuarios.update({ where: { id_usuario: user.id_usuario }, data: { password_hash } });
  console.log(`Credencial LEAD configurada para ${user.email} en ${target.db}.`);
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : 'No se pudo configurar la credencial LEAD.');
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
