import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🧹 Borrando datos actuales de la base de datos...');

  // Eliminación ordenada respetando integridad referencial (FK)
  await prisma.incidencias.deleteMany();
  await prisma.decisionesIA.deleteMany();
  await prisma.eventosEtapa.deleteMany();
  await prisma.seguimientos.deleteMany();
  await prisma.atenciones.deleteMany();
  await prisma.pagos.deleteMany();
  await prisma.reservas.deleteMany();
  await prisma.opciones.deleteMany();
  await prisma.solicitudes.deleteMany();
  await prisma.personaSaludOdontologica.deleteMany();
  await prisma.personaPreferencias.deleteMany();
  await prisma.datosLaborales.deleteMany();
  await prisma.datosAcademicos.deleteMany();
  await prisma.interacciones.deleteMany();
  await prisma.personas.deleteMany();
  await prisma.gastosCampana.deleteMany();
  await prisma.campanas.deleteMany();
  await prisma.disponibilidad.deleteMany();
  await prisma.profesionalServicio.deleteMany();
  await prisma.tarifas.deleteMany();
  await prisma.servicios.deleteMany();
  await prisma.sedes.deleteMany();
  await prisma.profesionales.deleteMany();
  await prisma.horarios.deleteMany();
  await prisma.modalidades.deleteMany();
  await prisma.fuentes.deleteMany();
  await prisma.canales.deleteMany();
  await prisma.usuarios.deleteMany();
  await prisma.roles.deleteMany();
  await prisma.etapas.deleteMany();

  console.log('✅ Base de datos limpiada con éxito.');
  console.log('🌱 Sembrando base de datos con datos clínicos y comerciales enriquecidos...');

  // ── 1. ROLES Y USUARIOS ──────────────────────────────────────────
  const rolAdmin = await prisma.roles.create({
    data: { nombre: 'Administrador' }
  });

  const rolAsesor = await prisma.roles.create({
    data: { nombre: 'Asesor Comercial' }
  });

  const rolOdontologo = await prisma.roles.create({
    data: { nombre: 'Odontólogo' }
  });

  const rolCajero = await prisma.roles.create({
    data: { nombre: 'Cajero / Tesorería' }
  });

  const usuario1 = await prisma.usuarios.create({
    data: {
      nombres: 'Admin',
      apellidos: 'Principal',
      email: 'admin@nexosalud.com',
      password_hash: 'hashedpassword',
      id_rol: rolAdmin.id_rol,
    },
  });

  const usuarioAsesor = await prisma.usuarios.create({
    data: {
      nombres: 'Valeria',
      apellidos: 'Mendoza',
      email: 'valeria.mendoza@nexosalud.com',
      password_hash: 'hashedpassword',
      id_rol: rolAsesor.id_rol,
    },
  });

  // ── 2. ETAPAS DEL EMBUDO ─────────────────────────────────────────
  const etapasNombres = [
    { nombre: 'BUYER', descripcion: 'Captación y consentimiento inicial de contacto' },
    { nombre: 'LEAD', descripcion: 'Negociación de alternativas, cotización y reserva temporal' },
    { nombre: 'PAYER', descripcion: 'Pago inicial conciliado y validación administrativa' },
    { nombre: 'CUSTOMER', descripcion: 'Atención clínica odontológica en sillón' },
    { nombre: 'TURNED', descripcion: 'Postventa, medición de satisfacción y reactivación' },
  ];

  const createdEtapas: Record<string, any> = {};
  for (const etapa of etapasNombres) {
    createdEtapas[etapa.nombre] = await prisma.etapas.create({
      data: { nombre: etapa.nombre, descripcion: etapa.descripcion }
    });
  }

  // ── 3. CANALES Y FUENTES ─────────────────────────────────────────
  const canalWpp = await prisma.canales.create({ data: { nombre: 'WhatsApp' } });
  const canalFb = await prisma.canales.create({ data: { nombre: 'Facebook' } });
  const canalIg = await prisma.canales.create({ data: { nombre: 'Instagram' } });
  const canalWeb = await prisma.canales.create({ data: { nombre: 'Portal Web' } });
  const canalPresencial = await prisma.canales.create({ data: { nombre: 'Sede Presencial' } });

  const fuenteOrg = await prisma.fuentes.create({ data: { nombre: 'Búsqueda Orgánica' } });
  const fuenteRedes = await prisma.fuentes.create({ data: { nombre: 'Redes Sociales (Meta Ads)' } });
  const fuenteGoogle = await prisma.fuentes.create({ data: { nombre: 'Google Ads' } });
  const fuenteReferido = await prisma.fuentes.create({ data: { nombre: 'Recomendación de Paciente' } });

  // ── 4. MODALIDADES Y HORARIOS ────────────────────────────────────
  const modalidadP = await prisma.modalidades.create({ data: { nombre: 'Presencial' } });
  const modalidadV = await prisma.modalidades.create({ data: { nombre: 'Teleorientación' } });

  const horarioManana = await prisma.horarios.create({
    data: {
      dia_semana: 2, // Martes
      hora_inicio: new Date('1970-01-01T09:00:00Z'),
      hora_fin: new Date('1970-01-01T12:00:00Z'),
    }
  });

  const horarioTarde = await prisma.horarios.create({
    data: {
      dia_semana: 4, // Jueves
      hora_inicio: new Date('1970-01-01T14:00:00Z'),
      hora_fin: new Date('1970-01-01T18:00:00Z'),
    }
  });

  const horarioNoche = await prisma.horarios.create({
    data: {
      dia_semana: 5, // Viernes
      hora_inicio: new Date('1970-01-01T18:00:00Z'),
      hora_fin: new Date('1970-01-01T21:00:00Z'),
    }
  });

  // ── 5. INFRAESTRUCTURA (SEDES) ───────────────────────────────────
  const sedeNorte = await prisma.sedes.create({
    data: { nombre: 'Sede Norte (Los Olivos)', direccion: 'Av. Las Palmas 123', zona: 'Norte' },
  });

  const sedeSur = await prisma.sedes.create({
    data: { nombre: 'Sede Sur (Miraflores)', direccion: 'Av. El Sol 456', zona: 'Sur' },
  });

  const sedeCentro = await prisma.sedes.create({
    data: { nombre: 'Sede Centro (San Isidro)', direccion: 'Jr. Lima 789', zona: 'Centro' },
  });

  // ── 6. SERVICIOS Y TARIFAS ───────────────────────────────────────
  const servicioGeneral = await prisma.servicios.create({
    data: { nombre: 'Evaluación odontológica', descripcion: 'Evaluación odontológica integral y diagnóstico' }
  });

  const servicioOrtodoncia = await prisma.servicios.create({
    data: { nombre: 'Ortodoncia', descripcion: 'Tratamiento de ortodoncia correctiva con brackets o alineadores' }
  });

  const servicioControl = await prisma.servicios.create({
    data: { nombre: 'Control odontológico', descripcion: 'Control periódico y profilaxis de mantenimiento' }
  });

  const servicioBlanqueamiento = await prisma.servicios.create({
    data: { nombre: 'Blanqueamiento dental', descripcion: 'Blanqueamiento dental profesional con lámpara LED' }
  });

  const servicioLimpieza = await prisma.servicios.create({
    data: { nombre: 'Limpieza dental & Profilaxis', descripcion: 'Destartraje con ultrasonido y pulido coronario' }
  });

  // Tarifas oficiales
  await prisma.tarifas.create({ data: { id_servicio: servicioGeneral.id_servicio, precio: 50.00, activo: true } });
  await prisma.tarifas.create({ data: { id_servicio: servicioOrtodoncia.id_servicio, precio: 150.00, activo: true } });
  await prisma.tarifas.create({ data: { id_servicio: servicioControl.id_servicio, precio: 80.00, activo: true } });
  await prisma.tarifas.create({ data: { id_servicio: servicioBlanqueamiento.id_servicio, precio: 200.00, activo: true } });
  await prisma.tarifas.create({ data: { id_servicio: servicioLimpieza.id_servicio, precio: 120.00, activo: true } });

  // ── 7. PROFESIONALES Y ESPECIALIDADES ────────────────────────────
  const drPerez = await prisma.profesionales.create({
    data: {
      nombres: 'Juan',
      apellidos: 'Pérez',
      numero_colegiatura: 'COP-12345',
      especialidad: 'Odontología General & Rehabilitación',
    },
  });

  const draTorres = await prisma.profesionales.create({
    data: {
      nombres: 'Claudia',
      apellidos: 'Torres',
      numero_colegiatura: 'COP-67890',
      especialidad: 'Ortodoncia & Ortopedia Maxilar',
    },
  });

  // Habilitaciones de servicios
  await prisma.profesionalServicio.create({ data: { id_profesional: drPerez.id_profesional, id_servicio: servicioGeneral.id_servicio } });
  await prisma.profesionalServicio.create({ data: { id_profesional: drPerez.id_profesional, id_servicio: servicioControl.id_servicio } });
  await prisma.profesionalServicio.create({ data: { id_profesional: drPerez.id_profesional, id_servicio: servicioLimpieza.id_servicio } });
  await prisma.profesionalServicio.create({ data: { id_profesional: draTorres.id_profesional, id_servicio: servicioOrtodoncia.id_servicio } });
  await prisma.profesionalServicio.create({ data: { id_profesional: draTorres.id_profesional, id_servicio: servicioBlanqueamiento.id_servicio } });

  // ── 8. DISPONIBILIDADES DE SILLONES CLÍNICOS ─────────────────────
  const today = new Date();
  const d = (offset: number) => {
    const dt = new Date();
    dt.setDate(today.getDate() + offset);
    return dt;
  };
  const t = (h: number, m = 0) => new Date(new Date().setHours(h, m, 0, 0));

  const disp1 = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional, id_sede: sedeNorte.id_sede, fecha: d(0), hora_inicio: t(9), hora_fin: t(10), estado: 'Disponible' } });
  const disp2 = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional, id_sede: sedeNorte.id_sede, fecha: d(0), hora_inicio: t(10), hora_fin: t(11), estado: 'Disponible' } });
  const disp3 = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional, id_sede: sedeSur.id_sede, fecha: d(1), hora_inicio: t(15), hora_fin: t(16), estado: 'Disponible' } });
  const disp4 = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional, id_sede: sedeSur.id_sede, fecha: d(1), hora_inicio: t(9), hora_fin: t(10), estado: 'Disponible' } });
  const disp5 = await prisma.disponibilidad.create({ data: { id_profesional: drPerez.id_profesional, id_sede: sedeNorte.id_sede, fecha: d(7), hora_inicio: t(11), hora_fin: t(12), estado: 'Disponible' } });
  const disp6 = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeCentro.id_sede, fecha: d(2), hora_inicio: t(9), hora_fin: t(10), estado: 'Disponible' } });
  const disp7 = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeCentro.id_sede, fecha: d(2), hora_inicio: t(10), hora_fin: t(11), estado: 'Disponible' } });
  const disp8 = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeNorte.id_sede, fecha: d(3), hora_inicio: t(14), hora_fin: t(15), estado: 'Disponible' } });
  const disp9 = await prisma.disponibilidad.create({ data: { id_profesional: draTorres.id_profesional, id_sede: sedeNorte.id_sede, fecha: d(5), hora_inicio: t(16), hora_fin: t(17), estado: 'Disponible' } });

  // ── 9. PACIENTES MOCK (Flujo E2E Completo) ────────────────────────

  // ── LEAD 1: Jorge Benavides (En negociación activa con opciones) ──
  const nacJorge = new Date('1978-04-12');
  const pLead1 = await prisma.personas.create({
    data: {
      nombres: 'Jorge',
      apellidos: 'Benavides',
      dni: '10293847',
      email: 'jorge.benavides@negocioficticio.pe',
      numero: '+51 988 369 147',
      zona: 'Trujillo',
      fecha_nacimiento: nacJorge,
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      estado_calidad: 'Valido',
      id_etapa_actual: createdEtapas['LEAD'].id_etapa,
      id_canal_origen: canalWpp.id_canal,
      Interacciones: {
        create: [
          {
            tipo: 'Contacto inicial',
            mensaje: 'Contacto inicial completado. Persona muy ocupada en horario de la tarde: no contactar pasadas las 14:00.',
            id_canal: canalWpp.id_canal,
            id_fuente: fuenteOrg.id_fuente,
            id_usuario: usuario1.id_usuario,
            es_respuesta_util: true,
          },
        ],
      },
      DatosAcademicos: {
        create: { aplica: false }
      },
      DatosLaborales: {
        create: {
          aplica: true,
          ocupacion: 'Comerciante y consultor independiente',
          empresa: 'Establecimiento propio / Consultoría comercial',
          modalidad: 'Horario comercial flexible',
          disponibilidad: 'Mañanas de martes a jueves con previa coordinación telefónica',
        }
      },
      SaludOdontologica: {
        create: {
          ultima_visita_odontologica: 'Más de 1 año',
          motivo_consulta: 'Evaluación',
          tratamiento_previo: 'Extracción, restauración',
          nivel_dolor: 'Leve',
          presenta_sensibilidad: 'No',
          sangrado_o_inflamacion: 'Ninguno',
          usa_aparato_o_protesis: 'Ninguno',
          condicion_atencion_especial: 'Ninguna',
        }
      },
      Preferencias: {
        create: {
          id_canal: canalWpp.id_canal,
          id_horario: horarioManana.id_horario,
          id_modalidad: modalidadP.id_modalidad,
          sede_preferida: 'Sede Norte (Los Olivos)',
          profesional_preferido: 'Dra. Torres',
        }
      },
      Solicitudes: {
        create: {
          id_servicio: servicioOrtodoncia.id_servicio,
          motivo: 'Solicita evaluación de ortodoncia — Moderado — Requiere demostración de valor inmediata',
          tipo_consulta: 'Primera consulta',
          prioridad: 'Media',
          estado: 'En negociación',
          fecha_primera_respuesta: new Date(Date.now() - 10 * 60 * 1000), // Hace 10 min (Cumple L2 <= 15 min)
        }
      }
    },
    include: { Solicitudes: true }
  });

  const sol1 = pLead1.Solicitudes[0];
  await prisma.opciones.create({
    data: {
      id_solicitud: sol1.id_solicitud,
      id_disponibilidad: disp8.id_disponibilidad,
      precio_ofrecido: 150.00,
      seleccionada: false
    }
  });
  await prisma.opciones.create({
    data: {
      id_solicitud: sol1.id_solicitud,
      id_disponibilidad: disp9.id_disponibilidad,
      precio_ofrecido: 140.00,
      seleccionada: false
    }
  });

  // ── LEAD 2: Camila Rojas (En negociación activa con opciones) ─────
  const nacCamila = new Date('2002-08-25');
  const pLead2 = await prisma.personas.create({
    data: {
      nombres: 'Camila',
      apellidos: 'Rojas',
      dni: '74859632',
      email: 'camila.rojas@uni.pe',
      numero: '+51 987 654 321',
      zona: 'Lima - Miraflores',
      fecha_nacimiento: nacCamila,
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      estado_calidad: 'Valido',
      id_etapa_actual: createdEtapas['LEAD'].id_etapa,
      id_canal_origen: canalFb.id_canal,
      Interacciones: {
        create: [
          {
            tipo: 'Consulta Web',
            mensaje: 'Consulta por blanqueamiento dental. Horario disponible solo por las tardes.',
            id_canal: canalFb.id_canal,
            id_fuente: fuenteRedes.id_fuente,
            id_usuario: usuarioAsesor.id_usuario,
            es_respuesta_util: true,
          },
        ],
      },
      DatosAcademicos: {
        create: {
          aplica: true,
          universidad: 'Universidad Peruana de Ciencias Aplicadas (UPC)',
          carrera: 'Diseño Gráfico',
          ciclo: '7mo ciclo',
        }
      },
      DatosLaborales: {
        create: {
          aplica: true,
          ocupacion: 'Diseñadora freelance',
          empresa: 'Independiente',
          modalidad: 'Remoto / Part time',
          disponibilidad: 'Tardes de lunes a viernes después de las 18:00',
        }
      },
      SaludOdontologica: {
        create: {
          ultima_visita_odontologica: '6–12 meses',
          motivo_consulta: 'Estética',
          tratamiento_previo: 'Limpieza',
          nivel_dolor: 'Ninguno',
          presenta_sensibilidad: 'Sí',
          sangrado_o_inflamacion: 'Ninguno',
          usa_aparato_o_protesis: 'Ninguno',
          condicion_atencion_especial: 'Ninguna',
        }
      },
      Preferencias: {
        create: {
          id_canal: canalFb.id_canal,
          id_horario: horarioTarde.id_horario,
          id_modalidad: modalidadP.id_modalidad,
          sede_preferida: 'Sede Centro (San Isidro)',
          profesional_preferido: 'Dra. Torres',
        }
      },
      Solicitudes: {
        create: {
          id_servicio: servicioBlanqueamiento.id_servicio,
          motivo: 'Interesada en blanqueamiento dental — Alto — Busca resultado inmediato para evento universitario',
          tipo_consulta: 'Primera consulta',
          prioridad: 'Alta',
          estado: 'En negociación',
          fecha_primera_respuesta: new Date(Date.now() - 7 * 60 * 1000), // Hace 7 min (Cumple L2 <= 15 min)
        }
      }
    },
    include: { Solicitudes: true }
  });

  const sol2 = pLead2.Solicitudes[0];
  await prisma.opciones.create({
    data: {
      id_solicitud: sol2.id_solicitud,
      id_disponibilidad: disp6.id_disponibilidad,
      precio_ofrecido: 200.00,
      seleccionada: false
    }
  });
  await prisma.opciones.create({
    data: {
      id_solicitud: sol2.id_solicitud,
      id_disponibilidad: disp7.id_disponibilidad,
      precio_ofrecido: 180.00,
      seleccionada: false
    }
  });

  // ── LEAD 3: Rodrigo Silva (Negociación finalizada: Abandonado por presupuesto) ──
  const nacRodrigo = new Date('1990-11-15');
  await prisma.personas.create({
    data: {
      nombres: 'Rodrigo',
      apellidos: 'Silva',
      dni: '45678912',
      email: 'rodrigo.silva@empresa.pe',
      numero: '+51 977 444 888',
      zona: 'Lima - San Borja',
      fecha_nacimiento: nacRodrigo,
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      estado_calidad: 'Descartado',
      id_etapa_actual: createdEtapas['LEAD'].id_etapa,
      id_canal_origen: canalWpp.id_canal,
      Interacciones: {
        create: [
          {
            tipo: 'Cierre Comercial',
            mensaje: 'Prospecto indica que el presupuesto excede su capacidad actual. Desiste de reservar turno.',
            id_canal: canalWpp.id_canal,
            id_fuente: fuenteOrg.id_fuente,
            id_usuario: usuario1.id_usuario,
            es_respuesta_util: true,
          },
        ],
      },
      DatosLaborales: {
        create: {
          aplica: true,
          ocupacion: 'Analista financiero',
          empresa: 'Consultora Tributaria',
          modalidad: 'Presencial',
          disponibilidad: 'Sábados por la mañana',
        }
      },
      SaludOdontologica: {
        create: {
          ultima_visita_odontologica: 'Más de 1 año',
          motivo_consulta: 'Dolor / Evaluación',
          nivel_dolor: 'Moderado',
          presenta_sensibilidad: 'Sí',
        }
      },
      Preferencias: {
        create: {
          id_canal: canalWpp.id_canal,
          id_horario: horarioManana.id_horario,
          id_modalidad: modalidadP.id_modalidad,
          sede_preferida: 'Sede Norte (Los Olivos)',
        }
      },
      Solicitudes: {
        create: {
          id_servicio: servicioOrtodoncia.id_servicio,
          motivo: 'Evaluación ortodóncica — Desistió por costo',
          tipo_consulta: 'Presupuesto',
          estado: 'Abandonada',
          fecha_primera_respuesta: new Date(Date.now() - 12 * 60 * 1000),
          fecha_cierre: new Date(),
        }
      },
      EventosEtapa: {
        create: {
          etapa_origen: createdEtapas['LEAD'].id_etapa,
          etapa_destino: createdEtapas['LEAD'].id_etapa,
          motivo: 'Negociación finalizada: Resultado Abandonado (Precio / Presupuesto elevado)',
          evidencia: 'Constancia de desistimiento en chat WhatsApp',
          id_usuario: usuario1.id_usuario,
        }
      }
    },
  });

  // ── BUYER: Carlos Díaz (Nuevo interesado captado) ────────────────
  await prisma.personas.create({
    data: {
      nombres: 'Carlos',
      apellidos: 'Díaz',
      dni: '78945612',
      email: 'carlos.buyer@example.com',
      numero: '+51 999 666 555',
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      estado_calidad: 'Valido',
      id_etapa_actual: createdEtapas['BUYER'].id_etapa,
      id_canal_origen: canalWpp.id_canal,
      Solicitudes: {
        create: [{
          motivo: 'Evaluación odontológica general',
          id_servicio: servicioGeneral.id_servicio,
          tipo_consulta: 'Presupuesto',
          Opciones: {
            create: [{ id_disponibilidad: disp1.id_disponibilidad, precio_ofrecido: 50.0 }],
          },
        }],
      },
    },
  });

  // ── PAYER: María Gómez (Pago validado y reserva confirmada) ──────
  const pPayer = await prisma.personas.create({
    data: {
      nombres: 'María',
      apellidos: 'Gómez',
      dni: '65478932',
      email: 'maria.payer@example.com',
      numero: '+51 999 444 333',
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      estado_calidad: 'Valido',
      id_etapa_actual: createdEtapas['PAYER'].id_etapa,
      id_canal_origen: canalIg.id_canal,
    },
  });

  const solPayer = await prisma.solicitudes.create({
    data: {
      id_persona: pPayer.id_persona,
      id_servicio: servicioControl.id_servicio,
      motivo: 'Instalación y control de brackets',
      estado: 'Convertida',
      fecha_cierre: new Date(),
    }
  });

  const opcPayer = await prisma.opciones.create({
    data: {
      id_solicitud: solPayer.id_solicitud,
      id_disponibilidad: disp3.id_disponibilidad,
      precio_ofrecido: 150.0,
      seleccionada: true,
    }
  });

  const resPayer = await prisma.reservas.create({
    data: {
      id_persona: pPayer.id_persona,
      id_solicitud: solPayer.id_solicitud,
      id_opcion: opcPayer.id_opcion,
      estado: 'Confirmada',
      confirmacion_explicita: true,
      fecha_confirmacion: new Date(),
    }
  });

  await prisma.pagos.create({
    data: {
      id_persona: pPayer.id_persona,
      id_reserva: resPayer.id_reserva,
      importe: 150.0,
      canal_pago: 'Yape',
      referencia_pago: 'OP-YAPE-984123',
      estado: 'Validado',
      fecha_validacion: new Date(),
      validado_por: usuario1.id_usuario,
    }
  });

  await prisma.eventosEtapa.create({
    data: {
      id_persona: pPayer.id_persona,
      etapa_origen: createdEtapas['LEAD'].id_etapa,
      etapa_destino: createdEtapas['PAYER'].id_etapa,
      motivo: 'Reserva confirmada con pago inicial validado',
      evidencia: 'OP-YAPE-984123',
      id_usuario: usuario1.id_usuario,
    }
  });

  // ── CUSTOMER: José Martínez (Atención clínica ejecutada) ─────────
  const pCustomer = await prisma.personas.create({
    data: {
      nombres: 'José',
      apellidos: 'Martínez',
      dni: '12345678',
      email: 'jose.customer@example.com',
      numero: '+51 999 222 111',
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      estado_calidad: 'Valido',
      id_etapa_actual: createdEtapas['CUSTOMER'].id_etapa,
      id_canal_origen: canalWeb.id_canal,
    },
  });

  const solCustomer = await prisma.solicitudes.create({
    data: {
      id_persona: pCustomer.id_persona,
      id_servicio: servicioGeneral.id_servicio,
      motivo: 'Control anual y profilaxis',
      estado: 'Convertida',
      fecha_cierre: new Date(),
    }
  });

  const opcCustomer = await prisma.opciones.create({
    data: {
      id_solicitud: solCustomer.id_solicitud,
      id_disponibilidad: disp2.id_disponibilidad,
      precio_ofrecido: 50.0,
      seleccionada: true,
    }
  });

  const resCustomer = await prisma.reservas.create({
    data: {
      id_persona: pCustomer.id_persona,
      id_solicitud: solCustomer.id_solicitud,
      id_opcion: opcCustomer.id_opcion,
      estado: 'Atendida',
      confirmacion_explicita: true,
      fecha_confirmacion: new Date(),
    }
  });

  await prisma.pagos.create({
    data: {
      id_persona: pCustomer.id_persona,
      id_reserva: resCustomer.id_reserva,
      importe: 50.0,
      canal_pago: 'Tarjeta Visa',
      referencia_pago: 'OP-VISA-882100',
      estado: 'Validado',
      fecha_validacion: new Date(),
      validado_por: usuario1.id_usuario,
    }
  });

  await prisma.atenciones.create({
    data: {
      id_persona: pCustomer.id_persona,
      id_reserva: resCustomer.id_reserva,
      id_servicio: servicioGeneral.id_servicio,
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha_atencion: today,
      fecha_inicio: new Date(Date.now() - 45 * 60 * 1000),
      fecha_fin: new Date(),
      asistencia: 'Asistio',
      estado_servicio: 'Finalizado',
      motivo_consulta: 'Revisión periódica anual y molestia leve en molar 36.',
      antecedentes: 'Ninguno relevante.',
      evaluacion: 'Higiene bucal adecuada. Presencia de placa bacteriana leve.',
      diagnostico_basico: 'Gingivitis marginal leve asociada a biopelícula.',
      procedimiento: 'Profilaxis ultrasónica completa y pulido con pasta fluorada.',
      resultado: 'Paciente sano, encías desinflamadas, sin caries activas.',
      indicaciones_finales: 'Uso de hilo dental diario y enjuague fluorado por 7 días.',
    },
  });

  await prisma.eventosEtapa.create({
    data: {
      id_persona: pCustomer.id_persona,
      etapa_origen: createdEtapas['PAYER'].id_etapa,
      etapa_destino: createdEtapas['CUSTOMER'].id_etapa,
      motivo: 'Paciente en sillón odontológico, atención clínica realizada',
      id_usuario: usuario1.id_usuario,
    }
  });

  // ── TURNED: Ana López (En postventa y reactivación) ──────────────
  const pTurned = await prisma.personas.create({
    data: {
      nombres: 'Ana',
      apellidos: 'López',
      dni: '32165498',
      email: 'ana.turned@example.com',
      numero: '+51 999 111 000',
      autoriza_contacto: true,
      fecha_autorizacion: new Date(),
      estado_calidad: 'Valido',
      id_etapa_actual: createdEtapas['TURNED'].id_etapa,
      id_canal_origen: canalWpp.id_canal,
      Interacciones: {
        create: [
          {
            tipo: 'Seguimiento Postventa',
            mensaje: 'Llamada de seguimiento a las 48h tras curación: paciente reporta excelente evolución sin dolor.',
            id_usuario: usuario1.id_usuario,
            id_canal: canalWpp.id_canal,
          }
        ],
      },
    },
  });

  const solTurned = await prisma.solicitudes.create({
    data: {
      id_persona: pTurned.id_persona,
      id_servicio: servicioLimpieza.id_servicio,
      motivo: 'Limpieza dental profunda',
      estado: 'Convertida',
      fecha_cierre: new Date(),
    }
  });

  const resTurned = await prisma.reservas.create({
    data: {
      id_persona: pTurned.id_persona,
      id_solicitud: solTurned.id_solicitud,
      id_opcion: opcCustomer.id_opcion, // Referencia previa
      estado: 'Atendida',
      confirmacion_explicita: true,
    }
  });

  const atencionTurned = await prisma.atenciones.create({
    data: {
      id_persona: pTurned.id_persona,
      id_reserva: resTurned.id_reserva,
      id_servicio: servicioLimpieza.id_servicio,
      id_profesional: drPerez.id_profesional,
      id_sede: sedeNorte.id_sede,
      fecha_atencion: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000),
      asistencia: 'Asistio',
      estado_servicio: 'Finalizado',
      resultado: 'Limpieza y profilaxis culminada con éxito.',
    }
  });

  await prisma.seguimientos.create({
    data: {
      id_persona: pTurned.id_persona,
      id_atencion: atencionTurned.id_atencion,
      tipo: 'Control postoperatorio',
      canal: 'WhatsApp',
      resultado: 'Paciente muy conforme con el tratamiento recibido.',
      satisfaccion: 5,
      incidencia: false,
      observaciones: 'Calificación de 5 estrellas en CSAT.',
      id_usuario: usuario1.id_usuario,
    }
  });

  await prisma.eventosEtapa.create({
    data: {
      id_persona: pTurned.id_persona,
      etapa_origen: createdEtapas['CUSTOMER'].id_etapa,
      etapa_destino: createdEtapas['TURNED'].id_etapa,
      motivo: 'Tratamiento culminado, derivado a postventa y fidelización',
      id_usuario: usuario1.id_usuario,
    }
  });

  console.log('✅ Base de datos poblada exitosamente con todos los pacientes y etapas!');
}

main()
  .catch((e) => {
    console.error('❌ Error al ejecutar el seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
