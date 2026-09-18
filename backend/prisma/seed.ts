import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database mock data (Appended to SQL structure)...');

  const rolAdmin = await prisma.roles.upsert({
    where: { nombre: 'Administrador' },
    update: {},
    create: { nombre: 'Administrador' }
  });
  const usuario1 = await prisma.usuarios.upsert({
    where: { email: 'admin@nexosalud.com' },
    update: {},
    create: {
      nombres: 'Admin',
      apellidos: 'Principal',
      email: 'admin@nexosalud.com',
      password_hash: 'hashedpassword',
      id_rol: rolAdmin.id_rol,
    },
  });

  const etapasNombres = ['LEAD', 'BUYER', 'PAYER', 'CUSTOMER', 'TURNED'];
  const createdEtapas: Record<string, any> = {};
  for (const etapa of etapasNombres) {
    createdEtapas[etapa] = await prisma.etapas.upsert({
      where: { nombre: etapa },
      update: {},
      create: { nombre: etapa, descripcion: `Etapa ${etapa}` }
    });
  }

  const canalWpp = await prisma.canales.upsert({
    where: { nombre: 'WhatsApp' },
    update: {},
    create: { nombre: 'WhatsApp' }
  });
  
  // El script SQL original no inserta Fuentes por defecto, la creamos o buscamos:
  const fuenteOrg = await prisma.fuentes.upsert({
    where: { nombre: 'Búsqueda Orgánica' },
    update: {},
    create: { nombre: 'Búsqueda Orgánica' },
  });

  const modalidadP = await prisma.modalidades.upsert({
    where: { nombre: 'Presencial' },
    update: {},
    create: { nombre: 'Presencial' }
  });

  // 5. Infraestructura y Médicos
  const sedeNorte = await prisma.sedes.create({
    data: { nombre: 'Sede Norte', direccion: 'Av. Las Palmas 123', zona: 'Norte' },
  });
  
  const sedeSur = await prisma.sedes.create({
    data: { nombre: 'Sede Sur', direccion: 'Av. El Sol 456', zona: 'Sur' },
  });

  const servicioGeneral = await prisma.servicios.upsert({
    where: { nombre: 'Evaluación odontológica' },
    update: {},
    create: { nombre: 'Evaluación odontológica', descripcion: 'Evaluación odontológica general' }
  });

  const servicioControl = await prisma.servicios.upsert({
    where: { nombre: 'Control odontológico' },
    update: {},
    create: { nombre: 'Control odontológico', descripcion: 'Control' }
  });

  const drPerez = await prisma.profesionales.create({
    data: {
      nombres: 'Juan',
      apellidos: 'Pérez',
      numero_colegiatura: 'COP-12345',
      especialidad: 'Odontología General',
    },
  });

  await prisma.profesionalServicio.create({
    data: { id_profesional: drPerez.id_profesional, id_servicio: servicioGeneral.id_servicio },
  });

  // Crear Disponibilidad (Hoy y mañana)
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(today.getDate() + 1);

  const disp1 = await prisma.disponibilidad.create({
    data: {
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha: today,
      hora_inicio: new Date(new Date().setHours(10, 0, 0, 0)),
      hora_fin: new Date(new Date().setHours(11, 0, 0, 0)),
    },
  });

  const disp2 = await prisma.disponibilidad.create({
    data: {
      id_profesional: drPerez.id_profesional,
      id_sede: sedeSur.id_sede,
      fecha: tomorrow,
      hora_inicio: new Date(new Date().setHours(15, 0, 0, 0)),
      hora_fin: new Date(new Date().setHours(16, 0, 0, 0)),
    },
  });

  const disp3 = await prisma.disponibilidad.create({
    data: {
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha: today,
      hora_inicio: new Date(new Date().setHours(12, 0, 0, 0)),
      hora_fin: new Date(new Date().setHours(13, 0, 0, 0)),
    },
  });

  const disp4 = await prisma.disponibilidad.create({
    data: {
      id_profesional: drPerez.id_profesional,
      id_sede: sedeSur.id_sede,
      fecha: tomorrow,
      hora_inicio: new Date(new Date().setHours(9, 0, 0, 0)),
      hora_fin: new Date(new Date().setHours(10, 0, 0, 0)),
    },
  });

  const nextWeek = new Date();
  nextWeek.setDate(today.getDate() + 7);
  
  const disp5 = await prisma.disponibilidad.create({
    data: {
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha: nextWeek,
      hora_inicio: new Date(new Date().setHours(11, 0, 0, 0)),
      hora_fin: new Date(new Date().setHours(12, 0, 0, 0)),
    },
  });

  // ========================================================
  // PACIENTES MOCK (Flujo completo)
  // ========================================================

  // 1. LEAD: Solo información básica
  const pLead = await prisma.personas.create({
    data: {
      nombres: 'Laura',
      apellidos: 'García',
      email: 'laura.lead@example.com',
      numero: '+51999888777',
      id_etapa_actual: createdEtapas['LEAD'].id_etapa,
      id_canal_origen: canalWpp.id_canal,
      Interacciones: {
        create: [
          { tipo: 'Consulta Web', mensaje: 'Quiero información sobre brackets', id_canal: canalWpp.id_canal, id_fuente: fuenteOrg.id_fuente },
        ],
      },
    },
  });

  // 2. BUYER: Tiene una solicitud y una opción de cita
  const pBuyer = await prisma.personas.create({
    data: {
      nombres: 'Carlos',
      apellidos: 'Díaz',
      email: 'carlos.buyer@example.com',
      numero: '+51999666555',
      id_etapa_actual: createdEtapas['BUYER'].id_etapa,
      id_canal_origen: canalWpp.id_canal,
      Solicitudes: {
        create: [
          {
            motivo: 'Evaluación general',
            id_servicio: servicioGeneral.id_servicio,
            Opciones: {
              create: [
                { id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 50.0 },
              ],
            },
          },
        ],
      },
    },
  });

  // 3. PAYER: Tiene reserva y pago
  const pPayer = await prisma.personas.create({
    data: {
      nombres: 'María',
      apellidos: 'Gómez',
      email: 'maria.payer@example.com',
      numero: '+51999444333',
      id_etapa_actual: createdEtapas['PAYER'].id_etapa,
    },
  });

  const solPayer = await prisma.solicitudes.create({
    data: {
      id_persona: pPayer.id_persona,
      id_servicio: servicioControl.id_servicio,
      motivo: 'Instalación de brackets',
    },
  });

  const opcPayer = await prisma.opciones.create({
    data: {
      id_solicitud: solPayer.id_solicitud,
      id_disponibilidad: disp2.id_disponibilidad,
      precio_ofrecido: 150.0,
      seleccionada: true,
    },
  });

  const resPayer = await prisma.reservas.create({
    data: {
      id_persona: pPayer.id_persona,
      id_solicitud: solPayer.id_solicitud,
      id_opcion: opcPayer.id_opcion,
      estado: 'Confirmada',
    },
  });

  await prisma.pagos.create({
    data: {
      id_persona: pPayer.id_persona,
      id_reserva: resPayer.id_reserva,
      importe: 150.0,
      estado: 'Confirmado',  // Note: the SQL constraint allows 'Confirmado', not 'Validado'
      validado_por: usuario1.id_usuario,
    },
  });

  // 4. CUSTOMER: Tiene atenciones completadas
  const pCustomer = await prisma.personas.create({
    data: {
      nombres: 'José',
      apellidos: 'Martínez',
      email: 'jose.customer@example.com',
      numero: '+51999222111',
      id_etapa_actual: createdEtapas['CUSTOMER'].id_etapa,
    },
  });

  const solCustomer = await prisma.solicitudes.create({
    data: { id_persona: pCustomer.id_persona, id_servicio: servicioGeneral.id_servicio, motivo: 'Control anual' },
  });

  const opcCustomer = await prisma.opciones.create({
    data: { id_solicitud: solCustomer.id_solicitud, id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 0.0, seleccionada: true },
  });

  const resCustomer = await prisma.reservas.create({
    data: { id_persona: pCustomer.id_persona, id_solicitud: solCustomer.id_solicitud, id_opcion: opcCustomer.id_opcion, estado: 'Atendida' },
  });

  await prisma.atenciones.create({
    data: {
      id_persona: pCustomer.id_persona,
      id_reserva: resCustomer.id_reserva,
      id_servicio: servicioGeneral.id_servicio,
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha_atencion: today,
      estado_servicio: 'Realizado',  // SQL CHECK constraint: 'Realizado'
      resultado: 'Paciente sano, sin caries.',
    },
  });

  // 5. TURNED: Paciente que abandonó o terminó
  await prisma.personas.create({
    data: {
      nombres: 'Ana',
      apellidos: 'López',
      email: 'ana.turned@example.com',
      numero: '+51999111000',
      id_etapa_actual: createdEtapas['TURNED'].id_etapa,
      Interacciones: {
        create: [
          { tipo: 'Reactivación', mensaje: 'No contestó el teléfono.', id_usuario: usuario1.id_usuario },
        ],
      },
    },
  });

  console.log('Database seeded successfully (Appending to SQL base)!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
