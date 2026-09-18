const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const p = await prisma.personas.findFirst({
    where: { Etapa: { nombre: 'LEAD' } },
    include: {
      Solicitudes: {
        include: {
          Servicio: true
        }
      }
    }
  });
  console.log(JSON.stringify(p, null, 2));
}

main().finally(() => prisma.$disconnect());
