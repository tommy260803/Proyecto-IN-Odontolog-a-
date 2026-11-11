import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const sedes = await prisma.sedes.findMany({ where: { activo: true } });
  const profs = await prisma.profesionales.findMany({ where: { activo: true } });

  console.log(`Generating slots for ${profs.length} professionals across ${sedes.length} sedes...`);

  // Slots to generate: from 2026-11-01 to 2027-01-31
  const start = new Date(Date.UTC(2026, 10, 1)); // Nov 1 2026
  const end = new Date(Date.UTC(2027, 0, 31)); // Jan 31 2027

  const timeSlots = [
    { start: '08:00', end: '09:00' },
    { start: '09:00', end: '10:00' },
    { start: '10:00', end: '11:00' },
    { start: '11:00', end: '12:00' },
    { start: '14:00', end: '15:00' },
    { start: '15:00', end: '16:00' },
    { start: '16:00', end: '17:00' },
    { start: '17:00', end: '18:00' },
    { start: '18:00', end: '19:00' },
  ];

  const slotsToCreate: any[] = [];
  const curr = new Date(start);

  while (curr <= end) {
    const dayOfWeek = curr.getUTCDay();
    // 0 is Sunday, skip Sunday
    if (dayOfWeek !== 0) {
      const fecha = new Date(curr);
      
      // Assign doctors to sedes based on rotation
      for (let pIdx = 0; pIdx < profs.length; pIdx++) {
        const prof = profs[pIdx];
        const sede = sedes[(pIdx + dayOfWeek) % sedes.length];

        for (const slot of timeSlots) {
          const horaInicio = new Date(`1970-01-01T${slot.start}:00.000Z`);
          const horaFin = new Date(`1970-01-01T${slot.end}:00.000Z`);

          slotsToCreate.push({
            id_profesional: prof.id_profesional,
            id_sede: sede.id_sede,
            fecha,
            hora_inicio: horaInicio,
            hora_fin: horaFin,
            estado: 'Disponible',
          });
        }
      }
    }
    curr.setUTCDate(curr.getUTCDate() + 1);
  }

  console.log(`Total slots prepared: ${slotsToCreate.length}. Inserting in chunks...`);
  const chunkSize = 500;
  for (let i = 0; i < slotsToCreate.length; i += chunkSize) {
    const chunk = slotsToCreate.slice(i, i + chunkSize);
    await prisma.disponibilidad.createMany({
      data: chunk,
    });
  }

  const count = await prisma.disponibilidad.count({
    where: { fecha: { gte: new Date(Date.UTC(2026, 10, 11)) } },
  });
  console.log(`Successfully generated availability! Future slots now available: ${count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());

