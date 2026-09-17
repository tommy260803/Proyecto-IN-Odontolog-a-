import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config({ override: true });

const prisma = new PrismaClient({
  datasources: { db: { url: process.env.SQLSERVER_URL } }
});

async function main() {
  console.log('🌱 Iniciando Seeder...');

  // 1. Etapas
  const etapas = ['BUYER', 'LEAD', 'PAYER', 'CUSTOMER', 'TURNED'];
  for (const nombre of etapas) {
    await prisma.etapas.upsert({
      where: { nombre },
      update: {},
      create: { nombre, descripcion: `Etapa ${nombre}` },
    });
  }
  console.log('✅ Etapas creadas.');

  // 2. Canales
  const canales = ['WhatsApp', 'Facebook', 'Página Web', 'Recomendación'];
  for (const nombre of canales) {
    await prisma.canales.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }
  console.log('✅ Canales creados.');

  // 3. Fuentes
  const fuentes = ['Campaña Redes Enero', 'Búsqueda Orgánica', 'Referido'];
  for (const nombre of fuentes) {
    await prisma.fuentes.upsert({
      where: { nombre },
      update: {},
      create: { nombre },
    });
  }
  console.log('✅ Fuentes creadas.');

  // 4. Servicios y Tarifas
  const servicios = [
    { nombre: 'Evaluación General', precio: 50.00 },
    { nombre: 'Ortodoncia Inicial', precio: 150.00 },
    { nombre: 'Blanqueamiento Dental', precio: 200.00 },
    { nombre: 'Implante Dental', precio: 1500.00 },
  ];
  for (const s of servicios) {
    const srv = await prisma.servicios.upsert({
      where: { nombre: s.nombre },
      update: {},
      create: { nombre: s.nombre, descripcion: `Descripción de ${s.nombre}` },
    });

    // Agregar tarifa
    const tarifas = await prisma.tarifas.findMany({ where: { id_servicio: srv.id_servicio } });
    if (tarifas.length === 0) {
      await prisma.tarifas.create({
        data: {
          id_servicio: srv.id_servicio,
          precio: s.precio,
        }
      });
    }
  }
  console.log('✅ Servicios y Tarifas creadas.');

  // 5. Sedes
  const sedes = ['Sede Norte', 'Sede Sur', 'Sede Centro'];
  for (const nombre of sedes) {
    const exists = await prisma.sedes.findFirst({ where: { nombre } });
    if (!exists) {
      await prisma.sedes.create({ data: { nombre, direccion: `Dirección de ${nombre}` } });
    }
  }
  console.log('✅ Sedes creadas.');

  // 6. Profesionales
  const profesionales = [
    { nombres: 'Juan', apellidos: 'Perez', especialidad: 'Ortodoncia' },
    { nombres: 'Maria', apellidos: 'Gomez', especialidad: 'Odontología General' },
  ];
  for (let i = 0; i < profesionales.length; i++) {
    const p = profesionales[i];
    const exists = await prisma.profesionales.findFirst({ where: { nombres: p.nombres, apellidos: p.apellidos } });
    if (!exists) {
      await prisma.profesionales.create({ data: { nombres: p.nombres, apellidos: p.apellidos, especialidad: p.especialidad } });
    }
  }
  console.log('✅ Profesionales creados.');

  // 7. Disponibilidad de prueba (Para negociación)
  const sedesList = await prisma.sedes.findMany();
  const profList = await prisma.profesionales.findMany();
  
  if (sedesList.length > 0 && profList.length > 0) {
    const disp = await prisma.disponibilidad.findMany();
    if (disp.length === 0) {
      const hoy = new Date();
      // Crear disponibilidades para los próximos 3 días
      for (let i = 1; i <= 3; i++) {
        const fecha = new Date(hoy);
        fecha.setDate(hoy.getDate() + i);
        
        await prisma.disponibilidad.create({
          data: {
            id_profesional: profList[0].id_profesional,
            id_sede: sedesList[0].id_sede,
            fecha: fecha,
            hora_inicio: new Date(fecha.setHours(10, 0, 0, 0)),
            hora_fin: new Date(fecha.setHours(11, 0, 0, 0)),
            estado: 'Disponible'
          }
        });

        await prisma.disponibilidad.create({
          data: {
            id_profesional: profList[1].id_profesional,
            id_sede: sedesList[1].id_sede,
            fecha: fecha,
            hora_inicio: new Date(fecha.setHours(15, 0, 0, 0)),
            hora_fin: new Date(fecha.setHours(16, 0, 0, 0)),
            estado: 'Disponible'
          }
        });
      }
      console.log('✅ Disponibilidad de prueba creada.');
    }
  }

  console.log('✅ SEED COMPLETADO.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
