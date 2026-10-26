const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.oportunidadesCaptacion.count();
  const sample = await prisma.oportunidadesCaptacion.findFirst({
    include: { Persona: true, Solicitud: true, Canal: true }
  });
  console.log('✔ Prisma test success! Total Oportunidades:', count);
  console.log('✔ Sample opportunity id:', sample.id_oportunidad, 'Persona:', sample.Persona.nombres, sample.Persona.apellidos, 'Solicitud:', sample.Solicitud?.id_solicitud);
  await prisma.$disconnect();
}

main().catch(err => {
  console.error('❌ Prisma error:', err);
  process.exit(1);
});
