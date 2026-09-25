import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database with rich patient data...');

  // ── ROLES Y USUARIOS ──────────────────────────────────────────
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

  // ── ETAPAS ────────────────────────────────────────────────────
  const etapasNombres = ['LEAD', 'BUYER', 'PAYER', 'CUSTOMER', 'TURNED'];
  const createdEtapas: Record<string, any> = {};
  for (const etapa of etapasNombres) {
    createdEtapas[etapa] = await prisma.etapas.upsert({
      where: { nombre: etapa },
      update: {},
      create: { nombre: etapa, descripcion: `Etapa ${etapa}` }
    });
  }

  // ── CATÁLOGOS ─────────────────────────────────────────────────
  const canalWpp = await prisma.canales.upsert({
    where: { nombre: 'WhatsApp' },
    update: {},
    create: { nombre: 'WhatsApp' }
  });

  const canalFb = await prisma.canales.upsert({
    where: { nombre: 'Facebook' },
    update: {},
    create: { nombre: 'Facebook' }
  });

  const canalConvenio = await prisma.canales.upsert({
    where: { nombre: 'Convenio Interinstitucional' },
    update: {},
    create: { nombre: 'Convenio Interinstitucional' }
  });

  const fuenteOrg = await prisma.fuentes.upsert({
    where: { nombre: 'Búsqueda Orgánica' },
    update: {},
    create: { nombre: 'Búsqueda Orgánica' },
  });

  const fuenteRedes = await prisma.fuentes.upsert({
    where: { nombre: 'Redes Sociales' },
    update: {},
    create: { nombre: 'Redes Sociales' },
  });

  const modalidadP = await prisma.modalidades.upsert({
    where: { nombre: 'Presencial' },
    update: {},
    create: { nombre: 'Presencial' }
  });

  const modalidadV = await prisma.modalidades.upsert({
    where: { nombre: 'Virtual' },
    update: {},
    create: { nombre: 'Virtual' }
  });

  // Horarios
  const horarioManana = await prisma.horarios.create({
    data: {
      dia_semana: 2, // Martes
      hora_inicio: new Date('1970-01-01T09:00:00Z'),
      hora_fin: new Date('1970-01-01T11:30:00Z'),
    }
  });

  const campanaGoogle = await prisma.campanas.create({
    data: {
      dia_semana: 4, // Jueves
      hora_inicio: new Date('1970-01-01T14:00:00Z'),
      hora_fin: new Date('1970-01-01T17:00:00Z'),
    }
  });

  // ── INFRAESTRUCTURA ───────────────────────────────────────────
  const sedeNorte = await prisma.sedes.create({
    data: { nombre: 'Sede Norte', direccion: 'Av. Las Palmas 123', zona: 'Norte' },
  });

  const sedeSur = await prisma.sedes.create({
    data: { nombre: 'Sede Sur', direccion: 'Av. El Sol 456', zona: 'Sur' },
  });

  const sedeCentro = await prisma.sedes.create({
    data: { nombre: 'Sede Centro', direccion: 'Jr. Lima 789', zona: 'Centro' },
  });

  // ── SERVICIOS ─────────────────────────────────────────────────
  const servicioGeneral = await prisma.servicios.upsert({
    where: { nombre: 'Evaluación odontológica' },
    update: {},
    create: { nombre: 'Evaluación odontológica', descripcion: 'Evaluación odontológica general' }
  });

  const servicioOrtodoncia = await prisma.servicios.upsert({
    where: { nombre: 'Ortodoncia' },
    update: {},
    create: { nombre: 'Ortodoncia', descripcion: 'Tratamiento de ortodoncia con brackets' }
  });

  const servicioControl = await prisma.servicios.upsert({
    where: { nombre: 'Control odontológico' },
    update: {},
    create: { nombre: 'Control odontológico', descripcion: 'Control periódico' }
  });

  const servicioBlanqueamiento = await prisma.servicios.upsert({
    where: { nombre: 'Blanqueamiento dental' },
    update: {},
    create: { nombre: 'Blanqueamiento dental', descripcion: 'Blanqueamiento dental profesional' }
  });

  // ── PROFESIONALES ─────────────────────────────────────────────
  const drPerez = await prisma.profesionales.create({
    data: {
      nombres: 'Juan',
      apellidos: 'Pérez',
      numero_colegiatura: 'COP-12345',
      especialidad: 'Odontología General',
    },
  });

  const draTorres = await prisma.profesionales.create({
    data: {
      nombres: 'Claudia',
      apellidos: 'Torres',
      numero_colegiatura: 'COP-67890',
      especialidad: 'Ortodoncia',
    },
  });

  // Servicios de profesionales
  await prisma.profesionalServicio.create({
    data: { id_profesional: drPerez.id_profesional, id_servicio: servicioGeneral.id_servicio },
  });
  await prisma.profesionalServicio.create({
    data: { id_profesional: drPerez.id_profesional, id_servicio: servicioControl.id_servicio },
  });
  await prisma.profesionalServicio.create({
    data: { id_profesional: draTorres.id_profesional, id_servicio: servicioOrtodoncia.id_servicio },
  });
  await prisma.profesionalServicio.create({
    data: { id_profesional: draTorres.id_profesional, id_servicio: servicioBlanqueamiento.id_servicio },
  });

  // ── DISPONIBILIDADES ──────────────────────────────────────────
  const today = new Date();
  const d = (offset: number) => {
    const dt = new Date();
    dt.setDate(today.getDate() + offset);
    return dt;
  };
  const t = (h: number, m = 0) => new Date(new Date().setHours(h, m, 0, 0));

  const disp1  = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional,  id_sede: sedeNorte.id_sede,  fecha: d(0), hora_inicio: t(9),  hora_fin: t(10) } });
  const disp2  = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional,  id_sede: sedeNorte.id_sede,  fecha: d(0), hora_inicio: t(10), hora_fin: t(11) } });
  const disp3  = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional,  id_sede: sedeSur.id_sede,    fecha: d(1), hora_inicio: t(15), hora_fin: t(16) } });
  const disp4  = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional,  id_sede: sedeSur.id_sede,    fecha: d(1), hora_inicio: t(9),  hora_fin: t(10) } });
  const disp5  = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional,  id_sede: sedeNorte.id_sede,  fecha: d(7), hora_inicio: t(11), hora_fin: t(12) } });
  const disp6  = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeCentro.id_sede, fecha: d(2), hora_inicio: t(9),  hora_fin: t(10) } });
  const disp7  = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeCentro.id_sede, fecha: d(2), hora_inicio: t(10), hora_fin: t(11) } });
  const disp8  = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeNorte.id_sede,  fecha: d(3), hora_inicio: t(14), hora_fin: t(15) } });
  const disp9  = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeNorte.id_sede,  fecha: d(5), hora_inicio: t(16), hora_fin: t(17) } });

  // ========================================================
  // PACIENTES MOCK (Flujo completo)
  // ========================================================

  // ── LEAD 1: Jorge Benavides (trabajador independiente, no estudiante) ──
  const nacJorge = new Date('1978-04-12');
  const pLead1 = await prisma.personas.create({
    data: {
      nombres: 'Jorge',
      apellidos: 'Benavides',
      email: 'jorge.benavides@negocioficticio.pe',
      numero: '+51 988 369 147',
      zona: 'Trujillo',
      fecha_nacimiento: nacJorge,
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      id_etapa_actual: createdEtapas['LEAD'].id_etapa,
      id_canal_origen: canalConvenio.id_canal,
      Interacciones: {
        create: [
          {
            tipo: 'Contacto inicial',
            mensaje: 'Contacto inicial completado. Persona muy ocupada en horario de la tarde: no contactar pasadas las 14:00.',
            id_canal: canalConvenio.id_canal,
            id_fuente: fuenteOrg.id_fuente,
            id_usuario: usuario1.id_usuario,
          },
        ],
      },
    },
  });

  // Datos Académicos (No aplica)
  await prisma.datosAcademicos.create({
    data: {
      id_persona: pLead1.id_persona,
      aplica: false,
    }
  });

  // Datos Laborales
  await prisma.datosLaborales.create({
    data: {
      id_persona: pLead1.id_persona,
      ocupacion: 'Comerciante y consultor independiente',
      empresa: 'Establecimiento propio / Consultoría comercial',
      modalidad: 'Horario comercial flexible',
      disponibilidad: 'Mañanas de martes a jueves con previa coordinación telefónica',
    }
  });

  // Salud Odontológica
  await prisma.personaSaludOdontologica.create({
    data: {
      id_persona: pLead1.id_persona,
      ultima_visita_odontologica: 'Más de 1 año',
      motivo_consulta: 'Evaluación',
      tratamiento_previo: 'Extracción, restauración',
      nivel_dolor: 'Leve',
      presenta_sensibilidad: 'No',
      sangrado_o_inflamacion: 'Ninguno',
      usa_aparato_o_protesis: 'Ninguno',
      condicion_atencion_especial: 'Ninguna',
    }
  });

  // Preferencias
  await prisma.personaPreferencias.create({
    data: {
      id_persona: pLead1.id_persona,
      id_canal: canalWpp.id_canal,
      id_horario: horarioManana.id_horario,
      id_modalidad: modalidadP.id_modalidad,
      sede_preferida: 'Sede Norte',
      profesional_preferido: 'Dra. Torres',
    }
  });

  // Solicitud de servicio
  await prisma.solicitudes.create({
    data: {
      id_persona: pLead1.id_persona,
      id_servicio: servicioOrtodoncia.id_servicio,
      motivo: 'Solicita evaluación de ortodoncia — Moderado — Requiere demostración de valor inmediata',
      tipo_consulta: 'Primera consulta',
    }
  });

  // ── LEAD 2: Camila Rojas (estudiante universitaria) ──
  const nacCamila = new Date('2002-08-25');
  const pLead2 = await prisma.personas.create({
    data: {
      nombres: 'Camila',
      apellidos: 'Rojas',
      email: 'camila.rojas@uni.pe',
      numero: '+51 987 654 321',
      zona: 'Lima - Miraflores',
      fecha_nacimiento: nacCamila,
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      id_etapa_actual: createdEtapas['LEAD'].id_etapa,
      id_canal_origen: canalFb.id_canal,
      Interacciones: {
        create: [
          {
            tipo: 'Consulta Web',
            mensaje: 'Consulta por blanqueamiento dental. Horario disponible solo por las tardes.',
            id_canal: canalFb.id_canal,
            id_fuente: fuenteRedes.id_fuente,
          },
        ],
      },
    },
  });

  // Datos Académicos (Sí aplica)
  await prisma.datosAcademicos.create({
    data: {
      id_persona: pLead2.id_persona,
      aplica: true,
      universidad: 'Universidad Peruana de Ciencias Aplicadas (UPC)',
      carrera: 'Diseño Gráfico',
      ciclo: '7mo ciclo',
    }
  });

  // Datos Laborales (Part time)
  await prisma.datosLaborales.create({
    data: {
      id_persona: pLead2.id_persona,
      ocupacion: 'Diseñadora freelance',
      empresa: 'Independiente',
      modalidad: 'Remoto / Part time',
      disponibilidad: 'Tardes de lunes a viernes después de las 18:00',
    }
  });

  // Salud Odontológica
  await prisma.personaSaludOdontologica.create({
    data: {
      id_persona: pLead2.id_persona,
      ultima_visita_odontologica: '6–12 meses',
      motivo_consulta: 'Estética',
      tratamiento_previo: 'Limpieza',
      nivel_dolor: 'Ninguno',
      presenta_sensibilidad: 'Sí',
      sangrado_o_inflamacion: 'Ninguno',
      usa_aparato_o_protesis: 'Ninguno',
      condicion_atencion_especial: 'Ninguna',
    }
  });

  // Preferencias
  await prisma.personaPreferencias.create({
    data: {
      id_persona: pLead2.id_persona,
      id_canal: canalFb.id_canal,
      id_horario: horarioTarde.id_horario,
      id_modalidad: modalidadP.id_modalidad,
      sede_preferida: 'Sede Centro',
      profesional_preferido: 'Dra. Torres',
    }
  });

  // Solicitud
  await prisma.solicitudes.create({
    data: {
      id_persona: pLead2.id_persona,
      id_servicio: servicioBlanqueamiento.id_servicio,
      motivo: 'Interesada en blanqueamiento dental — Alto — Busca resultado inmediato para evento universitario',
      tipo_consulta: 'Primera consulta',
    }
  });

  // ── BUYER: Carlos Díaz ──────────────────────────────────────
  const pBuyer = await prisma.personas.create({
    data: {
      nombres: 'Carlos',
      apellidos: 'Díaz',
      email: 'carlos.buyer@example.com',
      numero: '+51999666555',
      id_etapa_actual: createdEtapas['BUYER'].id_etapa,
      id_canal_origen: canalWpp.id_canal,
      Solicitudes: {
        create: [{
          motivo: 'Evaluación general',
          id_servicio: servicioGeneral.id_servicio,
          Opciones: {
            create: [{ id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 50.0 }],
          },
        }],
      },
    },
  });

  // ── PAYER: María Gómez ───────────────────────────────────────
  const pPayer = await prisma.personas.create({
    data: {
      nombres: 'María',
      apellidos: 'Gómez',
      email: 'maria.payer@example.com',
      numero: '+51999444333',
      id_etapa_actual: createdEtapas['PAYER'].id_etapa,
    },
  });
  const solPayer = await prisma.solicitudes.create({ data: { id_persona: pPayer.id_persona, id_servicio: servicioControl.id_servicio, motivo: 'Instalación de brackets' } });
  const opcPayer = await prisma.opciones.create({ data: { id_solicitud: solPayer.id_solicitud, id_disponibilidad: disp3.id_disponibilidad, precio_ofrecido: 150.0, seleccionada: true } });
  const resPayer = await prisma.reservas.create({ data: { id_persona: pPayer.id_persona, id_solicitud: solPayer.id_solicitud, id_opcion: opcPayer.id_opcion, estado: 'Confirmada' } });
  await prisma.pagos.create({ data: { id_persona: pPayer.id_persona, id_reserva: resPayer.id_reserva, importe: 150.0, estado: 'Confirmado', validado_por: usuario1.id_usuario } });

  // ── CUSTOMER: José Martínez ──────────────────────────────────
  const pCustomer = await prisma.personas.create({
    data: {
      nombres: 'José',
      apellidos: 'Martínez',
      email: 'jose.customer@example.com',
      numero: '+51999222111',
      id_etapa_actual: createdEtapas['CUSTOMER'].id_etapa,
    },
  });
  const solCustomer = await prisma.solicitudes.create({ data: { id_persona: pCustomer.id_persona, id_servicio: servicioGeneral.id_servicio, motivo: 'Control anual' } });
  const opcCustomer = await prisma.opciones.create({ data: { id_solicitud: solCustomer.id_solicitud, id_disponibilidad: disp2.id_disponibilidad, precio_ofrecido: 0.0, seleccionada: true } });
  const resCustomer = await prisma.reservas.create({ data: { id_persona: pCustomer.id_persona, id_solicitud: solCustomer.id_solicitud, id_opcion: opcCustomer.id_opcion, estado: 'Atendida' } });
  await prisma.atenciones.create({
    data: {
      id_persona: pCustomer.id_persona,
      id_reserva: resCustomer.id_reserva,
      id_servicio: servicioGeneral.id_servicio,
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha_atencion: today,
      estado_servicio: 'Realizado',
      resultado: 'Paciente sano, sin caries.',
    },
  });

  // ── TURNED: Ana López ────────────────────────────────────────
  await prisma.personas.create({
    data: {
      nombres: 'Ana',
      apellidos: 'López',
      email: 'ana.turned@example.com',
      numero: '+51999111000',
      id_etapa_actual: createdEtapas['TURNED'].id_etapa,
      Interacciones: {
        create: [{ tipo: 'Reactivación', mensaje: 'No contestó el teléfono.', id_usuario: usuario1.id_usuario }],
      },
    },
  });

  console.log('✅ Database seeded successfully with rich patient data!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
