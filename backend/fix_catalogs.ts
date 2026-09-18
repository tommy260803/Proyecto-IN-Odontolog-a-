import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Inserting Modalidades...');
  await prisma.modalidades.upsert({ where: { nombre: 'Presencial' }, update: {}, create: { nombre: 'Presencial' } });
  await prisma.modalidades.upsert({ where: { nombre: 'Teleconsulta' }, update: {}, create: { nombre: 'Teleconsulta' } });
  await prisma.modalidades.upsert({ where: { nombre: 'Domiciliaria' }, update: {}, create: { nombre: 'Domiciliaria' } });

  console.log('Inserting Horarios...');
  // Note: Horarios does not have a unique constraint on something other than id, 
  // so let's just create if the table is empty
  const horariosCount = await prisma.horarios.count();
  if (horariosCount === 0) {
    await prisma.horarios.createMany({
      data: [
        { dia_semana: 1, hora_inicio: new Date('1970-01-01T08:00:00Z'), hora_fin: new Date('1970-01-01T12:00:00Z') }, // Mañana
        { dia_semana: 1, hora_inicio: new Date('1970-01-01T13:00:00Z'), hora_fin: new Date('1970-01-01T18:00:00Z') }, // Tarde
        { dia_semana: 1, hora_inicio: new Date('1970-01-01T18:00:00Z'), hora_fin: new Date('1970-01-01T21:00:00Z') }, // Noche
      ]
    });
  }

  console.log('Inserting Sedes...');
  const sedesCount = await prisma.sedes.count();
  if (sedesCount === 0) {
    await prisma.sedes.createMany({
      data: [
        { nombre: 'Sede Norte', direccion: 'Av. Norte 123' },
        { nombre: 'Sede Sur', direccion: 'Av. Sur 456' },
        { nombre: 'Sede Centro', direccion: 'Av. Centro 789' }
      ]
    });
  }

  console.log('Done!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
