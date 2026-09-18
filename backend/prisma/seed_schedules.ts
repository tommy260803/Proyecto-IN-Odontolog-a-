import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Insertando horarios disponibles para todos los doctores y sedes...');

  const profesionales = await prisma.profesionales.findMany();
  const sedes = await prisma.sedes.findMany();

  if (profesionales.length === 0 || sedes.length === 0) {
    console.log('No se encontraron profesionales o sedes.');
    return;
  }

  // Horarios típicos de atención médica
  const slots = [
    { startH: 8, startM: 0, endH: 9, endM: 0 },
    { startH: 9, startM: 0, endH: 10, endM: 0 },
    { startH: 10, startM: 0, endH: 11, endM: 0 },
    { startH: 11, startM: 0, endH: 12, endM: 0 },
    { startH: 12, startM: 0, endH: 13, endM: 0 },
    { startH: 14, startM: 0, endH: 15, endM: 0 },
    { startH: 15, startM: 0, endH: 16, endM: 0 },
    { startH: 16, startM: 0, endH: 17, endM: 0 },
    { startH: 17, startM: 0, endH: 18, endM: 0 },
    { startH: 18, startM: 0, endH: 19, endM: 0 },
    { startH: 19, startM: 0, endH: 20, endM: 0 },
  ];

  const today = new Date();
  let createdCount = 0;

  // Generar para los próximos 60 días
  for (let offset = -5; offset <= 60; offset++) {
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + offset);

    // Evitar domingos si se desea, o incluir todos los días
    const dayOfWeek = targetDate.getDay();
    if (dayOfWeek === 0) continue; // Saltear domingos

    for (const prof of profesionales) {
      for (const sede of sedes) {
        // Asignar turnos
        for (const slot of slots) {
          const startTime = new Date(targetDate);
          startTime.setHours(slot.startH, slot.startM, 0, 0);

          const endTime = new Date(targetDate);
          endTime.setHours(slot.endH, slot.endM, 0, 0);

          try {
            await prisma.disponibilidad.create({
              data: {
                id_profesional: prof.id_profesional,
                id_sede: sede.id_sede,
                fecha: targetDate,
                hora_inicio: startTime,
                hora_fin: endTime,
                estado: 'Disponible',
              },
            });
            createdCount++;
          } catch (e) {
            // Ignorar duplicados o errores menores
          }
        }
      }
    }
  }

  console.log(`✅ ¡Se han insertado ${createdCount} horarios disponibles con éxito en la base de datos!`);
}

main()
  .catch((e) => {
    console.error('Error insertando horarios:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

