import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Limpiando base de datos para pruebas completas de Inteligencia de Negocios (IMPULSE)...');
  
  await prisma.seguimientos.deleteMany();
  await prisma.incidencias.deleteMany();
  await prisma.decisionesIA.deleteMany();
  await prisma.atenciones.deleteMany();
  await prisma.pagos.deleteMany();
  await prisma.reservas.deleteMany();
  await prisma.opciones.deleteMany();
  await prisma.solicitudes.deleteMany();
  await prisma.interacciones.deleteMany();
  await prisma.personaPreferencias.deleteMany();
  await prisma.personaSaludOdontologica.deleteMany();
  await prisma.datosAcademicos.deleteMany();
  await prisma.datosLaborales.deleteMany();
  await prisma.eventosEtapa.deleteMany();
  await prisma.personas.deleteMany();
  await prisma.disponibilidad.deleteMany();
  await prisma.profesionalServicio.deleteMany();
  await prisma.profesionales.deleteMany();
  await prisma.sedes.deleteMany();
  await prisma.gastosCampana.deleteMany();
  await prisma.campanas.deleteMany();

  console.log('🌱 Creando Catálogos e Infraestructura...');

  const rolAdmin = await prisma.roles.upsert({
    where: { nombre: 'Administrador' },
    update: {},
    create: { nombre: 'Administrador' }
  });

  const usuarioAdmin = await prisma.usuarios.upsert({
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

  const etapasNombres = ['BUYER', 'LEAD', 'PAYER', 'CUSTOMER', 'TURNED'];
  const etapas: Record<string, any> = {};
  for (const nombre of etapasNombres) {
    etapas[nombre] = await prisma.etapas.upsert({
      where: { nombre },
      update: {},
      create: { nombre, descripcion: `Etapa ${nombre}` }
    });
  }

  // Canales
  const canalWpp = await prisma.canales.upsert({ where: { nombre: 'WhatsApp' }, update: {}, create: { nombre: 'WhatsApp' } });
  const canalFb = await prisma.canales.upsert({ where: { nombre: 'Facebook' }, update: {}, create: { nombre: 'Facebook' } });
  const canalGoogle = await prisma.canales.upsert({ where: { nombre: 'Google Ads' }, update: {}, create: { nombre: 'Google Ads' } });
  const canalOrg = await prisma.canales.upsert({ where: { nombre: 'Búsqueda Orgánica' }, update: {}, create: { nombre: 'Búsqueda Orgánica' } });

  // Fuentes
  const fuenteRedes = await prisma.fuentes.upsert({ where: { nombre: 'Redes Sociales' }, update: {}, create: { nombre: 'Redes Sociales' } });
  const fuenteAds = await prisma.fuentes.upsert({ where: { nombre: 'Anuncio Pagado' }, update: {}, create: { nombre: 'Anuncio Pagado' } });
  const fuenteOrg = await prisma.fuentes.upsert({ where: { nombre: 'Búsqueda Orgánica' }, update: {}, create: { nombre: 'Búsqueda Orgánica' } });

  // Servicios
  const servicioEval = await prisma.servicios.upsert({ where: { nombre: 'Evaluación odontológica' }, update: {}, create: { nombre: 'Evaluación odontológica', descripcion: 'Evaluación general' } });
  const servicioOrto = await prisma.servicios.upsert({ where: { nombre: 'Ortodoncia' }, update: {}, create: { nombre: 'Ortodoncia', descripcion: 'Tratamiento de ortodoncia' } });
  const servicioBlanq = await prisma.servicios.upsert({ where: { nombre: 'Blanqueamiento dental' }, update: {}, create: { nombre: 'Blanqueamiento dental', descripcion: 'Blanqueamiento profesional' } });
  const servicioControl = await prisma.servicios.upsert({ where: { nombre: 'Control odontológico' }, update: {}, create: { nombre: 'Control odontológico', descripcion: 'Control periódico' } });

  // Sedes y Profesionales
  const sedeNorte = await prisma.sedes.create({ data: { nombre: 'Sede Norte', direccion: 'Av. Las Palmas 123', zona: 'Norte' } });
  const sedeCentro = await prisma.sedes.create({ data: { nombre: 'Sede Centro', direccion: 'Jr. Lima 789', zona: 'Centro' } });

  const drPerez = await prisma.profesionales.create({ data: { nombres: 'Juan', apellidos: 'Pérez', numero_colegiatura: 'COP-12345', especialidad: 'Odontología General' } });
  const draTorres = await prisma.profesionales.create({ data: { nombres: 'Claudia', apellidos: 'Torres', numero_colegiatura: 'COP-67890', especialidad: 'Ortodoncia' } });

  await prisma.profesionalServicio.createMany({
    data: [
      { id_profesional: drPerez.id_profesional, id_servicio: servicioControl.id_servicio },
      { id_profesional: drPerez.id_profesional, id_servicio: servicioEval.id_servicio },
      { id_profesional: drPerez.id_profesional, id_servicio: servicioBlanq.id_servicio },
      { id_profesional: draTorres.id_profesional, id_servicio: servicioOrto.id_servicio },
      { id_profesional: draTorres.id_profesional, id_servicio: servicioEval.id_servicio },
    ]
  });

  const today = new Date();
  const t = (h: number, m = 0) => new Date(new Date().setHours(h, m, 0, 0));
  const disp1 = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional, id_sede: sedeNorte.id_sede, fecha: today, hora_inicio: t(9), hora_fin: t(10) } });
  const disp2 = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeCentro.id_sede, fecha: today, hora_inicio: t(11), hora_fin: t(12) } });

  // ── CAMPAÑAS Y GASTOS (Para B3 de BUYER) ──────────────────
  console.log('📊 Creando Campañas y Gastos de Marketing (B3)...');

  const campanaFB = await prisma.campanas.create({
    data: {
      nombre: 'Campaña Facebook Dental 2026',
      descripcion: 'Promoción de Ortodoncia en Meta Ads',
      id_canal: canalFb.id_canal,
      id_fuente: fuenteRedes.id_fuente,
      GastosCampana: {
        create: [{ fecha: new Date('2026-08-01'), importe: 500.00, descripcion: 'Inversión Facebook Ads' }]
      }
    }
  });

  const campanaGoogle = await prisma.campanas.create({
    data: {
      nombre: 'Campaña Google Search Odontología',
      descripcion: 'Anuncios Search Clinica Odontológica',
      id_canal: canalGoogle.id_canal,
      id_fuente: fuenteAds.id_fuente,
      GastosCampana: {
        create: [{ fecha: new Date('2026-08-01'), importe: 400.00, descripcion: 'Inversión Google Search' }]
      }
    }
  });

  // ── 1. MÓDULO BUYER & LEAD (COHORTE OFICIAL DE 30 BUYERS) ──
  console.log('👥 Generando Cohorte de 30 BUYERs (B1=30%, B2=80%, B3=S/150)...');

  const subDays = (d: number) => {
    const dt = new Date(today);
    dt.setDate(dt.getDate() - d);
    return dt;
  };
  const addDays = (base: Date, d: number) => {
    const dt = new Date(base);
    dt.setDate(dt.getDate() + d);
    return dt;
  };

  const firstNames = [
    'Carlos', 'Camila', 'Jorge', 'Sofía', 'Luis', 'Ana', 'Mateo', 'Lucía', 'Diego', 'Elena',
    'Gabriel', 'Valeria', 'Fernando', 'Mariana', 'Ricardo', 'Beatriz', 'Alejandro', 'Natalia', 'Javier', 'Claudia',
    'Gonzalo', 'Patricia', 'Héctor', 'Paola', 'Andrés', 'Vanessa', 'Manuel', 'Diana', 'Roberto', 'Fabiola'
  ];
  const lastNames = [
    'Díaz', 'Rojas', 'Benavides', 'Salazar', 'Mendoza', 'Torres', 'Gómez', 'Vargas', 'Castro', 'Pérez',
    'Ríos', 'Flores', 'Silva', 'Morales', 'Guerrero', 'Navarro', 'Romero', 'Cordero', 'Aguilar', 'Chávez',
    'Paredes', 'Medina', 'Campos', 'Delgado', 'Cárdenas', 'Garrido', 'Soto', 'Espinoza', 'Reyes', 'Villanueva'
  ];

  for (let i = 0; i < 30; i++) {
    const fn = firstNames[i];
    const ln = lastNames[i];
    const num = i + 1;

    let contactAuth = true;
    let calidad = 'Valido';
    let regDaysAgo = 30;
    let convertedInDays: number | null = null;
    let campId: number | null = campanaFB.id_campana;
    let canalId = canalFb.id_canal;
    let fuenteId = fuenteRedes.id_fuente;
    let targetEtapa = etapas['BUYER'].id_etapa;

    if (i < 2) {
      contactAuth = false;
      calidad = 'Incompleto';
      regDaysAgo = 35;
      campId = null;
      canalId = canalOrg.id_canal;
      fuenteId = fuenteOrg.id_fuente;
    } else if (i < 4) {
      contactAuth = true;
      calidad = 'Duplicado';
      regDaysAgo = 40;
      campId = null;
      canalId = canalOrg.id_canal;
      fuenteId = fuenteOrg.id_fuente;
    } else if (i < 6) {
      contactAuth = true;
      calidad = 'Rechazado';
      regDaysAgo = 42;
      campId = null;
      canalId = canalOrg.id_canal;
      fuenteId = fuenteOrg.id_fuente;
    } else if (i < 10) {
      contactAuth = true;
      calidad = 'Valido';
      regDaysAgo = 4 + (i - 6) * 2;
      convertedInDays = null;
      campId = campanaFB.id_campana;
    } else {
      contactAuth = true;
      calidad = 'Valido';
      regDaysAgo = 20 + (i - 10) * 1.5;

      if (i < 16) {
        targetEtapa = etapas['LEAD'].id_etapa;
        const daysMap = [2, 4, 5, 7, 9, 12];
        convertedInDays = daysMap[i - 10];

        if (i < 13) {
          campId = campanaFB.id_campana;
          canalId = canalFb.id_canal;
          fuenteId = fuenteRedes.id_fuente;
        } else {
          campId = campanaGoogle.id_campana;
          canalId = canalGoogle.id_canal;
          fuenteId = fuenteAds.id_fuente;
        }
      } else {
        targetEtapa = etapas['BUYER'].id_etapa;
        convertedInDays = null;
        campId = i % 2 === 0 ? campanaFB.id_campana : campanaGoogle.id_campana;
      }
    }

    const regDate = subDays(regDaysAgo);

    const persona = await prisma.personas.create({
      data: {
        nombres: fn,
        apellidos: ln,
        dni: `478965${num < 10 ? '0' + num : num}`,
        email: `${fn.toLowerCase()}.${ln.toLowerCase()}${num}@gmail.com`,
        numero: `+51 987 654 ${100 + num}`,
        autoriza_contacto: contactAuth,
        fecha_autorizacion: contactAuth ? regDate : null,
        estado_calidad: calidad,
        id_campana_origen: campId,
        id_canal_origen: canalId,
        id_etapa_actual: targetEtapa,
        fecha_registro: regDate,
        fecha_actualizacion: convertedInDays !== null ? addDays(regDate, convertedInDays) : regDate,
      }
    });

    await prisma.interacciones.create({
      data: {
        id_persona: persona.id_persona,
        id_canal: canalId,
        id_fuente: fuenteId,
        fecha_hora: regDate,
        tipo: 'Registro Inicial',
        mensaje: `Registro automático en portal`,
      }
    });

    const sol = await prisma.solicitudes.create({
      data: {
        id_persona: persona.id_persona,
        id_servicio: num % 2 === 0 ? servicioOrto.id_servicio : servicioBlanq.id_servicio,
        fecha_solicitud: regDate,
        motivo: `Solicitud de evaluación para ${fn} ${ln}`,
      }
    });

    if (convertedInDays !== null) {
      const convDate = addDays(regDate, convertedInDays);
      await prisma.eventosEtapa.create({
        data: {
          id_persona: persona.id_persona,
          etapa_origen: etapas['BUYER'].id_etapa,
          etapa_destino: etapas['LEAD'].id_etapa,
          fecha_hora: convDate,
          motivo: `Paso a LEAD tras ${convertedInDays} días`,
        }
      });

      // Alternativa de Negociación para LEAD
      await prisma.opciones.create({
        data: {
          id_solicitud: sol.id_solicitud,
          id_disponibilidad: disp1.id_disponibilidad,
          precio_ofrecido: 120.00,
          seleccionada: true,
        }
      });
    }
  }

  // ── 2. MÓDULO PAYER (PAGADORES Y COMPROBANTES DE PAGO) ───────
  console.log('💳 Generando Pacientes para el Módulo PAYER (Escenarios P1, P2, P3, P4)...');

  // Payer 1: Pago Confirmado / Validado
  const pPayerValid = await prisma.personas.create({
    data: {
      nombres: 'María',
      apellidos: 'Gómez',
      email: 'maria.gomez.payer@gmail.com',
      numero: '+51 999 444 333',
      autoriza_contacto: true,
      fecha_autorizacion: subDays(10),
      id_etapa_actual: etapas['PAYER'].id_etapa,
      fecha_registro: subDays(10),
    }
  });
  const solP1 = await prisma.solicitudes.create({ data: { id_persona: pPayerValid.id_persona, id_servicio: servicioOrto.id_servicio, motivo: 'Instalación de Brackets Ortodoncia' } });
  const opcP1 = await prisma.opciones.create({ data: { id_solicitud: solP1.id_solicitud, id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 150.00, seleccionada: true } });
  const resP1 = await prisma.reservas.create({ data: { id_persona: pPayerValid.id_persona, id_solicitud: solP1.id_solicitud, id_opcion: opcP1.id_opcion, estado: 'Confirmada' } });
  await prisma.pagos.create({
    data: {
      id_persona: pPayerValid.id_persona,
      id_reserva: resP1.id_reserva,
      importe: 150.00,
      referencia_pago: 'YAPE-8849201',
      canal_pago: 'Yape / Plin',
      estado: 'Confirmado',
      fecha_registro: subDays(2),
      fecha_validacion: subDays(2),
    }
  });

  // Payer 2: Pago Pendiente
  const pPayerPend = await prisma.personas.create({
    data: {
      nombres: 'Roberto',
      apellidos: 'Fernández',
      email: 'roberto.fernandez@gmail.com',
      numero: '+51 988 555 222',
      autoriza_contacto: true,
      id_etapa_actual: etapas['PAYER'].id_etapa,
      fecha_registro: subDays(5),
    }
  });
  const solP2 = await prisma.solicitudes.create({ data: { id_persona: pPayerPend.id_persona, id_servicio: servicioBlanq.id_servicio, motivo: 'Blanqueamiento Dental LED' } });
  const opcP2 = await prisma.opciones.create({ data: { id_solicitud: solP2.id_solicitud, id_disponibilidad: disp2.id_disponibilidad, precio_ofrecido: 200.00, seleccionada: true } });
  const resP2 = await prisma.reservas.create({ data: { id_persona: pPayerPend.id_persona, id_solicitud: solP2.id_solicitud, id_opcion: opcP2.id_opcion, estado: 'Pendiente' } });
  await prisma.pagos.create({
    data: {
      id_persona: pPayerPend.id_persona,
      id_reserva: resP2.id_reserva,
      importe: 200.00,
      referencia_pago: 'BCP-992381',
      canal_pago: 'Transferencia BCP',
      estado: 'Pendiente',
      fecha_registro: subDays(1),
    }
  });

  // Payer 3: Pago Rechazado / Fallido
  const pPayerRej = await prisma.personas.create({
    data: {
      nombres: 'Lucía',
      apellidos: 'Méndez',
      email: 'lucia.mendez@gmail.com',
      numero: '+51 977 111 444',
      autoriza_contacto: true,
      id_etapa_actual: etapas['PAYER'].id_etapa,
      fecha_registro: subDays(7),
    }
  });
  const solP3 = await prisma.solicitudes.create({ data: { id_persona: pPayerRej.id_persona, id_servicio: servicioEval.id_servicio, motivo: 'Evaluación Odontológica' } });
  const opcP3 = await prisma.opciones.create({ data: { id_solicitud: solP3.id_solicitud, id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 50.00, seleccionada: true } });
  const resP3 = await prisma.reservas.create({ data: { id_persona: pPayerRej.id_persona, id_solicitud: solP3.id_solicitud, id_opcion: opcP3.id_opcion, estado: 'Cancelada' } });
  await prisma.pagos.create({
    data: {
      id_persona: pPayerRej.id_persona,
      id_reserva: resP3.id_reserva,
      importe: 50.00,
      referencia_pago: 'INVAL-001',
      canal_pago: 'Yape / Plin',
      estado: 'Fallido',
      observaciones: 'Voucher ilegible o falso',
      fecha_registro: subDays(3),
    }
  });

  // ── 3. MÓDULO CUSTOMER (CLIENTES ATENDIDOS Y CITAS DENTALES) ──
  console.log('🩺 Generando Pacientes para el Módulo CUSTOMER (Escenarios C1, C2, C3, C4)...');

  // Customer 1: Atención Realizada
  const pCustAttended = await prisma.personas.create({
    data: {
      nombres: 'José',
      apellidos: 'Martínez',
      email: 'jose.martinez.customer@gmail.com',
      numero: '+51 999 222 111',
      autoriza_contacto: true,
      id_etapa_actual: etapas['CUSTOMER'].id_etapa,
      fecha_registro: subDays(15),
    }
  });
  const solC1 = await prisma.solicitudes.create({ data: { id_persona: pCustAttended.id_persona, id_servicio: servicioControl.id_servicio, motivo: 'Limpieza y Profilaxis' } });
  const opcC1 = await prisma.opciones.create({ data: { id_solicitud: solC1.id_solicitud, id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 80.00, seleccionada: true } });
  const resC1 = await prisma.reservas.create({ data: { id_persona: pCustAttended.id_persona, id_solicitud: solC1.id_solicitud, id_opcion: opcC1.id_opcion, estado: 'Atendida' } });
  await prisma.atenciones.create({
    data: {
      id_persona: pCustAttended.id_persona,
      id_reserva: resC1.id_reserva,
      id_servicio: servicioControl.id_servicio,
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha_atencion: subDays(1),
      fecha_inicio: subDays(1),
      fecha_fin: addDays(subDays(1), 0),
      asistencia: 'Pendiente',
      estado_servicio: 'Realizado',
      motivo_consulta: 'Profilaxis dental semestral',
      evaluacion: 'Salud gingival óptima. Sin caries visibles.',
      resultado: 'Limpieza con ultrasonido completada exitosamente.',
    }
  });

  // Customer 2: Inasistencia (No Show)
  const pCustNoShow = await prisma.personas.create({
    data: {
      nombres: 'Ana María',
      apellidos: 'Ruiz',
      email: 'anamaria.ruiz@gmail.com',
      numero: '+51 966 333 888',
      autoriza_contacto: true,
      id_etapa_actual: etapas['CUSTOMER'].id_etapa,
      fecha_registro: subDays(12),
    }
  });
  const solC2 = await prisma.solicitudes.create({ data: { id_persona: pCustNoShow.id_persona, id_servicio: servicioEval.id_servicio, motivo: 'Evaluación por dolor de muela' } });
  const opcC2 = await prisma.opciones.create({ data: { id_solicitud: solC2.id_solicitud, id_disponibilidad: disp2.id_disponibilidad, precio_ofrecido: 50.00, seleccionada: true } });
  const resC2 = await prisma.reservas.create({ data: { id_persona: pCustNoShow.id_persona, id_solicitud: solC2.id_solicitud, id_opcion: opcC2.id_opcion, estado: 'Atendida' } });
  await prisma.atenciones.create({
    data: {
      id_persona: pCustNoShow.id_persona,
      id_reserva: resC2.id_reserva,
      id_servicio: servicioEval.id_servicio,
      id_profesional: draTorres.id_profesional,
      id_sede: sedeCentro.id_sede,
      fecha_atencion: subDays(2),
      asistencia: 'Pendiente',
      estado_servicio: 'Cancelado',
      resultado: 'Paciente no se presentó a su cita programada.',
    }
  });

  // ── 4. MÓDULO TURNED (SEGUIMIENTO Y REACTIVACIÓN DE PACIENTES) ──
  console.log('🔄 Generando Pacientes para el Módulo TURNED (Escenarios T1, T2, T3)...');

  // Turned 1: En Seguimiento con Alta Satisfacción
  const pTurned1 = await prisma.personas.create({
    data: {
      nombres: 'Ana',
      apellidos: 'López',
      email: 'ana.lopez.turned@gmail.com',
      numero: '+51 999 111 000',
      autoriza_contacto: true,
      id_etapa_actual: etapas['TURNED'].id_etapa,
      fecha_registro: subDays(25),
    }
  });
  const solT1 = await prisma.solicitudes.create({ data: { id_persona: pTurned1.id_persona, id_servicio: servicioOrto.id_servicio, motivo: 'Control mensual ortodoncia' } });
  const opcT1 = await prisma.opciones.create({ data: { id_solicitud: solT1.id_solicitud, id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 100.00, seleccionada: true } });
  const resT1 = await prisma.reservas.create({ data: { id_persona: pTurned1.id_persona, id_solicitud: solT1.id_solicitud, id_opcion: opcT1.id_opcion, estado: 'Atendida' } });
  const atencionT1 = await prisma.atenciones.create({
    data: {
      id_persona: pTurned1.id_persona,
      id_reserva: resT1.id_reserva,
      id_servicio: servicioOrto.id_servicio,
      id_profesional: draTorres.id_profesional,
      id_sede: sedeCentro.id_sede,
      fecha_atencion: subDays(5),
      asistencia: 'Pendiente',
      estado_servicio: 'Realizado',
      resultado: 'Ajuste de brackets completado.',
    }
  });
  await prisma.seguimientos.create({
    data: {
      id_persona: pTurned1.id_persona,
      id_atencion: atencionT1.id_atencion,
      id_usuario: usuarioAdmin.id_usuario,
      fecha_hora: subDays(3),
      canal: 'WhatsApp',
      tipo: 'Encuesta Posatención',
      resultado: 'Paciente expresa estar muy conforme con el tratamiento',
      satisfaccion: 5,
      observaciones: 'Próxima cita de control programada para el siguiente mes',
    }
  });

  // Turned 2: Reactivación (Nuevo BUYER)
  const pTurned2 = await prisma.personas.create({
    data: {
      nombres: 'Pedro',
      apellidos: 'Gutiérrez',
      email: 'pedro.gutierrez@gmail.com',
      numero: '+51 955 888 444',
      autoriza_contacto: true,
      id_etapa_actual: etapas['TURNED'].id_etapa,
      fecha_registro: subDays(60),
    }
  });
  const solT2 = await prisma.solicitudes.create({ data: { id_persona: pTurned2.id_persona, id_servicio: servicioBlanq.id_servicio, motivo: 'Reactivación anual de blanqueamiento' } });
  const opcT2 = await prisma.opciones.create({ data: { id_solicitud: solT2.id_solicitud, id_disponibilidad: disp2.id_disponibilidad, precio_ofrecido: 180.00, seleccionada: true } });
  const resT2 = await prisma.reservas.create({ data: { id_persona: pTurned2.id_persona, id_solicitud: solT2.id_solicitud, id_opcion: opcT2.id_opcion, estado: 'Atendida' } });
  const atencionT2 = await prisma.atenciones.create({
    data: {
      id_persona: pTurned2.id_persona,
      id_reserva: resT2.id_reserva,
      id_servicio: servicioBlanq.id_servicio,
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha_atencion: subDays(40),
      asistencia: 'Pendiente',
      estado_servicio: 'Realizado',
    }
  });
  await prisma.seguimientos.create({
    data: {
      id_persona: pTurned2.id_persona,
      id_atencion: atencionT2.id_atencion,
      id_usuario: usuarioAdmin.id_usuario,
      fecha_hora: subDays(2),
      canal: 'Llamada',
      tipo: 'Campaña Reactivación',
      resultado: 'Interesado en nuevo servicio de limpieza dental',
      satisfaccion: 4,
      observaciones: 'El paciente solicita nueva evaluación y pasa a ciclo de reactivación',
    }
  });

  console.log('✅ Base de datos poblada de forma integral para TODOS LOS MÓDULOS DEL SISTEMA!');
}

main()
  .catch((e) => {
    console.error('❌ Error al ejecutar seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
