import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  await prisma.horarios.create({
    data: { dia_semana: 1, hora_inicio: new Date('1970-01-01T18:00:00Z'), hora_fin: new Date('1970-01-01T21:00:00Z') }
  });
}
main().catch(console.error).finally(() => prisma.$disconnect());
